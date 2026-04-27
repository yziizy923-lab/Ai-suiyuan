import os
import shutil
import re

# ==================== 配置 ====================
# SD 输出目录（修改为你实际的日期文件夹）
SD_OUTPUT_DIR = r"E:\sd-webui-forge-aki-v1.0\outputs\txt2img-images\2026-04-17"

# 目标目录
TARGET_DIR = r"E:\Ai-suiyuan\public\images\dishes"

# mapping.txt 路径
MAPPING_FILE = r"E:\Ai-suiyuan\data\mapping.txt"
# ============================================


def load_mapping():
    """读取 mapping.txt，返回 {序号: 菜名} 的字典"""
    mapping = {}
    with open(MAPPING_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if " = " in line:
                parts = line.split(" = ", 1)
                idx = parts[0].strip()
                name = parts[1].strip()
                mapping[idx] = name
    return mapping


def get_sd_images():
    """获取 SD 输出的所有图片，按文件名排序"""
    if not os.path.exists(SD_OUTPUT_DIR):
        print(f"[ERROR] 目录不存在: {SD_OUTPUT_DIR}")
        return []

    images = []
    for fname in sorted(os.listdir(SD_OUTPUT_DIR)):
        if fname.lower().endswith(('.png', '.jpg', '.jpeg')):
            full_path = os.path.join(SD_OUTPUT_DIR, fname)
            images.append((fname, full_path))
    return images


def sanitize_filename(name):
    """清理文件名中的非法字符"""
    # 替换 Windows 不允许的字符
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    # 限制长度
    if len(name) > 50:
        name = name[:50]
    return name


def main():
    print(f"SD 输出目录: {SD_OUTPUT_DIR}")
    print(f"目标目录: {TARGET_DIR}")
    print(f"映射文件: {MAPPING_FILE}")
    print("=" * 60)

    # 加载映射表
    mapping = load_mapping()
    print(f"已加载 {len(mapping)} 条菜名映射")

    # 获取 SD 生成的图片
    sd_images = get_sd_images()
    print(f"找到 {len(sd_images)} 张 SD 生成的图片")
    print("=" * 60)

    if len(sd_images) == 0:
        print("[ERROR] 没有找到图片！")
        return

    if len(sd_images) != len(mapping):
        print(f"[WARNING] 图片数量({len(sd_images)}) 与映射数量({len(mapping)}) 不一致")

    # 确保目标目录存在
    os.makedirs(TARGET_DIR, exist_ok=True)

    # 处理每张图片
    import time
    timestamp = int(time.time())  # 使用当前时间戳，或改成固定值如 1775551676

    for i, (orig_name, orig_path) in enumerate(sd_images):
        idx = f"{i+1:05d}"  # 序号，如 00001

        # 获取菜名
        dish_name = mapping.get(idx, f"未知_{idx}")

        # 生成新文件名 (序号_菜名.png)
        safe_name = sanitize_filename(dish_name)
        new_name = f"{idx}_{safe_name}.png"
        new_path = os.path.join(TARGET_DIR, new_name)

        # 复制并覆盖（如果已存在）
        shutil.copy2(orig_path, new_path)
        print(f"  [{idx}] {orig_name} -> {new_name}")

    print("=" * 60)
    print(f"[OK] 完成！共处理 {len(sd_images)} 张图片")
    print(f"     图片已保存到: {TARGET_DIR}")


if __name__ == "__main__":
    main()
