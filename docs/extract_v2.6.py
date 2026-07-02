#!/usr/bin/env python3
"""
v2.6 用 2018 完整版做主源 (它包含 8 期 30 卷全文本), 8 子篇作为对照验证

输出: cases_real_v2.6.json (基于完整版)
"""
import importlib.util
spec = importlib.util.spec_from_file_location("m", "/data/user/work/extract_v2.5.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

import json
import re
from pathlib import Path
from collections import Counter

MAIN = Path("/workspace/zhangxichun-bianzhi/assets/data/originals_v2/校后_v2_2018完整版_全8期30卷.txt")
text = MAIN.read_text(encoding="utf-8", errors="ignore")
lines = [l for l in text.split('\n') if not re.match(r'^\s*={5,}\s*PDF Page', l)]

# 切 "X. 方名" 段
raw_paragraphs = []
current_title = None
current_content = []
for line in lines:
    if m.is_title_line(line):
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

print(f"完整版: {len(text):,} 字符")
print(f"切出段: {len(raw_paragraphs)}")

# 段内切验案
all_cases = []
case_id = 0
pulse_count = 0
formula_count = 0
patient_count = 0

for title, content in raw_paragraphs:
    if not content or len(content) < 30:
        continue
    subcases = m.split_paragraph_into_cases(content, title)
    for sub_title, sub_content in subcases:
        if not sub_content or len(sub_content) < 30:
            continue

        # 5 维度脉象
        pulse_by_loc = {k: [] for k in ['总按', '左手', '右手', '关前', '关后/尺', '重按', '轻取']}
        for trigger in ['诊其脉', '其脉', '脉象', '此脉']:
            for mm in re.finditer(re.escape(trigger), sub_content):
                st = mm.end()
                while st < len(sub_content) and sub_content[st] in ' \t\n':
                    st += 1
                end = st
                for ch in sub_content[st:st+50]:
                    if ch in '。；\n':
                        break
                    end += 1
                end = min(end, st + 25)
                sig = sub_content[st:end].strip().rstrip('，,。;、')
                if 2 <= len(sig) <= 25:
                    for ch_p in m.PULSE_28:
                        if ch_p in sig:
                            idx = sig.find(ch_p)
                            before = sig[max(0, idx-6):idx]
                            if any(k in before for k in ['左脉', '左手', '左部']):
                                loc = '左手'
                            elif any(k in before for k in ['右脉', '右手', '右部']):
                                loc = '右手'
                            elif any(k in before for k in ['关前', '寸口']):
                                loc = '关前'
                            elif any(k in before for k in ['关后', '两尺', '尺中']):
                                loc = '关后/尺'
                            elif any(k in before for k in ['重按', '重诊', '沉取', '按之']):
                                loc = '重按'
                            elif any(k in before for k in ['轻取', '浮取', '轻诊']):
                                loc = '轻取'
                            else:
                                loc = '总按'
                            pulse_by_loc[loc].append(ch_p)
        pulse_by_loc = {k: sorted(set(v)) for k, v in pulse_by_loc.items()}
        has_any_pulse = any(pulse_by_loc.values())

        formulas = [f for f in m.ZHANG_FORMULAS if f in sub_content]
        has_patient = bool(m.CASE_START_RE.search(sub_content))

        if has_any_pulse:
            pulse_count += 1
        if formulas:
            formula_count += 1
        if has_patient:
            patient_count += 1

        case_id += 1
        all_cases.append({
            'case_id': case_id,
            'src_file': '校后_v2_2018完整版_全8期30卷.txt',
            'src_label': '2018完整版',
            'parent_title': title,
            'title': sub_title,
            'content': sub_content,
            'content_length': len(sub_content),
            'pulse_chars_5dim': pulse_by_loc,
            'has_pulse': has_any_pulse,
            'formulas': formulas,
            'has_formula': bool(formulas),
            'has_patient': has_patient,
        })

out = {
    'version': 'v2.6 (完整版源)',
    'method': '1 验案 = 1 患者叙述, 源 = 2018 完整版 (含 8 期 30 卷)',
    'case_count': len(all_cases),
    'with_pulse': pulse_count,
    'with_formula': formula_count,
    'with_patient': patient_count,
    'cases': all_cases,
}

out_path = Path("/workspace/zhangxichun-bianzhi/assets/data/cases_real_v2.6.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print(f"\n{'='*60}")
print(f"✅ v2.6 完成")
print(f"   总验案: {len(all_cases)}")
print(f"   有脉象: {pulse_count} ({pulse_count/len(all_cases)*100:.1f}%)")
print(f"   有方剂: {formula_count} ({formula_count/len(all_cases)*100:.1f}%)")
print(f"   有患者: {patient_count} ({patient_count/len(all_cases)*100:.1f}%)")
print(f"   size: {out_path.stat().st_size:,} bytes")
