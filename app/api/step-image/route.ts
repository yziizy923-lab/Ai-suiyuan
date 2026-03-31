import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/sd-image';

const SD_API_URL = process.env.SD_API_URL || 'http://127.0.0.1:7860';
const LORA_NAME = process.env.SD_LORA_NAME || 'food_vectorshelf2';
const LORA_WEIGHT = parseFloat(process.env.SD_LORA_WEIGHT || '0.8');

interface StepImageRequest {
  dishName: string;
  stepTitle: string;
  stepDesc: string;
  stepNumber: number;
}

/**
 * 为单个步骤生成图片
 */
export async function POST(request: NextRequest) {
  try {
    const body: StepImageRequest = await request.json();
    const { dishName, stepTitle, stepDesc, stepNumber } = body;

    if (!dishName || !stepTitle) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 });
    }

    // 构建步骤图片的 prompt
    // 使用英文关键词让 SD 更容易理解
    const keywords: Record<string, string[]> = {
      '切': ['chopping', 'cutting vegetables', 'knife skills'],
      '洗': ['washing', 'rinsing ingredients', 'cleaning'],
      '炒': ['stir frying', 'wok cooking', 'frying in pan'],
      '煮': ['boiling', 'cooking in water', 'simmering'],
      '蒸': ['steaming', 'steamer basket', 'chinese steamer'],
      '炸': ['deep frying', 'crispy', 'oil cooking'],
      '焖': ['braising', 'slow cooking', 'covering pan'],
      '炖': ['stewing', 'slow simmering', 'soup cooking'],
      '烤': ['roasting', 'oven cooking', 'grilling'],
      '拌': ['mixing', 'tossing salad', 'seasoning'],
      '腌': ['marinating', 'seasoning meat', 'pickling'],
      '装盘': ['plating', 'serving dish', 'garnish'],
      '调味': ['seasoning', 'adding sauce', 'flavoring'],
      '热锅': ['heating pan', 'preheating wok', 'oil in hot pan'],
      '备料': ['preparing ingredients', 'ingredient prep', ' Mise en place'],
    };

    // 匹配关键词
    let matchedKeywords = '';
    for (const [key, values] of Object.entries(keywords)) {
      if (stepTitle.includes(key) || stepDesc.includes(key)) {
        matchedKeywords = values[0];
        break;
      }
    }

    // 构建英文 prompt
    const basePrompt = matchedKeywords
      ? `${matchedKeywords}, food photography, professional chef, high quality, realistic`
      : 'cooking preparation, food photography, professional chef, high quality, realistic';

    // 组合完整 prompt
    const fullPrompt = `${dishName} ${stepTitle}, ${basePrompt}, <lora:${LORA_NAME}:${LORA_WEIGHT}>`;
    const negativePrompt = 'low quality, blurry, distorted, watermark, text, cartoon, anime, drawing, illustration';

    // 调用 SD 生成图片
    const result = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        negative_prompt: negativePrompt,
        width: 768,
        height: 768,
        steps: 25,
        cfg_scale: 7,
        seed: -1, // 随机 seed
        sampler_name: 'DPM++ 2M Karras',
      }),
    });

    if (!result.ok) {
      const errorText = await result.text();
      return NextResponse.json({
        success: false,
        error: `SD API 错误: ${result.status}`,
        details: errorText
      });
    }

    const data = await result.json();
    const imageBase64 = data.images?.[0];

    if (!imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'SD 未返回图片'
      });
    }

    return NextResponse.json({
      success: true,
      stepNumber,
      imageBase64,
    });

  } catch (error) {
    console.error('[Step Image] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '生成失败'
    });
  }
}

/**
 * 批量生成步骤图片
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { steps, dishName } = body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({
        success: false,
        error: '缺少步骤数据'
      }, { status: 400 });
    }

    if (!dishName) {
      return NextResponse.json({
        success: false,
        error: '缺少菜品名称'
      }, { status: 400 });
    }

    // 并行生成所有步骤图片
    const promises = steps.map(async (step: { step: number; title: string; desc: string }) => {
      try {
        // 构建 prompt
        const fullPrompt = `${dishName} ${step.title}, cooking preparation, food photography, professional chef, high quality, realistic, <lora:${LORA_NAME}:${LORA_WEIGHT}>`;
        const negativePrompt = 'low quality, blurry, distorted, watermark, text, cartoon, anime, drawing, illustration';

        const result = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            negative_prompt: negativePrompt,
            width: 768,
            height: 768,
            steps: 25,
            cfg_scale: 7,
            seed: -1,
            sampler_name: 'DPM++ 2M Karras',
          }),
        });

        if (!result.ok) {
          return {
            stepNumber: step.step,
            success: false,
            error: `SD API 错误: ${result.status}`
          };
        }

        const data = await result.json();
        const imageBase64 = data.images?.[0];

        return {
          stepNumber: step.step,
          title: step.title,
          desc: step.desc,
          success: true,
          imageBase64,
        };
      } catch (error) {
        return {
          stepNumber: step.step,
          success: false,
          error: error instanceof Error ? error.message : '生成失败'
        };
      }
    });

    const results = await Promise.all(promises);

    return NextResponse.json({
      success: true,
      steps: results,
    });

  } catch (error) {
    console.error('[Batch Step Images] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '批量生成失败'
    });
  }
}
