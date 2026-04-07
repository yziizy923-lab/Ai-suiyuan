import { NextRequest, NextResponse } from "next/server";
import { ZhipuAI } from "zhipuai";

const client = new ZhipuAI({
  apiKey: process.env.ZHIPU_API_KEY!,
});

const SYSTEM_PROMPT = `你是一位渊博的清代饮食学者，精通《随园食单》，同时具备现代美食知识。
请用文言风格的现代汉语回答，语气典雅、有书卷气，但不失可读性。
回答应贴合袁枚"随园食单"的风格，涉猎广博、见解独到。
如涉及食材产地，请结合地理、气候与物产；如涉及风味，请描述具体口感与层次；如涉及古今对比，请分古代/现代两条线对比；如涉及文化故事，请联系历史人物与文献记载；如涉及地理成因，请关联水文/地形/气候。
控制在120~200字左右。`;

export async function POST(request: NextRequest) {
  let body: { question: string; dishName: string; originalText: string; modernMethod: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体须为 JSON" }, { status: 400 });
  }

  const { question, dishName, originalText, modernMethod } = body;

  if (!question?.trim()) {
    return NextResponse.json({ success: false, error: "缺少 question" }, { status: 400 });
  }

  try {
    const userContent = [
      `菜品名称：${dishName || "（未知）"}`,
      originalText ? `袁枚原文：${originalText}` : null,
      modernMethod ? `现代做法：${modernMethod}` : null,
      `用户提问：${question}`,
    ].filter(Boolean).join("\n");

    const response = await client.chat.completions.create({
      model: "glm-4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ success: false, error: "AI 未返回内容" });
    }

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error("[Chat] Error:", error);
    return NextResponse.json({ success: false, error: "生成失败" });
  }
}
