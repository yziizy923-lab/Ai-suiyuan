import { NextRequest, NextResponse } from 'next/server';
import { generateImage, buildDishPrompt } from '@/lib/sd-image';
import { pool } from '@/lib/db';

type Body = {
  dish?: string;
  desc?: string;
  ancient?: string;
  method?: string;
  /** 是否保存到数据库（通过菜品名称匹配） */
  saveToDb?: boolean;
};

async function saveImageToDb(dishName: string, imageUrl: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE unified_recipes SET image_url = $1 WHERE dish_name = $2 AND (image_url IS NULL OR image_url = '')`,
      [imageUrl, dishName]
    );
    console.log('[Generate Dish Image] 保存图片到数据库，受影响行数:', result.rowCount);
    return result.rowCount !== undefined && result.rowCount > 0;
  } catch (err) {
    console.error('[Generate Dish Image] 保存图片到数据库失败:', err);
    return false;
  }
}

async function runGenerate(
  dishName: string,
  dishDesc?: string,
  ancientMethod?: string,
  modernMethod?: string,
  saveToDb?: boolean
) {
  let prompt: string;
  let imageUrl: string;

  try {
    prompt = await buildDishPrompt(
      dishName,
      dishDesc || undefined,
      ancientMethod || undefined,
      modernMethod || undefined
    );

    console.log('[Generate Dish Image] 生成图片:', dishName);
    console.log('[Generate Dish Image] Prompt:', prompt.slice(0, 400));

    const result = await generateImage({
      prompt,
      width: 512,
      height: 512,
      steps: 20,
    });

    if (!result.success || !result.imageBase64) {
      return NextResponse.json({
        success: false,
        error: result.error || '生成失败',
        prompt,
      });
    }

    imageUrl = `data:image/png;base64,${result.imageBase64}`;
  } catch (err) {
    console.error('[Generate Dish Image] 生成过程出错:', err);
    return NextResponse.json({
      success: false,
      error: '生成失败',
    }, { status: 500 });
  }

  // 保存到数据库（独立处理，失败不影响返回）
  let savedToDb = false;
  if (saveToDb) {
    try {
      const result = await pool.query(
        `UPDATE unified_recipes SET image_url = $1 WHERE dish_name = $2 AND (image_url IS NULL OR image_url = '')`,
        [imageUrl, dishName]
      );
      savedToDb = result.rowCount !== undefined && result.rowCount > 0;
      console.log('[Generate Dish Image] 保存图片到数据库:', savedToDb ? '成功' : '无匹配记录');
    } catch (dbErr) {
      console.error('[Generate Dish Image] 保存到数据库失败:', dbErr);
      // 继续返回，数据库保存失败不影响图片返回
    }
  }

  return NextResponse.json({
    success: true,
    dishName,
    imageBase64: imageUrl.replace('data:image/png;base64,', ''),
    imageUrl,
    savedToDb,
    prompt,
  });
}

/**
 * GET：短参数（如步骤小图）仍可用；长原文请用 POST 避免 URL 截断
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dishName = searchParams.get('dish');
  if (!dishName) {
    return NextResponse.json({ success: false, error: '缺少菜品名称参数' }, { status: 400 });
  }
  const saveToDb = searchParams.get('save_to_db') === 'true';
  return runGenerate(
    dishName,
    searchParams.get('desc') || undefined,
    searchParams.get('ancient') || undefined,
    searchParams.get('method') || undefined,
    saveToDb
  );
}

/**
 * POST：JSON 传 desc / ancient / method，避免袁枚长文被浏览器或代理截断
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体须为 JSON' }, { status: 400 });
  }
  const dishName = body.dish?.trim();
  if (!dishName) {
    return NextResponse.json({ success: false, error: '缺少 dish' }, { status: 400 });
  }
  return runGenerate(
    dishName,
    body.desc?.trim() || undefined,
    body.ancient?.trim() || undefined,
    body.method?.trim() || undefined,
    body.saveToDb
  );
}
