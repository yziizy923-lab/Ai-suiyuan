import { NextResponse } from 'next/server';
import { pool } from '../../../../lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const dishId = parseInt(id, 10);

    if (isNaN(dishId)) {
      return NextResponse.json({ error: 'Invalid dish ID' }, { status: 400 });
    }

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

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Failed to fetch dish' }, { status: 500 });
  }
}