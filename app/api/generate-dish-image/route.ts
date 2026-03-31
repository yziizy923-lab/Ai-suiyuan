import { NextRequest, NextResponse } from 'next/server';
import { generateImage, buildDishPrompt } from '@/lib/sd-image';

type Body = {
  dish?: string;
  desc?: string;
  ancient?: string;
  method?: string;
};

async function runGenerate(
  dishName: string,
  dishDesc?: string,
  ancientMethod?: string,
  modernMethod?: string
) {
  const prompt = await buildDishPrompt(
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

  return NextResponse.json({
    success: true,
    dishName,
    imageBase64: result.imageBase64,
    imageUrl: `data:image/png;base64,${result.imageBase64}`,
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
  return runGenerate(
    dishName,
    searchParams.get('desc') || undefined,
    searchParams.get('ancient') || undefined,
    searchParams.get('method') || undefined
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
    body.method?.trim() || undefined
  );
}
