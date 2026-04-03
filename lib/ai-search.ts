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
  longitude?: number;
  latitude?: number;
}

/** AI 返回结构 */
interface AIAnalysis {
  keywords: string[];
  reason: string;
}

/** ⭐ 同义词表（核心优化） */
const synonymMap: Record<string, string[]> = {
  '猪肉': ['猪肉', '排骨', '五花肉', '肘子', '蹄'],
  '鸡': ['鸡', '鸡肉', '鸡腿', '鸡翅'],
  '牛': ['牛肉', '牛腩'],
  '鱼': ['鱼', '鲫鱼', '鲤鱼', '鲈鱼'],
  '虾': ['虾', '虾仁'],
  '蛋': ['蛋', '鸡蛋'],
  '豆腐': ['豆腐', '豆腐干'],

  '清淡': ['清淡', '清爽', '不油腻'],
  '辣': ['辣', '麻辣', '香辣'],
  '酸': ['酸', '酸味', '酸辣'],
  '甜': ['甜', '甜味'],
};

/** ⭐ 扩展关键词 */
function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>();

  for (const word of keywords) {
    expanded.add(word);

    if (synonymMap[word]) {
      synonymMap[word].forEach(s => expanded.add(s));
    }

    // 反向匹配
    for (const key in synonymMap) {
      if (synonymMap[key].includes(word)) {
        synonymMap[key].forEach(s => expanded.add(s));
        expanded.add(key);
      }
    }
  }

  return Array.from(expanded);
}

/**
 * ⭐ 核心搜索（打分 + 排序）
 */
function searchWithKeywords(
  dishes: DishSearchResult[],
  keywords: string[]
): DishSearchResult[] {

  const expandedKeywords = expandKeywords(keywords);

  const results = dishes.map(dish => {
    let score = 0;
    const matchDetails: string[] = [];

    const name = dish.name?.toLowerCase() || '';
    const ingredients = dish.ingredients?.toLowerCase() || '';
    const desc = dish.desc?.toLowerCase() || '';
    const tags = dish.tags || [];

    for (const keyword of expandedKeywords) {
      const k = keyword.toLowerCase();

      if (name.includes(k)) {
        score += 5;
        matchDetails.push(`名称:${keyword}`);
      }

      if (ingredients.includes(k)) {
        score += 4;
        matchDetails.push(`食材:${keyword}`);
      }

      if (tags.some(tag => tag.toLowerCase().includes(k))) {
        score += 3;
        matchDetails.push(`口味:${keyword}`);
      }

      if (desc.includes(k)) {
        score += 1;
        matchDetails.push(`描述:${keyword}`);
      }
    }

    return {
      ...dish,
      score,
      matchReason: matchDetails.join(' | ')
    };
  });

  return results
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * ⭐ 主函数：AI + 搜索
 */
export async function searchDishesWithAI(
  userQuery: string,
  getAllDishes: () => Promise<DishSearchResult[]>
): Promise<{
  dishes: DishSearchResult[];
  aiSummary: string;
}> {

  const allDishes = await getAllDishes();

  if (!userQuery.trim()) {
    return {
      dishes: allDishes.slice(0, 10),
      aiSummary: '为您推荐热门菜品'
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: `
你是一个美食搜索理解助手。

任务：
提取用户最核心的搜索关键词。

关键词类型：
- 食材（鱼、鸡、豆腐）
- 口味（酸、辣、清淡）
- 做法（红烧、清蒸）

规则：
1. 提取 2-4 个关键词
2. 优先：食材 > 口味 > 做法
3. 不要解释
4. 只返回 JSON！

格式：
{
  "keywords": ["关键词"],
  "reason": "一句话说明"
}
`
        },
        {
          role: 'user',
          content: `用户输入: ${userQuery}`
        }
      ],
      temperature: 0.2,
    });

    const aiContent = response.choices[0]?.message?.content;

    if (!aiContent) {
      return fallbackSearch(userQuery, allDishes);
    }

    let analysis: AIAnalysis;

    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : aiContent;
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      console.error('AI解析失败:', e);
      return fallbackSearch(userQuery, allDishes);
    }

    const keywords = analysis.keywords || [];

    console.log('[AI关键词]:', keywords);

    const matched = searchWithKeywords(allDishes, keywords);

    return {
      dishes: matched.slice(0, 10),
      aiSummary: analysis.reason || `为您找到相关菜品`
    };

  } catch (error) {
    console.error('AI调用失败:', error);
    return fallbackSearch(userQuery, allDishes);
  }
}

/**
 * ⭐ fallback（无AI时）
 */
function fallbackSearch(
  query: string,
  dishes: DishSearchResult[]
): { dishes: DishSearchResult[]; aiSummary: string } {

  const words = query
    .toLowerCase()
    .replace(/[，。！？、""''（）]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const matched = searchWithKeywords(dishes, words);

  return {
    dishes: matched.slice(0, 10),
    aiSummary: `为您搜索 "${query}" 的结果`
  };
}