import { NextResponse } from 'next/server';
import { pool, getDishByIdFallback } from '../../../../lib/db';
import { getDishCoords } from '../../../../lib/geo-coords';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dishId = parseInt(id, 10);

  if (isNaN(dishId)) {
    return NextResponse.json({ error: 'Invalid dish ID' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, dish_name AS name, modern_translation AS desc,
             taste_tags AS tags, main_ingredients AS ingredients,
             image_url AS image, geo_factors AS origin, cultural_story AS history,
             longitude, latitude
      FROM unified_recipes
      WHERE id = $1 AND processed = true
      `,
      [dishId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
    }

    // 获取地图坐标：优先使用数据库中的坐标，否则回退到映射函数
    const dishData = result.rows[0];
    let originCoords: [number, number] | null = null;

    // 如果数据库中有有效坐标，直接使用
    if (dishData.longitude && dishData.latitude) {
      originCoords = [Number(dishData.longitude), Number(dishData.latitude)];
    }

    // 如果数据库没有坐标，使用映射函数作为回退
    if (!originCoords) {
      const mappedCoords = getDishCoords(dishData.name, dishData.origin);
      // 如果映射函数也返回 null，添加默认值（江南地区 - 随园食单的发源地）
      originCoords = mappedCoords || [120.15, 30.28]; // 默认杭州/苏州区域
      if (!mappedCoords) {
        console.log(`[API] No coordinates found for dish "${dishData.name}", using default [120.15, 30.28]`);
      }
    }

    return NextResponse.json({
      ...dishData,
      originCoords,
      fromBackup: false
    });
  } catch (err) {
    console.error('[API] Database query failed, using backup:', err);

    try {
      const dish = await getDishByIdFallback(dishId);

      if (!dish) {
        return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
      }

      // 处理 fallback 数据的坐标：优先使用备份中的坐标
      let fallbackOriginCoords: [number, number] | null = null;
      if (dish.longitude && dish.latitude) {
        fallbackOriginCoords = [dish.longitude, dish.latitude];
      } else {
        fallbackOriginCoords = getDishCoords(dish.name, dish.origin);
      }

      return NextResponse.json({
        ...dish,
        originCoords: fallbackOriginCoords,
        fromBackup: true
      });
    } catch (backupErr) {
      console.error('[API] Backup data also failed:', backupErr);
      return NextResponse.json({ error: 'Failed to fetch dish' }, { status: 500 });
    }
  }
}
