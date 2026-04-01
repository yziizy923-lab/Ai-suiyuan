import { NextResponse } from 'next/server';
import { pool, getDishByIdFallback } from '../../../../lib/db';

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
             image_url AS image, geo_factors AS origin, cultural_story AS history
      FROM unified_recipes
      WHERE id = $1 AND processed = true
      `,
      [dishId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
    }

    return NextResponse.json({ ...result.rows[0], fromBackup: false });
  } catch (err) {
    console.error('[API] Database query failed, using backup:', err);

    try {
      const dish = await getDishByIdFallback(dishId);

      if (!dish) {
        return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
      }

      return NextResponse.json({ ...dish, fromBackup: true });
    } catch (backupErr) {
      console.error('[API] Backup data also failed:', backupErr);
      return NextResponse.json({ error: 'Failed to fetch dish' }, { status: 500 });
    }
  }
}
