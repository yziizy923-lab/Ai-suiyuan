import { NextRequest, NextResponse } from 'next/server';
import { ZhipuAI } from 'zhipuai';

const client = new ZhipuAI({
  apiKey: process.env.ZHIPU_API_KEY!,
});

export interface CookingStep {
  step: number;
  title: string;
  desc: string;
}

/**
 * 根据菜品名称和描述，AI 生成详细的烹饪步骤
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dishName = searchParams.get('dish');
  const dishDesc = searchParams.get('desc') || '';
  const ingredients = searchParams.get('ingredients') || '';

  if (!dishName) {
    return NextResponse.json({
      success: false,
      error: '缺少菜品名称'
    }, { status: 400 });
  }

  try {
    const response = await client.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: `你是一位精通中华美食的大厨。你需要根据菜品信息，生成4-6个详细的烹饪步骤。

要求：
1. 每个步骤要有：序号、标题（简短有力）、详细描述（包含技巧和注意事项）
2. 步骤要符合中餐烹饪逻辑：备料→处理食材→烹饪→调味→装盘
3. 语言要简洁优雅，有随园风味
4. 每个步骤适合生成一张示意图

请用JSON数组格式返回：
[
  {"step": 1, "title": "步骤标题", "desc": "详细描述"}
]

注意：只需要返回JSON数组，不要其他内容。`,
        },
        {
          role: 'user',
          content: `请为这道菜生成烹饪步骤：

菜品名称：${dishName}
菜品描述：${dishDesc}
主料：${ingredients || '未知'}`,
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'AI 未返回内容'
      });
    }

    // 解析 JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    let steps: CookingStep[] = [];

    if (jsonMatch) {
      try {
        steps = JSON.parse(jsonMatch[0]);
      } catch {
        return NextResponse.json({
          success: false,
          error: '解析步骤失败'
        });
      }
    }

    return NextResponse.json({
      success: true,
      dishName,
      steps,
    });

  } catch (error) {
    console.error('[Cooking Steps] Error:', error);
    return NextResponse.json({
      success: false,
      error: '生成失败'
    });
  }
}
