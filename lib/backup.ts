import { promises as fs } from 'fs';
import path from 'path';

const BACKUP_FILE_PATH = path.join(process.cwd(), 'data', 'unified_recipes_backup.json');

export interface BackupDish {
  id: number;
  name: string;
  desc: string;
  tags: string[];
  ingredients: string;
  image: string;
  origin: string;
  history: string;
  /** 与 API / 前端统一的驼峰字段（来自 original_text / modern_method） */
  originalText?: string;
  modernMethod?: string;
  dish_name?: string;
  original_text?: string;
  category?: string;
  modern_translation?: string;
  taste_tags?: string[];
  main_ingredients?: string[];
  modern_method?: string;
  geo_factors?: string;
  cultural_story?: string;
  processed?: boolean;
  /** 数据库中的坐标字段 */
  longitude?: number;
  latitude?: number;
}

interface RawBackupDish {
  dish_name?: string;
  original_text?: string;
  category?: string;
  modern_translation?: string;
  taste_tags?: string[];
  main_ingredients?: string[];
  modern_method?: string;
  geo_factors?: string;
  cultural_story?: string;
  processed?: boolean;
  id?: number;
  name?: string;
  desc?: string;
  tags?: string[];
  ingredients?: string;
  image?: string;
  origin?: string;
  history?: string;
  image_url?: string;
  /** 数据库坐标字段 */
  longitude?: number;
  latitude?: number;
}

let cachedBackup: BackupDish[] | null = null;

function transformToApiFormat(dish: RawBackupDish, index: number): BackupDish {
  return {
    id: dish.id ?? index + 1,
    name: dish.dish_name || dish.name || `菜品${index + 1}`,
    desc: dish.modern_translation || dish.desc || '',
    tags: dish.taste_tags || dish.tags || [],
    ingredients: Array.isArray(dish.main_ingredients)
      ? dish.main_ingredients.join(', ')
      : (dish.ingredients || ''),
    image: dish.image_url || dish.image || '',
    origin: dish.geo_factors || dish.origin || '',
    history: dish.cultural_story || dish.history || '',
    originalText: dish.original_text || '',
    modernMethod: dish.modern_method || '',
    dish_name: dish.dish_name,
    original_text: dish.original_text,
    category: dish.category,
    modern_translation: dish.modern_translation,
    taste_tags: dish.taste_tags,
    main_ingredients: dish.main_ingredients,
    modern_method: dish.modern_method,
    geo_factors: dish.geo_factors,
    cultural_story: dish.cultural_story,
    processed: dish.processed,
    longitude: dish.longitude,
    latitude: dish.latitude,
  };
}

async function loadBackupData(): Promise<BackupDish[]> {
  if (cachedBackup !== null && cachedBackup.length > 0) {
    console.log('[Backup] Using cached data, count:', cachedBackup.length);
    return cachedBackup;
  }

  try {
    console.log('[Backup] Loading from:', BACKUP_FILE_PATH);

    const data = await fs.readFile(BACKUP_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);

    let dishes: RawBackupDish[];
    if (Array.isArray(parsed)) {
      dishes = parsed;
    } else if (parsed.dishes && Array.isArray(parsed.dishes)) {
      dishes = parsed.dishes;
    } else {
      dishes = [];
    }

    console.log('[Backup] Loaded raw dishes count:', dishes.length);

    cachedBackup = dishes
      .filter((dish: RawBackupDish) => dish.processed !== false)
      .map((dish: RawBackupDish, index: number) => transformToApiFormat(dish, index));

    console.log('[Backup] Processed dishes count:', cachedBackup.length);

    return cachedBackup;
  } catch (err) {
    console.error('[Backup] Failed to load backup file:', err);
    console.error('[Backup] Current working dir:', process.cwd());
    cachedBackup = [];
    return [];
  }
}

export async function getAllDishesFromBackup(): Promise<BackupDish[]> {
  return loadBackupData();
}

export async function searchDishesFromBackup(keyword: string): Promise<BackupDish[]> {
  const dishes = await loadBackupData();
  const lowerKeyword = keyword.toLowerCase();

  return dishes.filter((dish) => {
    return (
      dish.name?.toLowerCase().includes(lowerKeyword) ||
      dish.desc?.toLowerCase().includes(lowerKeyword) ||
      dish.history?.toLowerCase().includes(lowerKeyword) ||
      dish.category?.toLowerCase().includes(lowerKeyword) ||
      dish.original_text?.toLowerCase().includes(lowerKeyword) ||
      dish.tags?.some((tag: string) => tag.toLowerCase().includes(lowerKeyword)) ||
      dish.ingredients?.toLowerCase().includes(lowerKeyword)
    );
  });
}

export async function getDishByIdFromBackup(id: number): Promise<BackupDish | null> {
  const dishes = await loadBackupData();
  return dishes.find((dish) => dish.id === id) || null;
}

export async function refreshBackupCache(): Promise<void> {
  cachedBackup = null;
  await loadBackupData();
}
