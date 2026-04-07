/**
 * 文生图并存储到数据库的独立脚本
 * 用法: npx tsx scripts/generate-and-store-images.ts
 *
 * 环境变量:
 *   POSTGRES_URL      - PostgreSQL 连接字符串
 *   SD_API_URL        - Stable Diffusion WebUI 地址 (默认: http://127.0.0.1:7860)
 *   SD_LORA_NAME      - LoRA 模型名称
 *   SD_LORA_WEIGHT    - LoRA 权重
 *   ZHIPU_API_KEY     - 智谱 API Key (用于翻译菜品描述)
 *   IMAGE_OUTPUT_DIR  - 图片输出目录 (默认: public/images/dishes)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { generateImage, buildDishPrompt } from '../lib/sd-image';

// ==================== 配置 ====================

const IMAGE_OUTPUT_DIR = process.env.IMAGE_OUTPUT_DIR || path.join(process.cwd(), 'public', 'images', 'dishes');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5'); // 每批生成多少张图片

// ==================== 数据库类型 ====================

interface DishRecord {
  id: number;
  dish_name: string;
  name?: string;
  image_url?: string | null;
  original_text?: string | null;
  modern_method?: string | null;
  modern_translation?: string | null;
}

// ==================== 数据库连接 ====================

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function queryDishesWithoutImages(): Promise<DishRecord[]> {
  const result = await pool.query(`
    SELECT id, dish_name, name, image_url,
           original_text, modern_method, modern_translation
    FROM dishes
    WHERE image_url IS NULL OR image_url = ''
    ORDER BY id
    LIMIT $1
  `, [BATCH_SIZE]);
  return result.rows;
}

async function updateDishImageUrl(dishId: number, imageUrl: string): Promise<void> {
  await pool.query(`
    UPDATE dishes
    SET image_url = $1, updated_at = NOW()
    WHERE id = $2
  `, [imageUrl, dishId]);
}

async function insertGenerationLog(
  dishId: number,
  dishName: string,
  prompt: string,
  imageUrl: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await pool.query(`
    INSERT INTO image_generation_logs (dish_id, dish_name, prompt, image_url, success, error_message, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `, [dishId, dishName, prompt, imageUrl, success, errorMessage || null]);
}

// ==================== 文件操作 ====================

async function ensureOutputDir(): Promise<void> {
  try {
    await fs.access(IMAGE_OUTPUT_DIR);
  } catch {
    await fs.mkdir(IMAGE_OUTPUT_DIR, { recursive: true });
    console.log(`[File] 创建输出目录: ${IMAGE_OUTPUT_DIR}`);
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

async function saveBase64Image(base64Data: string, dishName: string, dishId: number): Promise<string> {
  // 解码 base64 并保存为 PNG
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `${dishId}_${sanitizeFilename(dishName)}_${Date.now()}.png`;
  const filepath = path.join(IMAGE_OUTPUT_DIR, filename);

  await fs.writeFile(filepath, buffer);

  // 返回相对 URL 路径
  const publicPath = `/images/dishes/${filename}`;
  return publicPath;
}

// ==================== 图片生成主逻辑 ====================

async function generateAndStoreImage(dish: DishRecord): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const dishName = dish.dish_name || dish.name || `菜品${dish.id}`;
  const desc = dish.modern_translation || '';
  const ancient = dish.original_text || '';
  const method = dish.modern_method || '';

  console.log(`\n[${dish.id}] 开始生成: ${dishName}`);

  // 构建 prompt
  const prompt = await buildDishPrompt(dishName, desc, ancient, method);
  console.log(`[${dish.id}] Prompt: ${prompt.slice(0, 200)}...`);

  // 调用 Stable Diffusion
  const result = await generateImage({
    prompt,
    width: 512,
    height: 512,
    steps: 20,
  });

  if (!result.success || !result.imageBase64) {
    console.error(`[${dish.id}] 生成失败: ${result.error}`);
    return { success: false, error: result.error };
  }

  // 保存图片
  const imageUrl = await saveBase64Image(result.imageBase64, dishName, dish.id);
  console.log(`[${dish.id}] 图片已保存: ${imageUrl}`);

  // 更新数据库
  await updateDishImageUrl(dish.id, imageUrl);

  return { success: true, imageUrl };
}

// ==================== 主流程 ====================

async function initDatabase(): Promise<void> {
  // 创建日志表（如果不存在）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS image_generation_logs (
      id SERIAL PRIMARY KEY,
      dish_id INTEGER NOT NULL,
      dish_name VARCHAR(255),
      prompt TEXT,
      image_url VARCHAR(500),
      success BOOLEAN DEFAULT false,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 确保 dishes 表有 image_url 列
  const columnsExist = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'image_url'
  `);

  if (columnsExist.rows.length === 0) {
    console.warn('[DB] dishes 表缺少 image_url 列，请手动添加:');
    console.warn('  ALTER TABLE dishes ADD COLUMN image_url VARCHAR(500);');
    console.warn('  ALTER TABLE dishes ADD COLUMN updated_at TIMESTAMP;');
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('文生图并存储到数据库脚本');
  console.log('='.repeat(60));
  console.log(`输出目录: ${IMAGE_OUTPUT_DIR}`);
  console.log(`批次大小: ${BATCH_SIZE}`);
  console.log('');

  try {
    // 初始化
    await ensureOutputDir();
    await initDatabase();

    // 获取待处理的菜品
    const dishes = await queryDishesWithoutImages();

    if (dishes.length === 0) {
      console.log('\n没有需要生成图片的菜品。');
      return;
    }

    console.log(`\n找到 ${dishes.length} 个待生成图片的菜品\n`);

    let successCount = 0;
    let failCount = 0;

    for (const dish of dishes) {
      const dishName = dish.dish_name || dish.name || `菜品${dish.id}`;

      try {
        const result = await generateAndStoreImage(dish);

        // 记录日志
        await insertGenerationLog(
          dish.id,
          dishName,
          '', // prompt 可以不记录完整版本
          result.imageUrl || '',
          result.success,
          result.error
        );

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        console.error(`[${dish.id}] 处理失败: ${errorMessage}`);
        await insertGenerationLog(dish.id, dishName, '', '', false, errorMessage);
        failCount++;
      }

      // 每个任务后短暂休息，避免给 SD 太大压力
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 统计报告
    console.log('\n' + '='.repeat(60));
    console.log('生成完成');
    console.log('='.repeat(60));
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failCount}`);
    console.log(`总计: ${dishes.length}`);

  } catch (error) {
    console.error('脚本执行失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行
main().catch(console.error);
