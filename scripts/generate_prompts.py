import json
import re
import os

# ==================== 配置区域（按需修改）====================
INPUT_JSON = r"E:\Ai-suiyuan\data\unified_recipes_backup.json"
OUTPUT_TXT = r"E:\Ai-suiyuan\data\prompts.txt"
MAPPING_TXT = r"E:\Ai-suiyuan\data\mapping.txt"

# 食材→英文映射（用于SD识别）
INGREDIENT_EN = {
    "牛肉": "beef",
    "牛舌": "beef tongue",
    "羊肉": "lamb",
    "猪肉": "pork",
    "鸡肉": "chicken",
    "鸭肉": "duck",
    "鱼肉": "fish",
    "虾": "shrimp",
    "蟹": "crab",
    "豆腐": "tofu",
    "白菜": "cabbage",
    "青菜": "greens",
    "萝卜": "radish",
    "竹笋": "bamboo shoots",
    "香菇": "shiitake mushroom",
    "蘑菇": "mushroom",
    "木耳": "wood ear mushroom",
    "火腿": "ham",
    "鸡蛋": "egg",
    "面粉": "flour",
    "米": "rice",
    "酒": "rice wine",
    "酱油": "soy sauce",
    "糖": "sugar",
    "盐": "salt",
    "葱": "scallion",
    "姜": "ginger",
    "蒜": "garlic",
    "辣椒": "chili",
    "花椒": "Sichuan peppercorn",
}

# 烹饪方法→英文
METHOD_EN = {
    "蒸": "steamed",
    "煮": "boiled",
    "炒": "stir-fried",
    "炖": "braised",
    "煨": "simmered",
    "炸": "deep-fried",
    "烤": "roasted",
    "腌": "pickled",
    "熏": "smoked",
    "风干": "air-dried",
    "拌": "mixed",
    "卤": "lu-style braised",
}

# 口味风格
STYLE_EN = {
    "清淡": "light and refreshing",
    "鲜香": "fragrant and savory",
    "醇厚": "rich and hearty",
    "麻辣": "spicy and numbing",
    "咸香": "salty and delicious",
    "甜": "sweet",
    "酸": "sour",
    "苦": "bitter",
    "辣": "spicy hot",
    "香": "aromatic",
    "软烂": "tender and soft",
    "酥脆": "crispy",
    "嫩滑": "smooth and tender",
    "入口即化": "melt-in-mouth",
}

# 器具/容器
CONTAINER_EN = {
    "碗": "ceramic bowl",
    "盘": "plate",
    "碟": "small dish",
    "盅": "small bowl",
    "陶": "clay pot",
    "砂锅": "clay pot",
    "蒸笼": "steamer basket",
}

# 反向提示词（所有图片共用）
NEGATIVE_PROMPT = (
    "nsfw, lowres, bad anatomy, bad hands, text, error, cropped, "
    "worst quality, low quality, jpeg artifacts, signature, watermark, "
    "username, blurry, modern, realistic photo, cartoon, anime, "
    "deformed, ugly, disfigured"
)
# ============================================================


def extract_keywords(text):
    """从古文原文提取关键信息"""
    keywords = {
        "ingredients": [],
        "methods": [],
        "container": None,
    }

    # 提取食材
    for cn, en in INGREDIENT_EN.items():
        if cn in text:
            keywords["ingredients"].append(en)

    # 提取烹饪方法
    for cn, en in METHOD_EN.items():
        if cn in text:
            keywords["methods"].append(en)

    # 提取容器
    for cn, en in CONTAINER_EN.items():
        if cn in text:
            keywords["container"] = en
            break

    return keywords


def generate_prompt(item):
    """根据菜品信息生成针对性prompt"""
    dish_name = item.get("dish_name", "").strip()
    original_text = item.get("original_text", "")
    main_ingredients = item.get("main_ingredients", [])
    taste_tags = item.get("taste_tags", [])

    # 从main_ingredients获取英文食材名
    eng_ingredients = []
    for ing in main_ingredients:
        for cn, en in INGREDIENT_EN.items():
            if cn in ing:
                eng_ingredients.append(en)
                break

    # 从口味标签获取英文
    eng_styles = []
    for tag in taste_tags:
        for cn, en in STYLE_EN.items():
            if cn in tag:
                eng_styles.append(en)
                break

    # 从原文提取关键词
    kw = extract_keywords(original_text)

    # 合并食材列表（去重）
    all_ingredients = list(set(eng_ingredients + kw.get("ingredients", [])))
    if not all_ingredients:
        all_ingredients = ["traditional Chinese ingredients"]

    # 合并烹饪方法
    all_methods = kw.get("methods", [])
    if not all_methods:
        all_methods = ["traditional Chinese cooking"]

    # 合并风格
    all_styles = eng_styles
    if not all_styles:
        all_styles = ["authentic Chinese flavor"]

    # 容器
    container = kw.get("container") or "antique ceramic bowl"

    # 构建 prompt
    ingredients_str = ", ".join(all_ingredients[:5])  # 最多5种
    methods_str = ", ".join(all_methods[:3])  # 最多3种
    styles_str = ", ".join(all_styles[:3])  # 最多3种

    prompt = f"""masterpiece, best quality, {dish_name}, Chinese dish,
{ingredients_str},
{styles_str}, {methods_str},
{container}, {container == "clay pot" and "earthenware" or "vintage"} style,
traditional Chinese cuisine, classical Chinese painting style, watercolor texture,
soft warm lighting, appetizing food photography, top-down angle,
delicate arrangement, fresh ingredients visible, authentic ancient recipe,
<lora:food_vectorshelf2:0.8>"""

    # 清理多余换行和空格
    prompt = re.sub(r'\s+', ' ', prompt).strip()
    prompt = re.sub(r',\s*,', ',', prompt)

    return prompt


def main():
    # 1. 读取 JSON 文件
    print(f"正在读取: {INPUT_JSON}")
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        recipes = json.load(f)

    dish_names = []
    prompts = []

    if isinstance(recipes, list):
        for item in recipes:
            if "dish_name" in item:
                dish_name = item["dish_name"]
                prompt = generate_prompt(item)
                dish_names.append(dish_name)
                prompts.append(prompt)
                print(f"  [OK] {dish_name}")

    elif isinstance(recipes, dict):
        for key, value in recipes.items():
            if isinstance(value, dict) and "dish_name" in value:
                dish_name = value["dish_name"]
                prompt = generate_prompt(value)
            else:
                dish_name = key
                prompt = f"masterpiece, best quality, {dish_name}, traditional Chinese dish"
                value = {}
            dish_names.append(dish_name)
            prompts.append(prompt)
            print(f"  ✓ {dish_name}")

    print(f"\n[OK] Generated {len(dish_names)} prompts")

    # 2. 写入文件
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f_prompt, \
         open(MAPPING_TXT, "w", encoding="utf-8") as f_map:

        for idx, (name, prompt) in enumerate(zip(dish_names, prompts), start=1):
            f_prompt.write(prompt + "\n")
            f_map.write(f"{idx:05d} = {name}\n")

    print(f"[OK] Saved to: {OUTPUT_TXT}")
    print(f"[OK] Mapping saved to: {MAPPING_TXT}")

    # 显示示例
    print("\n" + "=" * 60)
    print("Sample prompts (first 3):")
    print("=" * 60)
    for i, (name, prompt) in enumerate(zip(dish_names[:3], prompts[:3])):
        print(f"\n[{name}]")
        print(prompt[:300] + "..." if len(prompt) > 300 else prompt)

    print("\n" + "=" * 60)
    print("Negative prompt:")
    print("=" * 60)
    print(NEGATIVE_PROMPT)

    print("\n" + "=" * 60)
    print("Usage:")
    print("=" * 60)
    print("1. Open SD WebUI, select 'Prompts from file or textbox'")
    print("2. Upload prompts.txt")
    print("3. Paste the negative prompt above")
    print("4. Set parameters and generate")


if __name__ == "__main__":
    main()
