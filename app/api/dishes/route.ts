import { NextResponse } from 'next/server';
import { pool } from '../../../lib/db';

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

    return NextResponse.json({ dishes });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ dishes: [] }, { status: 500 });
  }
}

