// app/api/dish-full-detail/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// 加载特菜品数据
function loadSpecialDishData(dishName: string) {
  const normalizedName = dishName.trim().replace(/\s+/g, '').toLowerCase();
  
  // 特菜品映射
  const specialDishFiles: Record<string, string> = {
    'wangsitai': 'wang_sitai_babao_doufu.json',
  };

  for (const [key, filename] of Object.entries(specialDishFiles)) {
    if (normalizedName.includes(key)) {
      try {
        const filePath = path.join(process.cwd(), 'data', filename);
        if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
      } catch (e) {
        console.error(`[DishFullDetail] Failed to load ${filename}:`, e);
      }
    }
  }
  return null;
}

// 加载地理因子映射文件
function loadFactorMap(): Record<string, any[]> {
  const mappingFilePath = path.join(process.cwd(), 'app', 'data', 'geo_to_region.json');
  const factorMap: Record<string, any[]> = {};
  
  try {
    if (fs.existsSync(mappingFilePath)) {
      const mappingData = JSON.parse(fs.readFileSync(mappingFilePath, 'utf-8'));
      mappingData.forEach((item: any) => {
        factorMap[item.factor] = item.regions;
      });
      console.log(`[DishFullDetail] Loaded ${Object.keys(factorMap).length} geo factors`);
    } else {
      console.warn('[DishFullDetail] geo_to_region.json not found');
    }
  } catch (e) {
    console.warn('[DishFullDetail] Failed to load geo_to_region.json:', e);
  }
  
  return factorMap;
}

// 根据关键词查找匹配的地理因子
function findMatchingFactors(keyword: string, factorMap: Record<string, any[]>): string[] {
  const matches: string[] = [];
  const lowerKeyword = keyword.toLowerCase();
  
  for (const factor of Object.keys(factorMap)) {
    const lowerFactor = factor.toLowerCase();
    // 完全匹配
    if (lowerFactor === lowerKeyword) {
      matches.push(factor);
    }
    // 包含关键词
    else if (lowerFactor.includes(lowerKeyword) || lowerKeyword.includes(lowerFactor.replace(/地形|气候/g, ''))) {
      matches.push(factor);
    }
    // 部分匹配（去除"地形"和"气候"后缀）
    else {
      const baseKeyword = lowerKeyword.replace(/地形|气候|性/g, '');
      const baseFactor = lowerFactor.replace(/地形|气候|性/g, '');
      if (baseFactor.includes(baseKeyword) || baseKeyword.includes(baseFactor)) {
        matches.push(factor);
      }
    }
  }
  
  return matches;
}

// 获取单个食材的产地坐标
async function getIngredientOrigins(ingredientName: string, factorMap: Record<string, any[]>): Promise<any[]> {
  const normalizedIngredient = ingredientName.trim();
  
  // 常见食材到关键词的映射
  const ingredientKeywordsMap: Record<string, string[]> = {
    '豆腐': ['平原', '大豆', '温带'],
    '豆腐脑': ['平原', '大豆', '温带'],
    '鸡肉': ['平原', '温带', '丘陵'],
    '猪肉': ['平原', '温带'],
    '牛肉': ['草原', '高原', '山地'],
    '羊肉': ['草原', '高原'],
    '鱼肉': ['淡水', '江', '湖泊'],
    '虾': ['淡水', '江', '海'],
    '蟹': ['淡水', '江', '海'],
    '香菇': ['山地', '湿润', '森林', '丘陵'],
    '蘑菇': ['山地', '湿润', '森林', '丘陵'],
    '青菜': ['平原', '湿润', '温带'],
    '白菜': ['平原', '温带', '北方'],
    '萝卜': ['平原', '温带'],
    '葱': ['平原', '温带'],
    '姜': ['山地', '亚热带', '南方'],
    '蒜': ['平原', '温带'],
    '盐': ['海', '盐湖', '矿'],
    '酱油': ['平原', '大豆', '发酵'],
    '醋': ['粮食', '发酵'],
    '糖': ['甘蔗', '甜菜', '平原'],
    '鸡蛋': ['平原', '温带'],
    '火腿': ['高原', '山地', '温带'],
    '腊肉': ['高原', '山地', '干燥'],
    '糯米': ['平原', '湿热', '南方'],
    '粳米': ['平原', '温带', '北方'],
    '面粉': ['平原', '温带', '北方'],
    '茶叶': ['山地', '丘陵', '湿润'],
    '竹笋': ['山地', '丘陵', '湿润'],
    '莲藕': ['淡水', '湖泊', '沼泽'],
    '菱角': ['淡水', '湖泊', '沼泽'],
    '芡实': ['淡水', '湖泊'],
    '枸杞': ['高原', '干燥'],
    '红枣': ['平原', '丘陵', '温带'],
    '桂圆': ['丘陵', '亚热带', '南方'],
    '荔枝': ['热带', '亚热带', '南方'],
    '柑橘': ['亚热带', '丘陵', '南方'],
    '梨': ['平原', '温带', '丘陵'],
    '苹果': ['温带', '丘陵', '北方'],
    '葡萄': ['温带', '丘陵', '干燥'],
    '花椒': ['山地', '丘陵', '干燥'],
    '辣椒': ['热带', '亚热带', '南方'],
    '胡椒': ['热带', '山地'],
    '八角': ['亚热带', '山地', '南方'],
    '桂皮': ['亚热带', '山地', '南方'],
  };

  // 获取匹配的关键词
  const keywords = ingredientKeywordsMap[normalizedIngredient] || [normalizedIngredient];
  
  // 收集所有匹配的因子
  const allMatches = new Set<string>();
  for (const keyword of keywords) {
    const matches = findMatchingFactors(keyword, factorMap);
    matches.forEach(m => allMatches.add(m));
  }
  
  // 如果没有找到，添加一些通用因子
  if (allMatches.size === 0) {
    allMatches.add('平原地形');
    allMatches.add('温带季风气候');
  }
  
  // 获取所有匹配因子的地区
  const points: any[] = [];
  const seen = new Set<string>();

  for (const factor of allMatches) {
    const regions = factorMap[factor];
    if (regions && regions.length > 0) {
      for (const region of regions) {
        const key = `${region.lat},${region.lng}`;
        if (!seen.has(key)) {
          seen.add(key);
          points.push({
            name: region.name,
            longitude: region.lng,
            latitude: region.lat,
            note: region.desc || '',
            factor: factor,
          });
        }
      }
    }
  }

  return points;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dishId = searchParams.get('id');
  const dishName = searchParams.get('name');

  if (!dishId && !dishName) {
    return NextResponse.json({ success: false, error: '缺少菜品ID或名称' }, { status: 400 });
  }

  try {
    // 加载地理因子映射
    const factorMap = loadFactorMap();

    let dishData: any = null;
    let ingredientsDistribution: any[] = [];

    // 1. 如果提供了名称，尝试加载特菜品数据
    if (dishName) {
      const specialData = loadSpecialDishData(dishName);
      if (specialData) {
        return NextResponse.json({
          success: true,
          hasDetailData: true,
          data: {
            dish_name: specialData.dish_name,
            dish_location: specialData.dish_location,
            ingredients_distribution: specialData.ingredients_distribution,
            main_ingredients: specialData.main_ingredients,
            category: specialData.category,
            taste_tags: specialData.taste_tags,
            original_text: specialData.original_text,
            modern_translation: specialData.modern_translation,
            cultural_story: specialData.cultural_story,
            ingredients_summary: specialData.ingredients_summary,
          },
        });
      }
    }

    // 2. 如果提供了ID，从数据库查询
    if (dishId) {
      const dishIdNum = parseInt(dishId, 10);
      if (!isNaN(dishIdNum)) {
        const result = await pool.query(
          `SELECT id, dish_name AS name, modern_translation AS description,
                  taste_tags AS tags, main_ingredients AS ingredients,
                  geo_factors AS origin, cultural_story AS history,
                  longitude, latitude
           FROM unified_recipes
           WHERE id = $1 AND processed = true`,
          [dishIdNum]
        );

        if (result.rows.length > 0) {
          dishData = result.rows[0];

          // 解析数组字段
          let ingredients: string[] = [];
          if (dishData.ingredients) {
            if (Array.isArray(dishData.ingredients)) {
              ingredients = dishData.ingredients;
            } else if (typeof dishData.ingredients === 'string') {
              try {
                ingredients = JSON.parse(dishData.ingredients);
              } catch {
                ingredients = dishData.ingredients.split(',').map((s: string) => s.trim()).filter(Boolean);
              }
            }
          }

          console.log(`[DishFullDetail] Dish "${dishData.name}" has ${ingredients.length} ingredients`);

          // 获取每个食材的产地
          for (const ingredient of ingredients.slice(0, 8)) { // 限制最多8种食材
            const origins = await getIngredientOrigins(ingredient, factorMap);
            if (origins.length > 0) {
              ingredientsDistribution.push({
                ingredient: ingredient,
                category: '未知',
                distribution_locations: origins,
              });
              console.log(`[DishFullDetail] Ingredient "${ingredient}" has ${origins.length} origins`);
            }
          }

          return NextResponse.json({
            success: true,
            hasDetailData: ingredientsDistribution.length > 0,
            data: {
              id: dishData.id,
              name: dishData.name,
              description: dishData.description,
              tags: dishData.tags,
              ingredients: ingredients,
              origin: dishData.origin,
              history: dishData.history,
              dish_location: dishData.longitude && dishData.latitude ? {
                name: dishData.name,
                origin: dishData.origin,
                longitude: dishData.longitude,
                latitude: dishData.latitude,
                note: '',
              } : null,
              ingredients_distribution: ingredientsDistribution,
              main_ingredients: ingredients,
            },
          });
        }
      }
    }

    // 3. 如果都没有找到，返回失败
    return NextResponse.json({
      success: false,
      error: '未找到菜品数据',
      hasDetailData: false,
    }, { status: 404 });

  } catch (error: any) {
    console.error('[DishFullDetail] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '获取失败',
      hasDetailData: false,
    }, { status: 500 });
  }
}
