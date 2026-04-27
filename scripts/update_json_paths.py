import json
import os
import re

# ==================== 配置 ====================
JSON_FILE = r"E:\Ai-suiyuan\data\unified_recipes_backup.json"
DISHES_DIR = r"E:\Ai-suiyuan\public\images\dishes"
# ============================================


def get_current_filenames():
    """获取 dishes 目录下所有当前文件名"""
    files = {}
    for fname in os.listdir(DISHES_DIR):
        if fname.endswith('.png'):
            full_path = os.path.join(DISHES_DIR, fname)
            files[fname] = full_path
    return files


def match_dish_name(filename):
    """从文件名提取菜名（去掉序号前缀）"""
    # 格式: 00001_菜名.png
    match = re.match(r'^\d+_(.+)\.png$', filename)
    if match:
        return match.group(1)
    return None


def main():
    print(f"JSON 文件: {JSON_FILE}")
    print(f"图片目录: {DISHES_DIR}")
    print("=" * 60)

    # 读取 JSON
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        recipes = json.load(f)

    # 获取当前所有图片
    current_files = get_current_filenames()
    print(f"找到 {len(current_files)} 张图片")

    # 建立菜名 -> 新路径 的映射
    name_to_new = {}
    for fname in current_files:
        dish_name = match_dish_name(fname)
        if dish_name:
            name_to_new[dish_name] = f"/images/dishes/{fname}"

    print(f"已建立 {len(name_to_new)} 个菜名映射")
    print("=" * 60)

    # 更新 JSON
    updated_count = 0
    for recipe in recipes:
        dish_name = recipe.get("dish_name", "").strip()
        # 尝试匹配（考虑尾部空格）
        new_url = name_to_new.get(dish_name)
        if not new_url:
            # 再试一次，去掉尾部空格
            new_url = name_to_new.get(dish_name.rstrip())

        if new_url:
            recipe["image_url"] = new_url
            recipe["image_generated_at"] = ""  # 清空表示未生成时间
            updated_count += 1
            print(f"  [OK] {dish_name} -> {new_url}")
        else:
            print(f"  [!!] 未找到: {dish_name}")

    # 保存更新后的 JSON
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)

    print("=" * 60)
    print(f"[OK] 完成！更新了 {updated_count}/{len(recipes)} 条记录")
    print(f"     JSON 已保存到: {JSON_FILE}")


if __name__ == "__main__":
    main()
