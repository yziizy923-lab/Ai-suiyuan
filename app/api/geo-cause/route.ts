import { NextRequest, NextResponse } from "next/server";
import { ZhipuAI } from "zhipuai";

const client = new ZhipuAI({
  apiKey: process.env.ZHIPU_API_KEY!,
});

type Body = {
  dish?: string;
  ingredient?: string;
  placeName?: string;
  lng?: number;
  lat?: number;
  context?: {
    rivers?: string[];
    terrain?: string[];
    climate?: string[];
    notes?: string[];
  };
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体须为 JSON" }, { status: 400 });
  }

  const dish = body.dish?.trim() || "王太守八宝豆腐";
  const ingredient = body.ingredient?.trim();
  const placeName = body.placeName?.trim();

  if (!ingredient || !placeName) {
    return NextResponse.json(
      { success: false, error: "缺少 ingredient 或 placeName" },
      { status: 400 }
    );
  }

  const lng = typeof body.lng === "number" ? body.lng : undefined;
  const lat = typeof body.lat === "number" ? body.lat : undefined;
  const rivers = body.context?.rivers?.filter(Boolean) ?? [];
  const terrain = body.context?.terrain?.filter(Boolean) ?? [];
  const climate = body.context?.climate?.filter(Boolean) ?? [];
  const notes = body.context?.notes?.filter(Boolean) ?? [];

  try {
    const response = await client.chat.completions.create({
      model: "glm-4-flash",
      messages: [
        {
          role: "system",
          content: `你是一位严谨的中国地理与风物学者，同时懂食材与传统工艺。

你需要为“地理成因”模块生成一段解释，回答“为什么是这里”，并把风味/工艺与当地地理条件联系起来。

写作要求：
- 只写 80~160 字中文（不分段也可）
- 语气克制、有学问但不堆砌术语；允许一两处古风措辞
- 必须包含：水文/水系、地形、气候（各至少提到一次）
- 尽量避免虚构具体的可核查细节（例如“某矿盐”“某专有猪种”），如不确定请用更稳妥的描述
- 不要使用列表、不要输出标题、不要输出引号
`,
        },
        {
          role: "user",
          content: `菜品：${dish}
食材：${ingredient}
产地：${placeName}${lng !== undefined && lat !== undefined ? `（${lng.toFixed(2)}, ${lat.toFixed(2)}）` : ""}

可用线索（可能为空）：
- 水系：${rivers.join("、") || "无"}
- 地形：${terrain.join("、") || "无"}
- 气候：${climate.join("、") || "无"}
- 备注：${notes.join("；") || "无"}

请生成“为什么这里适合产出/制作该食材”的地理成因解释。`,
        },
      ],
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ success: false, error: "AI 未返回内容" });
    }

    return NextResponse.json({
      success: true,
      dish,
      ingredient,
      placeName,
      content,
    });
  } catch (error) {
    console.error("[Geo Cause] Error:", error);
    return NextResponse.json({ success: false, error: "生成失败" });
  }
}

