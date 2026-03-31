import { NextResponse } from 'next/server';
import { pool } from '../../../lib/db';
import { searchDishesWithAI, DishSearchResult } from '../../../lib/ai-search';
import { getAllDishesFromBackup } from '../../../lib/backup';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const useAI = searchParams.get('use_ai') !== 'false'; // 默认启用 AI

    // 如果启用 AI 且有搜索词
    if (useAI && search.trim()) {
      console.log('[API] Using AI search for:', search);

      // 获取所有菜品（用于 AI 匹配）
      let allDishes: DishSearchResult[] = [];

      try {
        // 先从数据库获取所有已处理的菜品
        const dbResult = await pool.query(
          `SELECT id, dish_name AS name, modern_translation AS desc,
                 taste_tags AS tags, main_ingredients AS ingredients,
                 image_url AS image, geo_factors AS origin, cultural_story AS history,
                 original_text, modern_method
          FROM unified_recipes
          WHERE processed = true`
        );
        allDishes = dbResult.rows.map(dish => ({
          id: dish.id,
          name: dish.name,
          desc: dish.desc || "",
          tags: Array.isArray(dish.tags) ? dish.tags : [],
          ingredients: Array.isArray(dish.ingredients) ? dish.ingredients.join(', ') : '',
          image: dish.image || `https://picsum.photos/seed/${dish.id}/400/400`,
          origin: dish.origin,
          history: dish.history,
          originalText: dish.original_text || "",
          modernMethod: dish.modern_method || ""
        }));
      } catch (dbError) {
        console.log('[API] Database unavailable, using backup data');
        allDishes = await getAllDishesFromBackup() as DishSearchResult[];
      }

      // 调用 AI 搜索
      const result = await searchDishesWithAI(search, async () => allDishes);
      return NextResponse.json({ 
        dishes: result.dishes, 
        aiSummary: result.aiSummary,
        fromBackup: false 
      });
    }

    // 传统搜索（无 AI 或无搜索词时）
    let dishes;

    if (search) {
      const result = await pool.query(
        `SELECT id, dish_name AS name, modern_translation AS desc,
               taste_tags AS tags, main_ingredients AS ingredients,
               image_url AS image, geo_factors AS origin, cultural_story AS history,
               original_text, modern_method
        FROM unified_recipes
        WHERE processed = true
        AND (
          dish_name ILIKE $1 OR
          modern_translation ILIKE $1 OR
          taste_tags::text ILIKE $1 OR
          category ILIKE $1
        )`,
        [`%${search}%`]
      );
      dishes = result.rows.map(dish => ({ ...dish, originalText: dish.original_text || "", modernMethod: dish.modern_method || "" }));
    } else {
      const result = await pool.query(
        `SELECT id, dish_name AS name, modern_translation AS desc,
               taste_tags AS tags, main_ingredients AS ingredients,
               image_url AS image, geo_factors AS origin, cultural_story AS history,
               original_text, modern_method
        FROM unified_recipes
        WHERE processed = true`
      );
      dishes = result.rows.map(dish => ({ ...dish, originalText: dish.original_text || "", modernMethod: dish.modern_method || "" }));
    }

    return NextResponse.json({ dishes, fromBackup: false });
  } catch (err) {
    console.error('[API] Error:', err);
    return NextResponse.json({ dishes: [], fromBackup: true, error: 'Query failed' }, { status: 500 });
  }
}
