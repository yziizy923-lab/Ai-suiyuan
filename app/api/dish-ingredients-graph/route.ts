// app/api/dish-ingredients-graph/route.ts
import { NextRequest, NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';
import fs from 'fs';
import path from 'path';

// 强制使用 Node.js 运行时
export const runtime = 'nodejs';

// ---------- Neo4j 连接配置 ----------
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '00000000';

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// ---------- 加载区域数据 ----------
interface RegionData {
  name: string;
  lat: number;
  lng: number;
  desc: string;
}

let regions: RegionData[] = [];
let factorMap: Record<string, RegionData[]> = {};

function loadRegionData() {
  const mappingFilePath = path.join(process.cwd(), 'app', 'data', 'geo_to_region.json');
  try {
    if (fs.existsSync(mappingFilePath)) {
      const mappingData = JSON.parse(fs.readFileSync(mappingFilePath, 'utf-8'));
      mappingData.forEach((item: any) => {
        factorMap[item.factor] = item.regions.map((r: any) => ({
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          desc: r.desc || '',
        }));
        // 同时添加到 regions 列表
        for (const r of item.regions) {
          if (!regions.find(existing => existing.name === r.name)) {
            regions.push({
              name: r.name,
              lat: r.lat,
              lng: r.lng,
              desc: r.desc || '',
            });
          }
        }
      });
      console.log(`[DishIngredientsGraph] Loaded ${regions.length} regions and ${Object.keys(factorMap).length} factors`);
    }
  } catch (error) {
    console.warn('[DishIngredientsGraph] Failed to load geo_to_region.json:', error);
  }
}

// 初始化加载
loadRegionData();

// ---------- 从 Neo4j 查询菜品 -> 食材 -> 地理因子 ----------
async function queryDishIngredients(dishName: string): Promise<Array<{
  name: string;
  factors: string[];
}>> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (d:Dish {name: $name})-[:CONTAINS]->(i:Ingredient) 
       OPTIONAL MATCH (i)-[:HAS_FACTOR|HAS_GEO_FACTOR]->(g:GeoFactor) 
       OPTIONAL MATCH (i)-[:LOCATED_IN]->(r:Region)
       RETURN i.name AS ingredient, 
              collect(DISTINCT g.name) AS factors,
              collect(DISTINCT r.name) AS regions`,
      { name: dishName }
    );
    
    const ingredients: Array<{ name: string; factors: string[] }> = [];
    for (const record of result.records) {
      const ingredient = record.get('ingredient');
      const factors = record.get('factors').filter(Boolean);
      const regionNames = record.get('regions').filter(Boolean);
      
      // 如果有直接关联的区域，添加为因子
      if (regionNames.length > 0) {
        for (const regionName of regionNames) {
          if (!factors.includes(regionName)) {
            factors.push(regionName);
          }
        }
      }
      
      if (ingredient) {
        ingredients.push({
          name: ingredient,
          factors: factors.filter(Boolean),
        });
      }
    }
    return ingredients;
  } finally {
    await session.close();
  }
}

// ---------- 简化分词（用于 Node.js） ----------
function simpleTokenize(text: string): string[] {
  // 简单的中文字符分词
  const chars = text.split('');
  const tokens: string[] = [];
  let current = '';
  
  for (const char of chars) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      tokens.push(char);
    } else if (/[a-zA-Z]/.test(char)) {
      if (current && !/[a-zA-Z]/.test(current[0])) {
        tokens.push(current);
        current = '';
      }
      current += char;
    } else {
      if (current) tokens.push(current);
      current = '';
    }
  }
  if (current) tokens.push(current);
  
  return tokens.filter(t => t.length > 0);
}

// ---------- TF-IDF 计算相似度 ----------
function computeTFIDFSimilarity(text1: string, text2: string): number {
  const tokens1 = simpleTokenize(text1);
  const tokens2 = simpleTokenize(text2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // 计算词频
  const tf1: Record<string, number> = {};
  const tf2: Record<string, number> = {};
  
  for (const token of tokens1) {
    tf1[token] = (tf1[token] || 0) + 1;
  }
  for (const token of tokens2) {
    tf2[token] = (tf2[token] || 0) + 1;
  }
  
  // 合并所有词
  const allWords = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  
  // 计算 IDF（简化：使用文档频率）
  const idf: Record<string, number> = {};
  for (const word of allWords) {
    const docCount = (tf1[word] ? 1 : 0) + (tf2[word] ? 1 : 0);
    idf[word] = Math.log(2 / docCount) + 1;
  }
  
  // 计算 TF-IDF 向量
  const vec1: number[] = [];
  const vec2: number[] = [];
  
  for (const word of allWords) {
    const tfidf1 = (tf1[word] || 0) * idf[word];
    const tfidf2 = (tf2[word] || 0) * idf[word];
    vec1.push(tfidf1);
    vec2.push(tfidf2);
  }
  
  // 计算余弦相似度
  const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (norm1 * norm2);
}

// ---------- 匹配食材需求到区域 ----------
function matchIngredientToRegions(requirement: string, topK: number = 3): Array<{
  region: string;
  lat: number;
  lng: number;
  desc: string;
  score: number;
}> {
  if (!requirement.trim()) return [];
  
  const scored = regions.map(region => ({
    region: region.name,
    lat: region.lat,
    lng: region.lng,
    desc: region.desc,
    score: computeTFIDFSimilarity(requirement, region.desc || ''),
  }));

  // 排序并取前 topK 个
  scored.sort((a, b) => b.score - a.score);
  
  return scored
    .filter(r => r.score > 0.05)
    .slice(0, topK);
}

// ---------- API 处理函数 ----------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dishName = searchParams.get('name')?.trim();

  if (!dishName) {
    return NextResponse.json({ error: '缺少菜品名称参数 ?name=xxx' }, { status: 400 });
  }

  try {
    console.log(`[DishIngredientsGraph] 查询菜品: ${dishName}`);
    
    // 从 Neo4j 查询食材和因子
    const ingredients = await queryDishIngredients(dishName);
    
    if (ingredients.length === 0) {
      return NextResponse.json({
        success: true,
        dishName,
        ingredients: [],
        message: '未找到该菜品的食材信息'
      });
    }

    console.log(`[DishIngredientsGraph] 找到 ${ingredients.length} 种食材`);

    // 为每种食材匹配区域
    const result: Array<{
      ingredient: string;
      factors: string[];
      points: Array<{
        region: string;
        lat: number;
        lng: number;
        desc: string;
        factor: string;
      }>;
    }> = [];

    for (const ing of ingredients) {
      // 使用因子直接查找区域
      const points: Array<{
        region: string;
        lat: number;
        lng: number;
        desc: string;
        factor: string;
      }> = [];
      const seenNames = new Set<string>();

      // 先尝试直接匹配因子
      for (const factor of ing.factors) {
        const regions = factorMap[factor] || [];
        for (const region of regions) {
          if (!seenNames.has(region.name)) {
            seenNames.add(region.name);
            points.push({
              region: region.name,
              lat: region.lat,
              lng: region.lng,
              desc: region.desc,
              factor: factor,
            });
          }
        }
      }

      // 如果没有找到，使用 TF-IDF 匹配
      if (points.length === 0 && ing.factors.length > 0) {
        const requirement = ing.factors.join('，');
        const matched = matchIngredientToRegions(requirement, 3);
        for (const m of matched) {
          if (!seenNames.has(m.region)) {
            seenNames.add(m.region);
            points.push({
              region: m.region,
              lat: m.lat,
              lng: m.lng,
              desc: m.desc,
              factor: ing.factors[0] || '未知',
            });
          }
        }
      }

      result.push({
        ingredient: ing.name,
        factors: ing.factors,
        points,
      });
    }

    return NextResponse.json({
      success: true,
      dishName,
      ingredients: result,
      count: result.length,
    });

  } catch (error: any) {
    console.error('[DishIngredientsGraph] 查询出错:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || '查询失败' 
    }, { status: 500 });
  }
}
