import { NextResponse } from 'next/server';
import wangSitaiData from '@/data/wang_sitai_babao_doufu.json';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dishName = searchParams.get('name');

  if (!dishName) {
    return NextResponse.json({ success: false, error: '缺少菜品名称' }, { status: 400 });
  }

  try {
    // 模糊匹配菜品名
    const normalizedName = dishName.trim().replace(/\s+/g, '');
    const specialDishes: Record<string, string[]> = {
      '王太守八宝豆腐': ['王太守八宝豆腐'],
    };

    let matchedDish = false;
    for (const key of Object.keys(specialDishes)) {
      const normalizedKey = key.trim().replace(/\s+/g, '');
      if (normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
        matchedDish = true;
        break;
      }
    }

    // 如果没有匹配，返回空数据
    if (!matchedDish) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 从 JSON 数据中提取食材分布信息
    const ingredientsDistribution = wangSitaiData.ingredients_distribution;

    // 定义风味类型映射 - 每个食材对应的风味和重要性
    const flavorMapping: Record<string, { flavor: string; importance: 'main' | 'important' | 'normal'; color: string }> = {
      '豆腐脑': { flavor: '鲜', importance: 'main', color: '#27AE60' },
      '香菇': { flavor: '鲜', importance: 'important', color: '#27AE60' },
      '蘑菇': { flavor: '鲜', importance: 'important', color: '#27AE60' },
      '松子仁': { flavor: '鲜', importance: 'important', color: '#27AE60' },
      '鸡肉': { flavor: '鲜', importance: 'important', color: '#27AE60' },
      '鸡汤': { flavor: '咸', importance: 'main', color: '#2980B9' },
      '火腿': { flavor: '咸', importance: 'important', color: '#2980B9' },
      '瓜子仁': { flavor: '甜', importance: 'normal', color: '#F39C12' },
    };

    // 生成风味数据 - 使用真实的食材产地
    const flavorData: Array<{
      lng: number;
      lat: number;
      name: string;
      ingredient: string;
      flavor: string;
      importance: 'main' | 'important' | 'normal';
      color: string;
    }> = [];

    // 处理每种食材
    for (const ingredient of ingredientsDistribution) {
      const mapping = flavorMapping[ingredient.ingredient];
      if (!mapping) continue;

      // 遍历该食材的所有产地
      for (const location of ingredient.distribution_locations) {
        flavorData.push({
          lng: location.longitude,
          lat: location.latitude,
          name: location.name,
          ingredient: ingredient.ingredient,
          flavor: mapping.flavor,
          importance: mapping.importance,
          color: mapping.color,
        });
      }
    }

    console.log('[DishFlavor] Generated flavor data points:', flavorData.length);
    console.log('[DishFlavor] Flavors:', [...new Set(flavorData.map(d => d.flavor))]);
    console.log('[DishFlavor] Importance distribution:', {
      main: flavorData.filter(d => d.importance === 'main').length,
      important: flavorData.filter(d => d.importance === 'important').length,
      normal: flavorData.filter(d => d.importance === 'normal').length,
    });

    return NextResponse.json({
      success: true,
      data: flavorData,
    });
  } catch (error) {
    console.error('[DishFlavor] Error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}