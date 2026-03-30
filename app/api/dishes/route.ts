import { NextResponse } from 'next/server';
import { pool, searchDishesFallback, getAllDishesFromBackup } from '../../../lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let dishes;

    if (search) {
      const result = await pool.query(
        `
        SELECT id, dish_name AS name, modern_translation AS desc,
               taste_tags AS tags, main_ingredients AS ingredients,
               image_url AS image, geo_factors AS origin, cultural_story AS history
        FROM unified_recipes
        WHERE processed = true
        AND (
          dish_name ILIKE $1 OR
          modern_translation ILIKE $1 OR
          taste_tags::text ILIKE $1 OR
          category ILIKE $1
        )
        `,
        [`%${search}%`]
      );
      dishes = result.rows;
    } else {
      const result = await pool.query(
        `
        SELECT id, dish_name AS name, modern_translation AS desc,
               taste_tags AS tags, main_ingredients AS ingredients,
               image_url AS image, geo_factors AS origin, cultural_story AS history
        FROM unified_recipes
        WHERE processed = true
        `
      );
      dishes = result.rows;
    }

    return NextResponse.json({ dishes, fromBackup: false });
  } catch (err) {
    console.error('[API] Database query failed, using backup:', err);

    try {
      let dishes;
      const search = new URL(request.url).searchParams.get('search');

      if (search) {
        dishes = await searchDishesFallback(search);
      } else {
        dishes = await getAllDishesFromBackup();
      }

      return NextResponse.json({ dishes, fromBackup: true });
    } catch (backupErr) {
      console.error('[API] Backup data also failed:', backupErr);
      return NextResponse.json({ dishes: [], fromBackup: true, error: 'No data available' }, { status: 500 });
    }
  }
}
