import { NextResponse } from 'next/server';
import wangSitaiData from '@/data/wang_sitai_babao_doufu.json';

/**
 * 获取菜品详细数据（包含食材分布）
 * 仅对特菜品（如王太守八宝豆腐）返回完整数据
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dishName = searchParams.get('name');

  if (!dishName) {
    return NextResponse.json({ success: false, error: '缺少菜品名称' }, { status: 400 });
  }

  try {
    // 检查是否是特殊菜品
    const specialDishes: Record<string, typeof wangSitaiData> = {
      '王太守八宝豆腐': wangSitaiData,
      '王太守八宝豆腐（王太守八宝酿豆腐）': wangSitaiData,
    };

    // 模糊匹配
    const normalizedName = dishName.trim().replace(/\s+/g, '');
    for (const [key, data] of Object.entries(specialDishes)) {
      const normalizedKey = key.trim().replace(/\s+/g, '');
      if (normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
        return NextResponse.json({
          success: true,
          data: {
            ingredients_distribution: data.ingredients_distribution,
            dish_location: data.dish_location,
            dish_name: data.dish_name,
            main_ingredients: data.main_ingredients,
          },
        });
      }
    }

    // 如果没有匹配的特菜品，返回 null（由前端使用 Neo4j 图谱数据）
    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('[DishDetail] Error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
