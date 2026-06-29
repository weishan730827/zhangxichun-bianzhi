#!/usr/bin/env python3
"""
v2.3 脉诊数据: 严格从校后_v2 原书提取, 按张锡纯实际 5 维度定位

张锡纯 5 维度:
1. 总按 (76% 案) - 诊其脉...整体脉象
2. 左右手对比 (24% 案) - 左脉...右脉... / 左部...右部...
3. 关前/关后分部 (大气下陷特征) - 关前尤甚 / 关后
4. 两尺/尺部 (肾气特征) - 两尺无根 / 两尺不任重按
5. 重按/按之 (按压力度) - 重按不实 / 按之即无

每个脉象的 location 标签:
- 'total' - 总按
- 'left' / 'right' - 左右手
- 'upper' (关前) / 'lower' (关后/尺) - 分部
- 'press' (重按) / 'light' (轻取) - 按压

输出: pulse_v2.3.json
  字段: case_id, src_file, content_snippet, pulse_signature_raw,
        pulse_chars: { '总按': [...], '左手': [...], '右手': [...], '关前': [...], '关后/尺': [...], '重按': [...] },
        zx_special: ['弦长有力', '重按不实', ...]
"""
import json
import re
from pathlib import Path

ORIG = Path("/workspace/zhangxichun-bianzhi/assets/data/originals_v2")
SRC_FILES = [
    ("yifang_zhong", "校后_v2_医方_中段_喘息到吐衄.txt", "医方篇(中段)"),
    ("yifang_zhonghou", "校后_v2_医方_中后段_心病到伤寒.txt", "医方篇(中后段)"),
    ("yifang_hou", "校后_v2_医方_后段_温病到眼科.txt", "医方篇(后段)"),
    ("anliang_shang", "校后_v2_医案篇_上.txt", "医案篇(上)"),
    ("anliang_xia", "校后_v2_医案篇_下.txt", "医案篇(下)"),
    ("yilun", "校后_v2_医论篇.txt", "医论篇"),
    ("yihua", "校后_v2_医话篇.txt", "医话篇"),
    ("yaowu", "校后_v2_药物篇.txt", "药物篇"),
]

# 28 脉单字
PULSE_28 = '浮沉伏迟数疾缓虚实滑涩弦紧细微弱洪大长短濡芤革牢动促结代散'

# 28 个脉象引导词
PULSE_TRIGGERS = [
    '诊其脉', '其脉', '诊脉', '候其脉', '验其脉', '视其脉', '察其脉',
    '切其脉', '按其脉', '余诊其脉', '为之诊脉', '愚诊其脉',
    '脉象', '此证之脉', '此证脉', '是脉', '诊之脉',
    '切之', '摸之', '按之', '候之', '此脉', '其脉象',
]

# 张锡纯特色脉象 (11 个核心, 全文检查)
ZX_PATTERNS = [
    '弦长有力', '重按不实', '按之不实', '重按甚实', '重按无', '按之即无',
    '上盛下虚', '两尺无根', '两尺不任', '关前', '右寸独', '弦硬而长', '弦硬大',
    '重按无力', '按之有力', '按之虚', '参伍不调', '六脉皆闭', '和缓',
]


def split_into_cases(text):
    """切分医案/方剂: 按 X. 方名/X、病名 边界"""
    lines = text.split('\n')
    boundaries = []
    for i, line in enumerate(lines):
        line_s = line.strip()
        if not line_s or len(line_s) > 80:
            continue
        if re.match(r'^\d+[、．\.]\s*\S', line_s) or re.match(r'^[一二三四五六七八九十]+[、．\.]\s*\S', line_s):
            if len(line_s) < 50:
                boundaries.append((i, line_s))
    cases = []
    for idx, (start_line, title) in enumerate(boundaries):
        if idx + 1 < len(boundaries):
            end_line = boundaries[idx + 1][0]
        else:
            end_line = len(lines)
        content = '\n'.join(lines[start_line+1:end_line]).strip()
        if not content or len(content) < 30:
            continue
        cases.append({
            'title': title,
            'content': content,
        })
    return cases


def extract_pulse_with_location(content):
    """
    提取脉象描述 + 5 维度位置标签

    对每个脉象字符, 检查它前 6 字是否含位置词:
    - 左/左手/左脉/左部 → 'left'
    - 右/右手/右脉/右部 → 'right'
    - 关前/寸/寸口 → 'upper'
    - 关后/两尺/尺/尺中 → 'lower'
    - 重按/重诊/沉取 → 'press'
    - 轻取/浮取 → 'light'
    """
    found_sigs = []  # 每条: {text, location, chars}

    # 找引导词位置
    trigger_positions = []
    for trigger in PULSE_TRIGGERS:
        for m in re.finditer(re.escape(trigger), content):
            trigger_positions.append((m.start(), trigger))

    trigger_positions.sort()

    # 对每个引导词, 提取其后脉象描述 (到第一个 。；或 者)
    for pos, trigger in trigger_positions:
        start = pos + len(trigger)
        # 跳过空白
        while start < len(content) and content[start] in ' \t\n':
            start += 1
        # 找结束符
        end = start
        for ch in content[start:start+80]:
            if ch in '。；\n':
                break
            end += 1
        end = min(end, start + 40)
        sig = content[start:end].strip().rstrip('，,、。;')
        if 2 <= len(sig) <= 35:
            head = sig[:15]
            pulse_in_head = sum(1 for c in head if c in PULSE_28)
            if pulse_in_head >= 2:
                # 找脉象字符在 sig 里的位置 + 上下文
                chars_with_loc = []
                for c in PULSE_28:
                    if c in sig:
                        # 找该字符位置
                        idx = sig.find(c)
                        before = sig[max(0, idx-6):idx]
                        if any(k in before for k in ['左脉', '左手', '左部', '左关', '左寸']):
                            loc = 'left'
                        elif any(k in before for k in ['右脉', '右手', '右部', '右关', '右寸']):
                            loc = 'right'
                        elif any(k in before for k in ['关前', '寸口', '上焦', '寸脉']):
                            loc = 'upper'
                        elif any(k in before for k in ['关后', '两尺', '尺中', '尺脉', '下焦', '尺部']):
                            loc = 'lower'
                        elif any(k in before for k in ['重按', '重诊', '沉取', '按之']):
                            loc = 'press'
                        elif any(k in before for k in ['轻取', '浮取', '轻诊']):
                            loc = 'light'
                        else:
                            loc = 'total'
                        chars_with_loc.append((c, loc))
                found_sigs.append({
                    'trigger': trigger,
                    'text': trigger + sig,
                    'sig': sig,
                    'chars_with_loc': chars_with_loc,
                })
    return found_sigs


def main():
    all_cases = []
    case_id = 0
    stats = {
        '总按': 0, '左手': 0, '右手': 0, '关前': 0, '关后/尺': 0,
        '重按': 0, '轻取': 0,
    }
    zx_stats = {p: 0 for p in ZX_PATTERNS}

    for label, fn, src_label in SRC_FILES:
        fp = ORIG / fn
        if not fp.exists():
            print(f"⚠️ {fn} 不存在")
            continue
        text = fp.read_text(encoding="utf-8", errors="ignore")
        cases = split_into_cases(text)
        print(f"\n📖 {src_label}: {len(cases)} 条医案")

        for c in cases:
            case_id += 1
            content = c['content']
            sigs = extract_pulse_with_location(content)

            # 合并所有脉象字符到 5 维度
            pulse_by_loc = {k: [] for k in stats.keys()}
            for sig in sigs:
                for c_char, loc in sig['chars_with_loc']:
                    if loc == 'total':
                        pulse_by_loc['总按'].append(c_char)
                    elif loc == 'left':
                        pulse_by_loc['左手'].append(c_char)
                    elif loc == 'right':
                        pulse_by_loc['右手'].append(c_char)
                    elif loc == 'upper':
                        pulse_by_loc['关前'].append(c_char)
                    elif loc == 'lower':
                        pulse_by_loc['关后/尺'].append(c_char)
                    elif loc == 'press':
                        pulse_by_loc['重按'].append(c_char)
                    elif loc == 'light':
                        pulse_by_loc['轻取'].append(c_char)
            # 去重
            pulse_by_loc = {k: sorted(set(v)) for k, v in pulse_by_loc.items()}
            # 累加统计
            for k, v in pulse_by_loc.items():
                stats[k] += len(v)

            # 张锡纯特色 (全文检查)
            zx_found = []
            for pat in ZX_PATTERNS:
                if pat in content:
                    zx_found.append(pat)
                    zx_stats[pat] += 1

            # 脉象签名 (取第一条)
            sig_raw = sigs[0]['sig'] if sigs else ''

            all_cases.append({
                'case_id': case_id,
                'src_label': label,
                'src_file': fn,
                'title': c['title'],
                'content': content,
                'content_excerpt': content[:200],
                'pulse_signature_raw': sig_raw,
                'pulse_chars_5dim': pulse_by_loc,
                'has_pulse': bool(sigs),
                'zx_special': zx_found,
            })

    # 输出
    out = {
        'version': 'v2.3',
        'method': '校后_v2 原书 → 5 维度定位提取 (总按/左/右/关前/关后/重按/轻取)',
        'pulse_28': list(PULSE_28),
        'zx_patterns': ZX_PATTERNS,
        'case_count': len(all_cases),
        'with_pulse_count': sum(1 for c in all_cases if c['has_pulse']),
        'stats_by_location': stats,
        'stats_by_zx': zx_stats,
        'cases': all_cases,
    }

    out_path = Path("/workspace/zhangxichun-bianzhi/assets/data/pulse_v2.3.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\n{'='*60}")
    print(f"✅ v2.3 脉诊数据已生成")
    print(f"   总案例: {len(all_cases)}")
    print(f"   有脉象: {sum(1 for c in all_cases if c['has_pulse'])} 条")
    print(f"   size: {out_path.stat().st_size:,} bytes")
    print(f"\n=== 5 维度脉象字符频次 (按位置) ===")
    for k, v in stats.items():
        print(f"  {k}: {v} 字次")
    print(f"\n=== 张锡纯特色脉象 (前 10) ===")
    for p, n in sorted(zx_stats.items(), key=lambda x: -x[1])[:10]:
        if n > 0:
            print(f"  {p}: {n} 案")


if __name__ == "__main__":
    main()
