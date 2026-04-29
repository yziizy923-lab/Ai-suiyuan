// app/api/dishes/origins/route.ts
import { NextRequest, NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';
import fs from 'fs';
import path from 'path';

// 强制使用 Node.js 运行时（需要访问文件系统和 Neo4j 驱动）
export const runtime = 'nodejs';

// ---------- Neo4j 连接配置 ----------
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '你的密码'; // 建议使用环境变量

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// ---------- 加载映射文件 ----------
const mappingFilePath = path.join(process.cwd(), 'data', 'geo_to_region.json');
const mappingData = JSON.parse(fs.readFileSync(mappingFilePath, 'utf-8'));

// 转换为字典方便查询
const factorMap: Record<string, Array<{
  name: string;
  lat: number;
  lng: number;
  desc: string;
}>> = {};
mappingData.forEach((item: any) => {
  factorMap[item.factor] = item.regions;
});

// ---------- 查询 Neo4j ----------
async function getGeoFactors(dishName: string): Promise<string[]> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (d:Dish {name: $dish})-[:CONTAINS]->(i:Ingredient)-[:HAS_FACTOR]->(g:GeoFactor)
       RETURN DISTINCT g.name AS factorName`,
      { dish: dishName }
    );
    return result.records.map(record => record.get('factorName'));
  } finally {
    await session.close();
  }
}

// ---------- API 处理函数 ----------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dish = searchParams.get('dish')?.trim();

  if (!dish) {
    return NextResponse.json({ error: '缺少菜品名参数 ?dish=xxx' }, { status: 400 });
  }

  try {
    const factors = await getGeoFactors(dish);
    if (factors.length === 0) {
      return NextResponse.json({ dish, points: [], message: '未找到关联地理因素' });
    }

    // 根据因素查找区域坐标（去重）
    const points: Array<{
      region: string;
      lat: number;
      lng: number;
      desc: string;
      factor: string;
    }> = [];
    const seen = new Set<string>();

    for (const factor of factors) {
      const regions = factorMap[factor];
      if (regions) {
        for (const region of regions) {
          const key = `${region.lat},${region.lng}`;
          if (!seen.has(key)) {
            seen.add(key);
            points.push({
              region: region.name,
              lat: region.lat,
              lng: region.lng,
              desc: region.desc,
              factor,
            });
          }
        }
      }
    }

    return NextResponse.json({ dish, points });
  } catch (error: any) {
    console.error('查询出错:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}