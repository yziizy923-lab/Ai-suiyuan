// app/api/ingredient/origins/route.ts
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

// ---------- 加载映射文件 ----------
const mappingFilePath = path.join(process.cwd(), 'app', 'data', 'geo_to_region.json');
let factorMap: Record<string, Array<{
  name: string;
  lat: number;
  lng: number;
  desc: string;
}>> = {};

try {
  const mappingData = JSON.parse(fs.readFileSync(mappingFilePath, 'utf-8'));
  mappingData.forEach((item: any) => {
    factorMap[item.factor] = item.regions;
  });
  console.log(`[Ingredient Origins] Loaded ${Object.keys(factorMap).length} geo factors`);
} catch (error) {
  console.warn('[Ingredient Origins] geo_to_region.json not found, using empty map:', error);
}

// ---------- 查询单个食材的地理因子 ----------
async function getIngredientFactors(ingredientName: string): Promise<string[]> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (i:Ingredient {name: $name})-[:HAS_FACTOR]->(f:Factor)
       RETURN f.name AS factorName`,
      { name: ingredientName }
    );
    return result.records.map(record => record.get('factorName'));
  } finally {
    await session.close();
  }
}

// ---------- 根据因子获取区域坐标 ----------
function getRegionsByFactors(factors: string[]): Array<{
  region: string;
  lat: number;
  lng: number;
  desc: string;
  factor: string;
}> {
  const points: Array<{
    region: string;
    lat: number;
    lng: number;
    desc: string;
    factor: string;
  }> = [];
  const seen = new Set<string>();

  for (const factor of factors) {
    const regions = factorMap[factor];
    if (regions) {
      for (const region of regions) {
        const key = `${region.lat},${region.lng}`;
        if (!seen.has(key)) {
          seen.add(key);
          points.push({
            region: region.name,
            lat: region.lat,
            lng: region.lng,
            desc: region.desc,
            factor,
          });
        }
      }
    }
  }

  return points;
}

// ---------- API 处理函数 ----------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ingredient = searchParams.get('ingredient')?.trim();

  if (!ingredient) {
    return NextResponse.json({ error: '缺少食材名参数 ?ingredient=xxx' }, { status: 400 });
  }

  try {
    const factors = await getIngredientFactors(ingredient);
    
    if (factors.length === 0) {
      return NextResponse.json({ 
        ingredient, 
        factors: [],
        points: [], 
        message: '未找到关联地理因素，可能食材在知识图谱中无关联信息' 
      });
    }

    const points = getRegionsByFactors(factors);

    return NextResponse.json({
      ingredient,
      factors,
      points,
      count: points.length
    });
  } catch (error: any) {
    console.error('[Ingredient Origins] 查询出错:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
