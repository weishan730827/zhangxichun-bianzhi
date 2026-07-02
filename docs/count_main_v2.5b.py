#!/usr/bin/env python3
"""v2.5 完整版: 在 2018 完整版里也跑 1 验案 = 1 患者叙述"""
import importlib.util
spec = importlib.util.spec_from_file_location("extract_v25", "/data/user/work/extract_v2.5.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

import json
import re
from pathlib import Path

MAIN = Path("/workspace/zhangxichun-bianzhi/assets/data/originals_v2/校后_v2_2018完整版_全8期30卷.txt")
text = MAIN.read_text(encoding="utf-8", errors="ignore")
print(f"完整版: {len(text):,} 字符, {len(text.split(chr(10))):,} 行")

lines = [l for l in text.split('\n') if not re.match(r'^\s*={5,}\s*PDF Page', l)]

raw_paragraphs = []
current_title = None
current_content = []
for line in lines:
    if mod.is_title_line(line):
        if current_title and current_content:
            content = '\n'.join(current_content).strip()
            raw_paragraphs.append((current_title, content))
        current_title = line.strip()
        current_content = []
    else:
        line_s = line.strip()
        if line_s and current_title:
            current_content.append(line_s)
if current_title and current_content:
    content = '\n'.join(current_content).strip()
    raw_paragraphs.append((current_title, content))

print(f"完整版切出段: {len(raw_paragraphs)}")

total_subcases = 0
para_with_case = 0
for title, content in raw_paragraphs:
    if not content or len(content) < 30:
        continue
    subcases = mod.split_paragraph_into_cases(content, title)
    if len(subcases) > 0:
        para_with_case += 1
    total_subcases += len(subcases)

print(f"完整版段内切出验案: {total_subcases}")
print(f"含验案的段数: {para_with_case}")

# 含方剂的段
formula_count = 0
for title, _ in raw_paragraphs:
    for f in mod.ZHANG_FORMULAS:
        if f in title:
            formula_count += 1
            break
print(f"含张锡纯方名的段: {formula_count}")
