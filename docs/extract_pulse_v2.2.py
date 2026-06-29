#!/usr/bin/env python3
"""
v2.2: 重新提取 9 个原书 txt 的脉诊数据 (修复 v2.1 单字污染)

策略:
  1. 定位脉象描述窗口 (用引导词找)
  2. 只在窗口 ±15 字符内找 28 脉单字 (避免"大便""大气"等上下文污染)
  3. 保留完整脉象组合 (pulse_signature_raw)
  4. 提取张锡纯特色: 关前微弱/两尺无根/重按不实/重按甚实/右寸独微弱/弦长有力

输出: pulse_data_v2.2.json
"""
import json, re
from pathlib import Path
from collections import Counter

DATA_DIR = Path("/workspace/zhangxichun-bianzhi/assets/data")
ORIG_DIR = Path("/workspace/zhangxichun-bianzhi/zhangxichun_originals")

# 9 个原书文件
SRC_FILES = [
    ("main", "校后_2018完整版_全8期30卷.txt"),
    ("anliang_shang", "校后_医案篇_上.txt"),
    ("anliang_xia", "校后_医案篇_下.txt"),
    ("yilun", "校后_医论篇.txt"),
    ("yihua", "校后_医话篇.txt"),
    ("yaowu", "校后_药物篇.txt"),
    ("yifang_zhong", "校后_医方_中段_喘息到吐衄.txt"),
    ("yifang_zhonghou", "校后_医方_中后段_心病到伤寒.txt"),
    ("yifang_hou", "校后_医方_后段_温病到眼科.txt"),
]

# ===== 28 脉单字 (去污染) =====
PULSE_28 = [
    '浮', '沉', '伏', '迟', '数', '疾', '缓',
    '虚', '实', '滑', '涩', '弦', '紧', '细', '微', '弱', '洪', '大', '长', '短',
    '濡', '芤', '革', '牢', '动', '促', '结', '代', '散',
]

# 易污染字符 (需特殊处理)
DIRTY_CHARS = {
    '大': ['大脉', '脉大', '大而', '象大'],
    '动': ['动脉', '脉动', '动而', '象动'],
    '散': ['散脉', '脉散', '散大', '散数', '象散'],
    '长': ['长脉', '脉长', '长而', '长之', '弦长', '长滑', '长大', '象长', '长有'],
    '疾': ['疾脉', '脉疾', '疾而', '疾数', '疾徐'],
    '短': ['短脉', '脉短', '短而', '短涩', '短数', '短滑'],
    '实': ['实脉', '脉实', '实而', '实大', '实滑', '实数', '实弦', '实长', '洪实', '弦实'],
}

# 复合脉词 (在窗口内出现 → 整体加)
COMPOUND_PULSE = [
    '有力', '无力', '和缓', '真有力', '假有力', '无根', '上盛下虚',
    '弦硬', '弦长', '弦细', '弦数', '弦迟', '沉弦', '沉细', '沉迟', '沉弱',
    '沉微', '沉实', '浮紧', '浮数', '浮弦', '浮大', '浮弱', '浮滑', '浮洪', '浮迟',
    '洪实', '洪大', '洪滑', '洪数', '洪长', '洪弦', '洪细', '洪而有力',
    '滑数', '滑大', '滑弦', '滑实', '滑而有力',
    '细数', '细弱', '细弦', '细而无力', '细涩', '细滑',
    '数而有力', '数而无力', '数而细', '数而弦', '数而实',
    '迟而有力', '迟而无力', '迟而细', '迟而弱', '迟而涩',
    '大而有力', '大而无力', '大而弦', '大而滑', '大而实', '大而数',
    '弦而有力', '弦而无力', '弦而数', '弦而迟', '弦而细', '弦而滑',
    '微而细', '微而数', '微而迟', '微而弱',
    '弱而细', '弱而数', '弱而迟',
    '关前微弱', '关前浮', '关前沉', '关前数', '关前弦', '关前洪滑', '关前大',
    '两尺无根', '两尺微弱', '两尺沉', '两尺浮', '两尺细', '两尺不任重按',
    '右寸独微弱', '右寸关沉', '右寸独沉', '左寸关尺皆不见',
    '重按不实', '重按甚实', '重按无根', '重按无力', '重按虚', '重按无',
    '按之不实', '按之有力', '按之即无', '按之虚', '按之无力',
    '左部弦长', '左部弦硬', '左部沉弦', '左部弦细', '左部沉细', '左部微弱',
    '右部弦长', '右部洪长', '右部微弱', '右部洪实', '右部沉弦',
    '左右皆弦长', '左右皆弦硬', '左右皆沉弦', '左右皆微弱',
    '左脉弦', '右脉弦', '左脉沉', '右脉沉', '左脉数', '右脉数',
    '沉迟微弱', '沉细无力', '沉细欲无', '微弱欲无', '微弱异常', '微细如丝',
    '一息五至', '一息四至', '一息六至', '一息七至', '一息八至',
]

# 张锡纯特色 6 项 (独立)
ZX_SPECIAL = [
    '关前微弱', '关前浮弦', '关前洪滑',
    '两尺无根', '两尺重按无根', '两尺不任重按',
    '右寸独微弱', '右寸关沉', '右寸关之沉',
    '弦长有力', '弦硬而长', '弦硬大',
    '重按不实', '重按甚实', '重按无',
    '按之不实', '按之有力', '按之即无',
    '重按无力', '重按虚', '按之虚',
    '上盛下虚', '真有力', '假有力', '和缓',
    '无根', '动摇', '参伍不调', '六脉不全', '六脉皆闭',
]

# 脉象引导词
PULSE_TRIGGERS = [
    r'诊其脉', r'其脉', r'脉象', r'其脉象', r'脉搏', r'其脉搏',
    r'其人脉', r'此人脉', r'诊脉', r'候其脉', r'验其脉', r'诊其脉象',
    r'视其脉', r'察其脉', r'询其脉', r'号其脉', r'摸其脉',
    r'按其脉', r'余诊其脉', r'为之诊脉', r'为之诊其脉',
    r'此证之脉', r'此证脉', r'是脉', r'其脉', r'诊之脉',
    r'愚诊其脉', r'诊之', r'其人',
]

# ===== 提取函数 =====
def find_pulse_windows(text, window=15):
    """找脉象描述窗口 (引导词 ±window 字符)"""
    windows = []
    seen_spans = set()  # 去重
    for trig in PULSE_TRIGGERS:
        for m in re.finditer(trig, text):
            start = max(0, m.start() - window)
            end = min(len(text), m.end() + window * 3)  # 脉象描述可向后延
            span = (start, end)
            if span in seen_spans:
                continue
            seen_spans.add(span)
            windows.append((start, end, text[start:end]))
    windows.sort()
    # 合并重叠窗口
    merged = []
    for w in windows:
        if merged and w[0] <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], w[1]), text[merged[-1][0]:max(merged[-1][1], w[1])])
        else:
            merged.append(w)
    return merged

def extract_pulses_in_window(text):
    """在文本中提取 28 脉 + 复合脉 + 张锡纯特色"""
    chars = set()
    compounds = set()
    zx = set()

    windows = find_pulse_windows(text)
    if not windows:
        return chars, compounds, zx

    combined = ''.join(w[2] for w in windows)

    # 1. 28 脉单字 (含污染字符特殊处理)
    for p in PULSE_28:
        if p in combined:
            chars.add(p)
    for dirty, prefixes in DIRTY_CHARS.items():
        for pre in prefixes:
            if pre in combined:
                chars.add(dirty)
                break

    # 1.5 单字符脉象二次过滤: 排除明显非脉象上下文
    # '大' 在 window 内: 必须脉象语义 (有 脉/按/象/而/则 后 5 字内)
    # 简单办法: 排除'大气','大方','大热','大寒','大汗','大吐','大泻','大渴'等非脉象
    non_pulse_context = {
        '大': ['大气','大方','大热','大寒','大汗','大吐','大泻','大渴','大便','大惊','大意','大约','大率','大都','大凡','大端','大抵','大旨','大体','大略','大要','大畧','大段','大局','大局','大效','大着','大愈','大量','大肆','大肆','大力','大会','大军','大臣','大夫','大黄','大承气','大青龙','大小','大枣','大麦','大便','大痛','大恐','大恐','大惊','大烧','大凉','大快','大虚'],
        '动': ['动作','活动','劳动','主动','动脉粥','动摇','动作','动向','动而','生动','动于','动之','动之','动脉血'],
        '散': ['解散','疏散','散发','散在','散步','散剂','散见','散佚','散失','散落','分散','散在','散乱','散漫','散居','散户','散户'],
        '长': ['长久','长大','长于','长期','长期','长短','长久','长度','长篇','长短','长久','长大','长子','长女','长孙','长官','长生','长安','长史','长年','长年','长寿','长江','长河','长城','长篇','长短','长久','长期','长大','长势','长进','长相','长策','长算','长存','长者','长辈','长度','长短','长短','长期','长久','长短','长短','长短'],
        '疾': ['疾病','疾苦','疾走','疾驰','疾呼','疾恶','疾言','疾书','疾徐','疾病','疾首','疾首痛心'],
        '短': ['短气','气短','短时间','短促','短路','短暂','短信','短缺','短篇','短期','短处','短长','短句','短句','短见','短浅','短小','短途','短打','短兵','短讯','短处','短篇','短篇','短片','短训','短期','短缺','短暂','短促','短视','短浅','短见','短句','短论','短装','短打','短路','短跑','短途','短笛','短箫','短歌','短褐','短发','短信','短路','短缺','短期','短促','短暂','短见','短浅','短小','短简','短篇','短歌','短韵','短章','短句','短论','短装','短褐','短发','短信','短路','短跑','短途','短笛','短箫','短歌','短褐','短发','短信','短路','短缺','短期','短促','短暂','短见','短浅','短小','短简','短篇','短歌','短韵','短章','短句','短论'],
    }
    for dirty, ctx_list in non_pulse_context.items():
        if dirty in chars:
            # 检查该字符在 combined 中所有出现位置, 周围是否有非脉象上下文
            positions = [m.start() for m in re.finditer(dirty, combined)]
            polluted = False
            for pos in positions:
                # 取 pos 周围 4 字 (前后各 2)
                around = combined[max(0,pos-2):pos+3]
                # 检查任一非脉象短语的子串是否在 around
                for ctx in ctx_list:
                    if len(ctx) >= 2 and ctx in around:
                        polluted = True
                        break
                if polluted:
                    break
            if polluted:
                chars.discard(dirty)

    # 2. 复合脉
    for c in COMPOUND_PULSE:
        if c in combined:
            compounds.add(c)

    # 3. 张锡纯特色 (全文检查, 不限窗口 — 这些短语特征性高不易污染)
    for z in ZX_SPECIAL:
        if z in text:  # 全文, 不只窗口
            zx.add(z)

    return chars, compounds, zx

# ===== 主流程 =====
print("=" * 60)
print("v2.2 重提取脉诊数据")
print("=" * 60)

# 加载已有 cases_full.json (保留 case_id 编号, content, formulas 等)
cases_data = json.load(open(DATA_DIR / "cases_full.json", encoding="utf-8"))
cases = cases_data["cases"]
print(f"\n已有 cases_full.json: {len(cases)} 段")

# 加载每个原书文件, 全文
src_texts = {}
for label, fn in SRC_FILES:
    fp = ORIG_DIR / fn
    if fp.exists():
        src_texts[label] = fp.read_text(encoding="utf-8", errors="ignore")
        print(f"  [{label}] {fn}: {len(src_texts[label]):,} 字符")
    else:
        print(f"  ⚠️ [{label}] {fn} 不存在")

# 重新提取每段的脉诊数据
all_pulse_chars = Counter()
all_compounds = Counter()
all_zx = Counter()
case_match = []
case_total = 0
case_with_pulse = 0

for case in cases:
    case_total += 1
    label = case.get("src_label", "main")
    content = case.get("content", "")

    # 优先用 src_file 对应的文本
    text = src_texts.get(label, "")
    # 但 content 是该 case 的真实子段, 用 content 即可
    # 注意: content 里 '\\n' 是字面字符
    content_clean = content.replace("\\n", "\n").replace("\\x", " ")

    chars, compounds, zx = extract_pulses_in_window(content_clean)

    for c in chars: all_pulse_chars[c] += 1
    for c in compounds: all_compounds[c] += 1
    for z in zx: all_zx[z] += 1
    if chars or compounds or zx:
        case_with_pulse += 1

    case_match.append({
        "case_id": case["case_id"],
        "pulse_chars_v22": sorted(chars),
        "pulse_compounds_v22": sorted(compounds),
        "pulse_zx_v22": sorted(zx),
    })

print(f"\n=== 重提取结果 ===")
print(f"  处理 case 总数: {case_total}")
print(f"  有脉象数据: {case_with_pulse} ({case_with_pulse/case_total*100:.1f}%)")

print(f"\n=== 28 脉单字频次 (去污染后, 共 {len(all_pulse_chars)} 种) ===")
for p, n in all_pulse_chars.most_common():
    print(f"  {p}: {n} 段")

print(f"\n=== Top 30 复合脉 (共 {len(all_compounds)} 种唯一组合) ===")
for c, n in all_compounds.most_common(30):
    print(f"  {c}: {n} 段")

print(f"\n=== 张锡纯特色 (共 {len(all_zx)} 种) ===")
for z, n in all_zx.most_common():
    print(f"  {z}: {n} 段")

# ===== 输出 =====
output = {
    "version": "v2.2",
    "method": "严格脉象上下文窗口提取 (引导词 ±15 字符), 修复 v2.1 单字污染",
    "case_total": case_total,
    "case_with_pulse": case_with_pulse,
    "pulse_chars_freq": dict(all_pulse_chars),
    "compound_freq": dict(all_compounds),
    "zx_freq": dict(all_zx),
    "case_match": case_match,
}

out_path = DATA_DIR / "pulse_data_v2.2.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

print(f"\n✅ 输出: {out_path}")
print(f"   size: {out_path.stat().st_size:,} bytes")
