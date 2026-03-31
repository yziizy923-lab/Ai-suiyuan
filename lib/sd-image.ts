/**
 * 调用 Stable Diffusion WebUI API 生成图片
 */

const SD_API_URL = process.env.SD_API_URL || 'http://127.0.0.1:7860';

// LoRA 配置
const LORA_NAME = process.env.SD_LORA_NAME || 'food_vectorshelf2';
const LORA_WEIGHT = parseFloat(process.env.SD_LORA_WEIGHT || '0.65');
const DEFAULT_STEPS = parseInt(process.env.SD_STEPS || '20');
const DEFAULT_WIDTH = parseInt(process.env.SD_WIDTH || '512');
const DEFAULT_HEIGHT = parseInt(process.env.SD_HEIGHT || '512');

// 智谱 AI（翻译古代原文）
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY!;

export interface GenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}

export interface GenerationResult {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  error?: string;
}

/** 清理 LLM 输出，避免 ```、中文前缀等破坏 SD */
function sanitizeSdPrompt(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
  s = s.replace(/^[\s*"']+|[\s*"']+$/g, '');
  s = s.replace(/^(prompt|输出|答案)[:：]\s*/i, '');
  return s.replace(/\s+/g, ' ').slice(0, 600);
}

/**
 * 用智谱 AI：综合「菜名 + 现代译文 + 袁枚原文 + 现代做法」→ 英文 SD 正向词
 * 必须可辨认的真实菜肴，禁止抽象图案。
 */
async function translateDishForImage(
  dishName: string,
  dishDesc?: string,
  ancientText?: string,
  modernMethod?: string
): Promise<string> {
  if (!ZHIPU_API_KEY) return '';

  const descTrim = (dishDesc || '').trim().slice(0, 600);
  const ancientTrim = (ancientText || '').trim().slice(0, 900);
  const methodTrim = (modernMethod || '').trim().slice(0, 900);

  const descSection = descTrim ? `\n【现代译文】${descTrim}` : '';
  const ancientSection = ancientTrim ? `\n【袁枚原文】${ancientTrim}` : '';
  const modernSection = methodTrim ? `\n【现代做法】${methodTrim}` : '';

  if (!descSection && !ancientSection && !modernSection) return '';

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: `你是 Stable Diffusion 食物摄影 Prompt 工程师。用户会提供中文菜名和《随园食单》相关文字（现代译文、古文、现代步骤）。你必须根据这些内容写出「能一眼看出是什么菜」的英文正向 prompt。

硬性规则：
1. 只输出一行英文，逗号分隔 tags，不要中文、不要 markdown、不要解释、不要引号。
2. 第一句必须点明具体食物实体（如 mussels in shell, leek dumplings, sliced pork belly, long beans stir-fry, water bamboo shoots, flat beans with pork）。
3. 根据【现代译文】【现代做法】写可见细节：颜色、酱汁、是否带壳、是否切片、炒锅还是汤碗等。若古文与译文矛盾，以现代译文/做法为准。
4. 必须包含：macro close-up, realistic cooked food, filling the frame, not empty plate.
5. 禁止：abstract, geometric, circles, mandala, vector, illustration, empty plate, no food, surreal, eye, pupil.

长度约 80–140 英文词。`,
          },
          {
            role: 'user',
            content: `菜名：${dishName}${descSection}${ancientSection}${modernSection}`,
          },
        ],
        temperature: 0.15,
        max_tokens: 280,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const cleaned = content ? sanitizeSdPrompt(content) : '';
    if (cleaned) {
      console.log('[SD-Image] AI prompt:', cleaned.slice(0, 120));
    }
    return cleaned;
  } catch (err) {
    console.error('[SD-Image] 翻译菜品描述失败:', err);
    return '';
  }
}

/**
 * 构建菜品 prompt
 */
export async function buildDishPrompt(
  dishName: string,
  dishDesc?: string,
  ancientMethod?: string,
  modernMethod?: string
): Promise<string> {
  const englishDesc = await translateDishForImage(
    dishName,
    dishDesc,
    ancientMethod,
    modernMethod
  );

  if (englishDesc) {
    return `${englishDesc}, chinese cuisine, ${dishName}`;
  }

  const desc = dishDesc ? dishDesc.slice(0, 120).replace(/\s+/g, ' ').trim() : '';
  return `${dishName}, ${desc}, macro close-up of realistic cooked chinese food, filling the frame, appetizing, on ceramic plate, food photography`;
}

/**
 * 使用 SD WebUI API 生成图片
 */
export async function generateImage(options: GenerationOptions): Promise<GenerationResult> {
  const {
    prompt,
    negativePrompt = '',
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    steps = DEFAULT_STEPS,
    seed = -1,
  } = options;

  const fullPrompt = `${prompt}, <lora:${LORA_NAME}:${LORA_WEIGHT}>`;
  const negative = negativePrompt ||
    'low quality, blurry, distorted, watermark, text, letters, logo, cartoon, anime, ' +
    'abstract, geometric pattern, concentric circles, radial symmetry, mandala, fractal, ' +
    'vector art, flat illustration, digital art, surreal, empty plate, no food, bare plate, ' +
    'eye, pupil, iris, scientific diagram, microscope, ' +
    'noodles, pasta, wheat noodles, misaligned, deformed hands';

  try {
    const response = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        negative_prompt: negative,
        width,
        height,
        steps,
        cfg_scale: 7,
        seed,
        sampler_name: 'DPM++ 2M Karras',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SD API 错误: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    const imageBase64 = data.images?.[0];

    if (!imageBase64) {
      return {
        success: false,
        error: 'SD 未返回图片',
      };
    }

    return {
      success: true,
      imageBase64,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      error: `网络错误: ${errorMessage}`,
    };
  }
}
