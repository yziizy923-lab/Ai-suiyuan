import { ZhipuAI } from 'zhipuai';

const client = new ZhipuAI({
  apiKey: process.env.ZHIPU_API_KEY!,
});

export interface DishSearchResult {
  id: number;
  name: string;
  desc: string;
  tags: string[];
  ingredients: string;
  image: string;
  origin: string;
  history: string;
  originalText?: string;
  modernMethod?: string;
  matchReason?: string;
  /** 数据库中的坐标字段 */
  longitude?: number;
  latitude?: number;
}

interface AIAnalysis {
  keywords: string[];
  reason: string;
  matchMode: string;
}

/**
 * 使用智谱 AI 理解用户搜索意图，提取关键词并搜索菜品
 */
export async function searchDishesWithAI(
  userQuery: string,
  getAllDishes: () => Promise<DishSearchResult[]>
): Promise<{
  dishes: DishSearchResult[];
  aiSummary: string;
}> {
  // 先获取所有菜品
  const allDishes = await getAllDishes();

  if (!userQuery.trim()) {
    return { dishes: allDishes.slice(0, 10), aiSummary: '以下是所有菜品推荐' };
  }

  try {
    // 调用智谱 AI 分析用户意图
    const response = await client.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: `你是一个美食搜索助手。用户会用自然语言描述他们想吃的菜品。

你需要从用户的描述中提取搜索关键词，并在以下菜品列表中进行匹配。

菜品列表字段说明：
- name: 菜品名称
- desc: 菜品描述/现代翻译
- tags: 口味标签（如：鲜、甜、咸、清淡、油腻等）
- ingredients: 主要食材
- history: 历史/典故

匹配策略：
1. 优先匹配菜品名称
2. 其次匹配食材
3. 再匹配口味标签
4. 最后匹配描述和历史

请用JSON格式返回分析结果：
{
  "keywords": ["提取的关键词数组"],
  "reason": "简短解释匹配逻辑",
  "matchMode": "name|ingredient|tag|desc"
}

注意：
- 关键词要精准，便于数据库模糊匹配
- 如果用户说的是"我想吃酸的"，应该提取"酸"作为口味标签
- 如果用户说的是"鱼肉"，应该提取"鱼"和"肉"作为食材
- 只提取最重要的2-3个关键词`,
        },
        {
          role: 'user',
          content: `用户输入: "${userQuery}"
          
菜品列表（共${allDishes.length}道菜）:
${allDishes.slice(0, 50).map(d => `${d.name}|${d.desc}|${d.tags?.join(',')}|${d.ingredients}`).join('\n')}`,
        },
      ],
      temperature: 0.3,
    });

    const aiContent = response.choices[0]?.message?.content;
    if (!aiContent) {
      // AI 调用失败，回退到简单匹配
      return fallbackSearch(userQuery, allDishes);
    }

    // 解析 AI 返回的 JSON
    let analysis: AIAnalysis;
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(aiContent);
      }
    } catch (parseError) {
      console.error('[AI Search] Parse error:', parseError);
      return fallbackSearch(userQuery, allDishes);
    }

    const { keywords, reason } = analysis;
    console.log('[AI Search] Extracted keywords:', keywords);

    // 使用提取的关键词进行搜索
    const matchedDishes = searchWithKeywords(allDishes, keywords);

    return {
      dishes: matchedDishes.slice(0, 10),
      aiSummary: reason || '已为您找到相关菜品',
    };
  } catch (error) {
    console.error('[AI Search] Error:', error);
    // AI 调用失败，回退到简单匹配
    return fallbackSearch(userQuery, allDishes);
  }
}

/**
 * 使用关键词搜索菜品
 */
function searchWithKeywords(
  dishes: DishSearchResult[],
  keywords: string[]
): DishSearchResult[] {
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  return dishes.filter(dish => {
    return lowerKeywords.some(keyword => {
      const nameMatch = dish.name?.toLowerCase().includes(keyword);
      const ingredientMatch = dish.ingredients?.toLowerCase().includes(keyword);
      const tagMatch = dish.tags?.some((tag: string) =>
        tag.toLowerCase().includes(keyword)
      );
      const descMatch = dish.desc?.toLowerCase().includes(keyword);

      return nameMatch || ingredientMatch || tagMatch || descMatch;
    });
  }).map(dish => ({
    ...dish,
    matchReason: `匹配关键词: ${keywords.join(', ')}`,
  }));
}

/**
 * 回退方案：简单的关键词匹配
 */
function fallbackSearch(
  query: string,
  dishes: DishSearchResult[]
): { dishes: DishSearchResult[]; aiSummary: string } {
  const words = query.toLowerCase().replace(/[，。！？、""''（）]/g, ' ').split(/\s+/).filter(Boolean);

  const matched = searchWithKeywords(dishes, words);

  return {
    dishes: matched.slice(0, 10),
    aiSummary: `已为您搜索"${query}"相关菜品`,
  };
}
