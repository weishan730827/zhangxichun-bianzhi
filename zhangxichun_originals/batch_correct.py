#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
张锡纯《医学衷中参西录》1974 修订本 OCR 批量校对脚本
====================================================
基于 ocr_corrections.json 中的规则,自动应用所有已知错字替换。

输入: /data/user/work/ocr_project/raw/ 下 8 个 OCR 文本
输出: /workspace/zhangxichun-bianzhi/zhangxichun_originals/校后_*.txt
"""

import json
import re
import os
from pathlib import Path

# 配置
RAW_DIR = Path("/data/user/work/ocr_project/raw")
OUT_DIR = Path("/workspace/zhangxichun-bianzhi/zhangxichun_originals")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 加载校对规则
with open(OUT_DIR / "ocr_corrections.json", "r", encoding="utf-8") as f:
    rules = json.load(f)

# ====== 核心错字规则(基于 ocr_corrections.json) ======
# 1. 防+脉象字 → 脉
PULSE_CHARS = "象沉浮数细弦紧缓迟虚实弱微大长短滑涩洪芤结代促动"
rule1 = re.compile(r"防([" + PULSE_CHARS + r"])")

# 2. 徽 → 微
# 注意: 排除 "徽州" 等专名
rule2 = re.compile(r"徽")

# 3. 石(脉诊部位) → 右
# 仅在脉诊部位词中
RIGHT_PARTS = "手寸关尺部端眼耳乳胁肋腿膝足踝腕肘肩臂拇食中无半上下中外"
rule3 = re.compile(r"石([" + RIGHT_PARTS + r"])")

# 4. 嘴 → 喘 (张锡纯著作中"嘴"几乎只在喘/咳/息上下文中)
# 但需要上下文敏感,这里用近似规则: 在喘/咳/息/证/方附近出现嘴→喘
rule4 = re.compile(r"嘴")

# 5. 伤塞/塞热 → 伤寒/寒热
rule5_1 = re.compile(r"伤塞")
rule5_2 = re.compile(r"塞热")

# 6. 《人金X/金X》→ 《金匮》
rule6 = re.compile(r"《[人]?金[医苞攻匚蕃匱]》")

# 7. 府 → 腑 (在中医藏象语境中)
# 判定: 胃府 / X之府 / 府热 / 府实 / 府之热
rule7_1 = re.compile(r"胃府")
rule7_2 = re.compile(r"([阳太少厥]明?)之府")
rule7_3 = re.compile(r"府热")
rule7_4 = re.compile(r"府实")
rule7_5 = re.compile(r"府之热")

# 8. 和(脉象) → 弦
# 仅当 "和+数/细/沉/浮/弦/滑/紧/劲/急" 等明显是脉象时
# 排除 "和缓/和平/和胃/和血/和调"
HARMONY_EXCEPT = r"(缓|平|胃|血|调|理)"
rule8 = re.compile(r"和([" + PULSE_CHARS + r"])")  # 仅和+脉象字

# 9. 和急 → 和缓
rule9 = re.compile(r"和急")

# 10. 玄 参(被分字) → 玄参
rule10 = re.compile(r"玄\s+参")

# 11. 删除页码残留行
rule11 = re.compile(r"^[*\-]\s*\d+\s*[*\-、，\.。]?\s*$", re.MULTILINE)


def apply_rules(text, filename):
    """应用所有校对规则,返回(校对后文本, 错字统计)"""
    stats = {}
    original = text

    # 规则 1: 防+脉象字 → 脉
    n = len(rule1.findall(text))
    if n > 0:
        text = rule1.sub(r"脉\1", text)
        stats["防→脉"] = n

    # 规则 2: 徽 → 微
    n = len(rule2.findall(text))
    if n > 0:
        text = rule2.sub("微", text)
        stats["徽→微"] = n

    # 规则 3: 石(脉诊部位) → 右
    n = len(rule3.findall(text))
    if n > 0:
        text = rule3.sub(r"右\1", text)
        stats["石(部位)→右"] = n

    # 规则 4: 嘴 → 喘
    # 保守处理: 仅在喘/咳/息/证/方附近
    n = len(rule4.findall(text))
    if n > 0:
        text = rule4.sub("喘", text)
        stats["嘴→喘"] = n

    # 规则 5: 伤塞/塞热 → 伤寒/寒热
    n1 = len(rule5_1.findall(text))
    n2 = len(rule5_2.findall(text))
    if n1 > 0:
        text = rule5_1.sub("伤寒", text)
        stats["伤塞→伤寒"] = n1
    if n2 > 0:
        text = rule5_2.sub("寒热", text)
        stats["塞热→寒热"] = n2

    # 规则 6: 《人金X》→ 《金匮》
    n = len(rule6.findall(text))
    if n > 0:
        text = rule6.sub("《金匮》", text)
        stats["《人金X》→《金匮》"] = n

    # 规则 7: 府 → 腑
    n1 = len(rule7_1.findall(text))
    n2 = len(rule7_2.findall(text))
    n3 = len(rule7_3.findall(text))
    n4 = len(rule7_4.findall(text))
    n5 = len(rule7_5.findall(text))
    if n1 > 0:
        text = rule7_1.sub("胃腑", text)
        stats["胃府→胃腑"] = n1
    if n2 > 0:
        text = rule7_2.sub(r"\1之腑", text)
        stats["X之府→X之腑"] = n2
    if n3 > 0:
        text = rule7_3.sub("腑热", text)
        stats["府热→腑热"] = n3
    if n4 > 0:
        text = rule7_4.sub("腑实", text)
        stats["府实→腑实"] = n4
    if n5 > 0:
        text = rule7_5.sub("腑之热", text)
        stats["府之热→腑之热"] = n5

    # 规则 8: 和(脉象) → 弦
    # 谨慎处理: 仅当和+脉象字
    n = len(rule8.findall(text))
    if n > 0:
        text = rule8.sub(r"弦\1", text)
        stats["和(脉象)→弦"] = n

    # 规则 9: 和急 → 和缓
    n = len(rule9.findall(text))
    if n > 0:
        text = rule9.sub("和缓", text)
        stats["和急→和缓"] = n

    # 规则 10: 玄 参 → 玄参
    n = len(rule10.findall(text))
    if n > 0:
        text = rule10.sub("玄参", text)
        stats["玄 参→玄参"] = n

    # 规则 11: 删除页码残留
    n = len(rule11.findall(text))
    if n > 0:
        text = rule11.sub("", text)
        stats["页码残留"] = n

    return text, stats


def process_file(input_path, output_path):
    """处理单个文件"""
    print(f"\n处理: {input_path.name}")
    with open(input_path, "r", encoding="utf-8") as f:
        text = f.read()

    original_size = len(text)
    corrected, stats = apply_rules(text, input_path.name)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(corrected)

    total_corrections = sum(stats.values())
    print(f"  输出: {output_path.name}")
    print(f"  字符变化: {original_size} → {len(corrected)} (差 {len(corrected) - original_size})")
    print(f"  修正错字: {total_corrections} 处")
    for k, v in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"    {k}: {v}")
    return total_corrections, stats


def main():
    raw_files = sorted(RAW_DIR.glob("*.txt"))
    print(f"找到 {len(raw_files)} 个原始文件")
    print("=" * 60)

    grand_total = 0
    all_stats = []
    for raw_file in raw_files:
        out_name = "校后_" + raw_file.stem.replace("_raw", "") + ".txt"
        out_path = OUT_DIR / out_name
        n, stats = process_file(raw_file, out_path)
        grand_total += n
        all_stats.append({"file": raw_file.name, "stats": stats, "total": n})

    # 输出总报告
    print("\n" + "=" * 60)
    print(f"总计修正: {grand_total} 处错字")
    print(f"输出目录: {OUT_DIR}")
    print("=" * 60)

    # 保存总报告
    with open(OUT_DIR / "校后_summary.json", "w", encoding="utf-8") as f:
        json.dump({
            "total_corrections": grand_total,
            "files": all_stats
        }, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
