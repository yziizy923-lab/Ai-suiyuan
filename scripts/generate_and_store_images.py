#!/usr/bin/env python3
"""
文生图并存储到数据库的独立脚本
用法: python scripts/generate_and_store_images.py

环境变量:
  POSTGRES_URL      - PostgreSQL 连接字符串
  SD_API_URL        - Stable Diffusion WebUI 地址 (默认: http://127.0.0.1:7860)
  SD_LORA_NAME      - LoRA 模型名称
  SD_LORA_WEIGHT    - LoRA 权重
  ZHIPU_API_KEY     - 智谱 API Key (用于翻译菜品描述)
  IMAGE_OUTPUT_DIR  - 图片输出目录 (默认: public/images/dishes)
  BATCH_SIZE        - 每批处理数量 (默认: 5)
"""

import os
import sys
import time
import json
import base64
import re
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

import requests
import psycopg2
from psycopg2.extras import RealDictCursor


# ==================== 配置 ====================

IMAGE_OUTPUT_DIR = os.getenv("IMAGE_OUTPUT_DIR", "public/images/dishes")
SD_API_URL = os.getenv("SD_API_URL", "http://127.0.0.1:7860")
LORA_NAME = os.getenv("SD_LORA_NAME", "food_vectorshelf2")
LORA_WEIGHT = float(os.getenv("SD_LORA_WEIGHT", "0.65"))
DEFAULT_STEPS = int(os.getenv("SD_STEPS", "20"))
DEFAULT_WIDTH = int(os.getenv("SD_WIDTH", "512"))
DEFAULT_HEIGHT = int(os.getenv("SD_HEIGHT", "512"))
ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY", "")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5"))

# PostgreSQL 连接配置
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_NAME", "postgres"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "0000"),
}

# JSON 备份文件路径
JSON_BACKUP_PATH = Path(__file__).parent.parent / "data" / "unified_recipes_backup.json"

NEGATIVE_PROMPT = (
    "low quality, blurry, distorted, watermark, text, letters, logo, cartoon, anime, "
    "abstract, geometric pattern, concentric circles, radial symmetry, mandala, fractal, "
    "vector art, flat illustration, digital art, surreal, empty plate, no food, bare plate, "
    "eye, pupil, iris, scientific diagram, microscope, "
    "noodles, pasta, wheat noodles, misaligned, deformed hands"
)

# ==================== 数据模型 ====================

@dataclass
class DishRecord:
    id: int
    dish_name: str
    category: Optional[str]
    image_url: Optional[str]
    original_text: Optional[str]
    modern_method: Optional[str]
    modern_translation: Optional[str]

# ==================== 数据库操作 ====================

def get_db_connection():
    """创建数据库连接"""
    return psycopg2.connect(
        host=DB_CONFIG["host"],
        port=DB_CONFIG["port"],
        dbname=DB_CONFIG["dbname"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        cursor_factory=RealDictCursor
    )

def init_database():
    """初始化数据库表结构"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 创建日志表
            cur.execute("""
                CREATE TABLE IF NOT EXISTS image_generation_logs (
                    id SERIAL PRIMARY KEY,
                    dish_id INTEGER NOT NULL,
                    dish_name VARCHAR(255),
                    image_url VARCHAR(500),
                    success BOOLEAN DEFAULT false,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)

            # 检查 unified_recipes 表是否有 image_url 和 updated_at 列
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'unified_recipes' AND column_name = 'image_url'
            """)
            if not cur.fetchone():
                print("[DB] 正在添加 image_url 列到 unified_recipes 表...")
                cur.execute("ALTER TABLE unified_recipes ADD COLUMN image_url VARCHAR(500);")

            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'unified_recipes' AND column_name = 'updated_at'
            """)
            if not cur.fetchone():
                print("[DB] 正在添加 updated_at 列到 unified_recipes 表...")
                cur.execute("ALTER TABLE unified_recipes ADD COLUMN updated_at TIMESTAMP;")

        conn.commit()
        print("[DB] 数据库初始化完成")
    finally:
        conn.close()

def get_dishes_without_images() -> list[DishRecord]:
    """获取所有菜品（不管是否已有图片）"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, dish_name, category, image_url,
                       original_text, modern_method, modern_translation
                FROM unified_recipes
                WHERE processed = TRUE
                ORDER BY id
            """)
            rows = cur.fetchall()
            return [
                DishRecord(
                    id=row['id'],
                    dish_name=row['dish_name'] or '',
                    category=row.get('category'),
                    image_url=row.get('image_url'),
                    original_text=row.get('original_text'),
                    modern_method=row.get('modern_method'),
                    modern_translation=row.get('modern_translation')
                )
                for row in rows
            ]
    finally:
        conn.close()

def update_dish_image_url(dish_id: int, image_url: str):
    """更新菜品的图片 URL"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE unified_recipes
                SET image_url = %s, updated_at = NOW()
                WHERE id = %s
            """, (image_url, dish_id))
        conn.commit()
    finally:
        conn.close()

def insert_generation_log(
    dish_id: int,
    dish_name: str,
    image_url: str,
    success: bool,
    error_message: Optional[str] = None
):
    """插入生成日志"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO image_generation_logs (dish_id, dish_name, image_url, success, error_message, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (dish_id, dish_name, image_url, success, error_message))
        conn.commit()
    finally:
        conn.close()

def update_json_backup(dish_name: str, image_url: str) -> bool:
    """更新 JSON 备份文件中的图片地址"""
    try:
        if not JSON_BACKUP_PATH.exists():
            print(f"    [JSON] 备份文件不存在: {JSON_BACKUP_PATH}")
            return False

        with open(JSON_BACKUP_PATH, "r", encoding="utf-8") as f:
            recipes = json.load(f)

        updated = False
        for recipe in recipes:
            # 匹配菜品名称（去掉空格后比较）
            if recipe.get("dish_name", "").strip() == dish_name.strip():
                recipe["image_url"] = image_url
                recipe["image_generated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                updated = True
                print(f"    [JSON] 已更新备份: {dish_name}")
                break

        if updated:
            with open(JSON_BACKUP_PATH, "w", encoding="utf-8") as f:
                json.dump(recipes, f, ensure_ascii=False, indent=2)
            return True
        else:
            print(f"    [JSON] 未找到匹配的菜品: {dish_name}")
            return False

    except Exception as e:
        print(f"    [JSON] 更新备份失败: {e}")
        return False

# ==================== 智谱 AI 翻译 ====================

def sanitize_sd_prompt(raw: str) -> str:
    """清理 LLM 输出"""
    s = raw.strip()
    s = re.sub(r'^```[a-z]*\s*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s*```$', '', s)
    s = re.sub(r'^[\s*"\'\u201c\u201d]+', '', s)
    s = re.sub(r'^[\s*"\'\u201c\u201d]+', '', s)
    s = re.sub(r'^(prompt|输出|答案)[:：]\s*', '', s, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', s)[:600]

def translate_dish_for_image(
    dish_name: str,
    dish_desc: Optional[str] = None,
    ancient_text: Optional[str] = None,
    modern_method: Optional[str] = None
) -> str:
    """用智谱 AI 翻译菜品描述为英文 prompt"""
    if not ZHIPU_API_KEY:
        return ""

    desc_trim = (dish_desc or "").strip()[:600]
    ancient_trim = (ancient_text or "").strip()[:900]
    method_trim = (modern_method or "").strip()[:900]

    desc_section = f"\n【现代译文】{desc_trim}" if desc_trim else ""
    ancient_section = f"\n【袁枚原文】{ancient_trim}" if ancient_trim else ""
    modern_section = f"\n【现代做法】{method_trim}" if method_trim else ""

    if not desc_section and not ancient_section and not modern_section:
        return ""

    try:
        response = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {ZHIPU_API_KEY}",
            },
            json={
                "model": "glm-4-flash",
                "messages": [
                    {
                        "role": "system",
                        "content": """你是 Stable Diffusion 食物摄影 Prompt 工程师。用户会提供中文菜名和《随园食单》相关文字（现代译文、古文、现代步骤）。你必须根据这些内容写出「能一眼看出是什么菜」的英文正向 prompt。

硬性规则：
1. 只输出一行英文，逗号分隔 tags，不要中文、不要 markdown、不要解释、不要引号。
2. 第一句必须点明具体食物实体（如 mussels in shell, leek dumplings, sliced pork belly, long beans stir-fry, water bamboo shoots, flat beans with pork）。
3. 根据【现代译文】【现代做法】写可见细节：颜色、酱汁、是否带壳、是否切片、炒锅还是汤碗等。若古文与译文矛盾，以现代译文/做法为准。
4. 必须包含：macro close-up, realistic cooked food, filling the frame, not empty plate.
5. 禁止：abstract, geometric, circles, mandala, vector, illustration, empty plate, no food, surreal, eye, pupil.

长度约 80–140 英文词。"""
                    },
                    {
                        "role": "user",
                        "content": f"菜名：{dish_name}{desc_section}{ancient_section}{modern_section}"
                    }
                ],
                "temperature": 0.15,
                "max_tokens": 280,
            },
            timeout=60
        )

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        cleaned = sanitize_sd_prompt(content)

        if cleaned:
            print(f"    [AI] 生成的 Prompt: {cleaned[:120]}...")

        return cleaned

    except Exception as e:
        print(f"    [AI] 翻译失败: {e}")
        return ""

def build_dish_prompt(
    dish_name: str,
    dish_desc: Optional[str] = None,
    ancient_method: Optional[str] = None,
    modern_method: Optional[str] = None
) -> str:
    """构建菜品 prompt"""
    english_desc = translate_dish_for_image(
        dish_name,
        dish_desc,
        ancient_method,
        modern_method
    )

    if english_desc:
        return f"{english_desc}, chinese cuisine, {dish_name}"

    desc = (dish_desc or "")[:120].replace(" ", "").strip()
    return f"{dish_name}, {desc}, macro close-up of realistic cooked chinese food, filling the frame, appetizing, on ceramic plate, food photography"

# ==================== Stable Diffusion ====================

def generate_image(prompt: str, width: int = 512, height: int = 512, steps: int = 20) -> dict:
    """调用 SD WebUI API 生成图片"""
    full_prompt = f"{prompt}, <lora:{LORA_NAME}:{LORA_WEIGHT}>"

    try:
        response = requests.post(
            f"{SD_API_URL}/sdapi/v1/txt2img",
            json={
                "prompt": full_prompt,
                "negative_prompt": NEGATIVE_PROMPT,
                "width": width,
                "height": height,
                "steps": steps,
                "cfg_scale": 7,
                "seed": -1,
                "sampler_name": "DPM++ 2M Karras",
            },
            timeout=300
        )

        if not response.ok:
            return {"success": False, "error": f"SD API 错误: {response.status_code}"}

        data = response.json()
        image_base64 = data.get("images", [None])[0]

        if not image_base64:
            return {"success": False, "error": "SD 未返回图片"}

        return {"success": True, "imageBase64": image_base64}

    except requests.exceptions.Timeout:
        return {"success": False, "error": "SD 请求超时"}
    except Exception as e:
        return {"success": False, "error": f"网络错误: {e}"}

# ==================== 文件操作 ====================

def ensure_output_dir():
    """确保输出目录存在"""
    output_path = Path(IMAGE_OUTPUT_DIR)
    if not output_path.exists():
        output_path.mkdir(parents=True, exist_ok=True)
        print(f"[File] 创建输出目录: {IMAGE_OUTPUT_DIR}")

def sanitize_filename(name: str) -> str:
    """清理文件名"""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '_', name)
    return name[:100]

def save_base64_image(base64_data: str, dish_name: str, dish_id: int) -> str:
    """保存 base64 图片到文件"""
    image_bytes = base64.b64decode(base64_data)
    filename = f"{dish_id}_{sanitize_filename(dish_name)}_{int(time.time())}.png"
    filepath = Path(IMAGE_OUTPUT_DIR) / filename

    with open(filepath, "wb") as f:
        f.write(image_bytes)

    return f"/images/dishes/{filename}"

# ==================== 主逻辑 ====================

def generate_and_store_image(dish: DishRecord) -> dict:
    """生成并存储单张图片"""
    dish_name = dish.dish_name or dish.name or f"菜品{dish.id}"
    print(f"\n[{dish.id}] 开始生成: {dish_name}")

    # 构建 prompt
    prompt = build_dish_prompt(
        dish_name,
        dish.modern_translation,
        dish.original_text,
        dish.modern_method
    )
    print(f"    [SD] 调用 Stable Diffusion...")

    # 生成图片
    result = generate_image(prompt, width=DEFAULT_WIDTH, height=DEFAULT_HEIGHT, steps=DEFAULT_STEPS)

    if not result.get("success"):
        print(f"    [Error] {result.get('error', '未知错误')}")
        return {"success": False, "error": result.get("error")}

    # 保存图片
    image_url = save_base64_image(result["imageBase64"], dish_name, dish.id)
    print(f"    [File] 图片已保存: {image_url}")

    # 更新数据库
    update_dish_image_url(dish.id, image_url)
    print(f"    [DB] 数据库已更新")

    # 更新 JSON 备份文件
    update_json_backup(dish_name, image_url)

    return {"success": True, "imageUrl": image_url}

# ==================== 入口 ====================

def main():
    print("=" * 60)
    print("文生图并存储到数据库脚本")
    print("=" * 60)
    print(f"输出目录: {IMAGE_OUTPUT_DIR}")
    print(f"批次大小: {BATCH_SIZE}")
    print(f"SD 地址: {SD_API_URL}")
    print("")

    # 初始化
    ensure_output_dir()
    init_database()

    # 获取待处理菜品
    dishes = get_dishes_without_images()

    if not dishes:
        print("\n没有需要生成图片的菜品。")
        return

    print(f"\n找到 {len(dishes)} 个待生成图片的菜品\n")

    success_count = 0
    fail_count = 0

    for dish in dishes:
        dish_name = dish.dish_name or f"菜品{dish.id}"

        # 跳过已有图片的菜品
        if dish.image_url and dish.image_url.strip():
            print(f"[{dish.id}] ⏭️ 已跳过: {dish_name} (已有图片)")
            continue

        try:
            result = generate_and_store_image(dish)

            # 记录日志
            insert_generation_log(
                dish.id,
                dish_name,
                result.get("imageUrl", ""),
                result["success"],
                result.get("error")
            )

            if result["success"]:
                success_count += 1
            else:
                fail_count += 1

        except Exception as e:
            print(f"[{dish.id}] 处理失败: {e}")
            insert_generation_log(dish.id, dish_name, "", False, str(e))
            fail_count += 1

        # 短暂休息，避免 SD 压力过大
        time.sleep(0.5)

    # 统计报告
    print("\n" + "=" * 60)
    print("生成完成")
    print("=" * 60)
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"总计: {len(dishes)}")

if __name__ == "__main__":
    main()
