#!/usr/bin/env python3
"""
v2.2 final: 从 9 个原书 txt 重新提取"一医案一脉诊"映射

策略:
  1. 按"X. 方名/病名"或"X、X、X"切分医案/方剂边界
  2. 每条 = 独立 case_id (按出现顺序编号)
  3. 提取该条内"诊其脉"到第一个句号/分号的脉象描述
  4. 完整脉象组合保留为 pulse_signature_raw (含重按/关前/两尺等)
  5. 同时记录 28 脉单字 (pulse_chars)
  6. 提取方剂 (formulas)
  7. 提取症状 (symptoms, 关键词匹配)

输出: cases_unified_v2.2.json
  {
    "version": "v2.2",
    "case_count": N,
    "cases": [
      {
        "case_id": 1,
        "src_file": "校后_医案篇_下.txt",
        "src_location": "医案篇(下)·第1条",
        "title": "大气下陷兼小便不利",
        "title_raw": "1. 大气下陷兼小便不利",
        "content": "...完整医案内容...",
        "content_excerpt": "前 200 字",
        "pulse_signature_raw": "脉沉迟微弱",   # 完整脉象描述 (从原书直接抄录)
        "pulse_chars": ["沉", "迟", "微", "弱"],
        "pulse_window": "诊其脉沉迟微弱,关前尤甚",  # 完整窗口
        "formulas": [{"name": "升陷汤", "matched": "升陷汤"}],
        "symptoms": ["小便不利", "气短", ...],
        "has_pulse": true/false
      },
      ...
    ]
  }
"""
import json, re
from pathlib import Path

ORIG_DIR = Path("/workspace/zhangxichun-bianzhi/zhangxichun_originals")

# 9 个原书文件 (按优先级)
SRC_FILES = [
    ("yifang_zhong", "校后_医方_中段_喘息到吐衄.txt", "医方篇(中段)"),
    ("yifang_zhonghou", "校后_医方_中后段_心病到伤寒.txt", "医方篇(中后段)"),
    ("yifang_hou", "校后_医方_后段_温病到眼科.txt", "医方篇(后段)"),
    ("anliang_shang", "校后_医案篇_上.txt", "医案篇(上)"),
    ("anliang_xia", "校后_医案篇_下.txt", "医案篇(下)"),
    ("yilun", "校后_医论篇.txt", "医论篇"),
    ("yihua", "校后_医话篇.txt", "医话篇"),
    ("yaowu", "校后_药物篇.txt", "药物篇"),
    # main 文件不切分 (它包含子篇的混合, 会重复)
    # ("main", "校后_2018完整版_全8期30卷.txt", "完整版(混合)"),
]

# 28 脉单字
PULSE_28 = '浮沉伏迟数疾缓虚实滑涩弦紧细微弱洪大长短濡芤革牢动促结代散'

# 28 脉引导词 (找脉象起点)
PULSE_TRIGGERS = [
    '诊其脉', '其脉', '脉象', '其脉象', '脉搏', '其脉搏',
    '其人脉', '此人脉', '诊脉', '候其脉', '验其脉', '诊其脉象',
    '视其脉', '察其脉', '询其脉', '号其脉', '摸其脉', '切其脉',
    '按其脉', '余诊其脉', '为之诊脉', '为之诊其脉',
    '此证之脉', '此证脉', '是脉', '诊之脉',
    '愚诊其脉', '诊之', '切之', '摸之', '按之',
    '候之', '其脉', '此脉',
]

# 脉象结束符 (在引导词后找这些)
PULSE_ENDS = ['。', '；', '?者', '也', '为', '乃', '则', '遂', '即', '是', '用', '投以', '拟']

# 症状关键词 (常见张锡纯症状)
SYMPTOM_KEYWORDS = [
    '气短', '气喘', '喘', '咳嗽', '咳', '痰', '心悸', '怔忡', '失眠', '不寐',
    '汗', '发热', '恶寒', '畏寒', '头痛', '头晕', '眩晕', '目赤', '口渴',
    '胸闷', '胸满', '心烦', '烦躁', '健忘', '神昏', '腹胀', '痛', '食欲',
    '呕吐', '泄泻', '便秘', '便血', '吐血', '衄血', '小便不利', '小便短赤',
    '小便频数', '水肿', '遗精', '月经不调', '带下', '崩漏', '胎',
    '噫气', '反酸', '胁痛', '腰痛', '背痛', '四肢', '厥逆', '抽搐', '痉挛',
]

# 方剂关键词 (张锡纯原书方)
FORMULA_KEYWORDS = [
    '升陷汤', '白虎加人参汤', '理饮汤', '滋培汤', '龙牡汤', '健脾化痰丸',
    '秘红丹', '化血丹', '磁朱丸', '黑锡丹', '镇风汤', '逐风汤', '镇肝熄风汤',
    '起痿汤', '搜风汤', '急救回生丹', '卫生防疫宝丹', '解毒生化丹',
    '滋阴清燥汤', '清解汤', '宣解汤', '凉解汤', '寒解汤', '石膏阿斯匹林汤',
    '白虎加人参以山药代粳米汤', '通变白虎加人参汤',
    '醴泉饮', '参麦汤', '十全育真汤', '资生汤', '扶中汤', '醒脾升陷汤',
    '升降汤', '培脾疏肝汤', '金铃泻肝汤', '活络效灵丹', '内托生肌散',
    '托里消毒散', '振颓汤', '振颓丸', '姜胶膏', '黄芪膏', '清金解毒汤',
    '清金益气汤', '安肺宁嗽丸', '清凉华盖饮', '保元寒降汤', '保元清降汤',
    '秘红丹', '温降汤', '清降汤', '保和汤', '白前汤', '二鲜饮', '三鲜饮',
    '化瘀理膈丹', '宝珠丹', '急救回阳汤', '卫生防疫宝丹',
    '加味苓桂术甘汤', '苓桂术甘汤',
    '加味四神丸', '敦复汤', '肾气丸', '地黄饮子', '补脑振痿汤',
    '振中汤', '理中汤', '理中丸',
    '活络祛寒汤', '健运汤', '振中汤', '曲直汤',
    '来复汤', '既济汤', '来复丹',
    '黄芪五物汤', '黄芪建中汤', '黄芪桂枝五物汤',
]

# ============================================================

def normalize_text(t):
    """标准化文本: 去除 OCR 误差"""
    t = t.replace('\\n', '\n').replace('\\r', '')
    t = re.sub(r'\n{3,}', '\n\n', t)
    t = re.sub(r' {2,}', ' ', t)
    return t.strip()

def split_into_cases(text, src_label, src_file):
    """
    切分医案/方剂: 按"X. 方名"或"X、病名"作为起始
    返回: [(title, content), ...]
    """
    lines = text.split('\n')
    # 找所有"X. X"或"X、X"行作为分界
    boundaries = []
    for i, line in enumerate(lines):
        line_s = line.strip()
        if not line_s or len(line_s) > 80:
            continue
        # "1. 大气下陷" "1、 大气下陷" "一、大气下陷" "1. 大气下陷兼小便不利"
        if re.match(r'^\d+[、．\.]\s*\S', line_s) or re.match(r'^[一二三四五六七八九十]+[、．\.]\s*\S', line_s):
            # 短标题 (< 50 字)
            if len(line_s) < 50:
                boundaries.append((i, line_s))

    # 把 boundaries 之间的内容切分
    cases = []
    for idx, (start_line, title) in enumerate(boundaries):
        # 内容: 从 start_line+1 到下一个 boundary 前
        if idx + 1 < len(boundaries):
            end_line = boundaries[idx + 1][0]
        else:
            end_line = len(lines)
        content = '\n'.join(lines[start_line+1:end_line]).strip()
        # 排除空内容或太短
        if not content or len(content) < 30:
            continue
        cases.append({
            'title': title,
            'title_raw': title,
            'content': content,
            'src_file': src_file,
            'src_label': src_label,
            'src_location': f'{src_label}·{title}',
        })
    return cases

def extract_pulse_signature(content):
    """
    提取完整脉象描述
    1. 找"诊其脉..." 或"其脉..." 起点
    2. 切分到第一个 。；或 者 也 处停止 (避免抓后续症状)
    3. 多个脉象描述都提取 (一个医案可有多次诊脉)
    4. 评分: 短(<=25字) + 前 15 字内含 ≥2 个脉象字符
    """
    found = []
    for trigger in PULSE_TRIGGERS:
        for m in re.finditer(re.escape(trigger), content):
            start = m.end()
            # 跳过空白
            while start < len(content) and content[start] in ' \t\n':
                start += 1
            # 找结束符: 第一个 。 ； 或 者 也
            sig_end_chars = '。；\n'
            end = start
            for ch in content[start:start+80]:
                if ch in sig_end_chars:
                    break
                end += 1
            end = min(end, start + 30)  # 30 字硬限
            sig = content[start:end].strip().rstrip('，,、。;')

            if 2 <= len(sig) <= 30:
                # 验证: 前 15 字内含 ≥2 个脉象字符 (防"送用苦私送"等假阳性)
                head = sig[:15]
                pulse_in_head = sum(1 for c in head if c in PULSE_28)
                if pulse_in_head >= 2:
                    found.append({
                        'trigger': trigger,
                        'text': trigger + sig,
                        'sig': sig,
                    })
    # 优选: 优先短(<=15字)且是复合脉
    return found

def extract_pulse_chars(pulse_sigs):
    """从脉象描述中提取 28 脉单字 (去污染)"""
    chars = set()
    non_pulse = ['大气', '大便', '大方', '大热', '大寒', '大汗', '大吐', '大泻', '大渴',
                 '动而', '动脉粥', '动之', '动作', '活动', '劳动',
                 '散剂', '散在', '解散', '疏散', '散发', '散落', '分散', '散乱', '散居',
                 '长久', '长大', '长期', '长短', '长度', '长篇', '长年', '长寿', '长江', '长城',
                 '疾病', '疾苦', '疾走', '疾驰', '疾呼', '疾言', '疾书',
                 '短气', '气短', '短时间', '短促', '短期', '短篇', '短浅', '短小', '短见', '短缺', '短路', '短暂']

    combined = ' '.join(s['sig'] for s in pulse_sigs)

    for c in PULSE_28:
        if c in combined:
            # 污染检查
            polluted = False
            for np in non_pulse:
                if np in combined:
                    # 检查 np 是否含 c
                    if c in np:
                        # 如果 c 的位置在 np 内, 是污染
                        for pos in re.finditer(re.escape(c), combined):
                            if pos.start() >= combined.find(np) - 2 and pos.start() < combined.find(np) + len(np) + 2:
                                polluted = True
                                break
            if not polluted:
                chars.add(c)
    return sorted(chars)

def extract_formulas(content):
    """提取方剂 (从内容里找方剂名)"""
    found = []
    for f in FORMULA_KEYWORDS:
        if f in content:
            count = content.count(f)
            found.append({'name': f, 'count': count})
    return found

def extract_symptoms(content):
    """提取症状 (关键词匹配)"""
    found = []
    for s in SYMPTOM_KEYWORDS:
        if s in content:
            count = content.count(s)
            found.append({'name': s, 'count': count})
    return found

# ============================================================
# 主流程
# ============================================================
print("=" * 70)
print("v2.2 final: 重新提取所有医案脉诊 (一案一脉诊)")
print("=" * 70)

all_cases = []
case_id = 0

for label, fn, src_label in SRC_FILES:
    fp = ORIG_DIR / fn
    if not fp.exists():
        print(f"⚠️ {fn} 不存在")
        continue

    text = normalize_text(fp.read_text(encoding='utf-8', errors='ignore'))
    print(f"\n📖 {src_label} ({fn}): {len(text):,} 字符")

    cases = split_into_cases(text, label, fn)
    print(f"   切出 {len(cases)} 条")

    for c in cases:
        case_id += 1
        pulse_sigs = extract_pulse_signature(c['content'])
        pulse_chars = extract_pulse_chars(pulse_sigs)

        # 脉象签名 (优先最长的)
        if pulse_sigs:
            pulse_signature_raw = max(pulse_sigs, key=lambda x: len(x['sig']))['sig']
            pulse_window = '; '.join(s['text'] for s in pulse_sigs[:3])  # 最多 3 个
        else:
            pulse_signature_raw = ''
            pulse_window = ''

        c_unified = {
            'case_id': case_id,
            'src_file': c['src_file'],
            'src_label': c['src_label'],
            'src_location': c['src_location'],
            'title': c['title'],
            'title_raw': c['title_raw'],
            'content': c['content'],
            'content_excerpt': c['content'][:200],
            'pulse_signature_raw': pulse_signature_raw,
            'pulse_chars': pulse_chars,
            'pulse_window': pulse_window,
            'pulse_count': len(pulse_sigs),
            'formulas': extract_formulas(c['content']),
            'symptoms': extract_symptoms(c['content']),
            'has_pulse': bool(pulse_sigs),
            'content_length': len(c['content']),
        }
        all_cases.append(c_unified)

# 统计
print(f"\n{'=' * 70}")
print(f"✅ 总提取: {len(all_cases)} 条医案/方剂")
print(f"   有脉象: {sum(1 for c in all_cases if c['has_pulse'])} 条 ({sum(1 for c in all_cases if c['has_pulse'])/len(all_cases)*100:.1f}%)")
print(f"   有方剂: {sum(1 for c in all_cases if c['formulas'])} 条")
print(f"   有症状: {sum(1 for c in all_cases if c['symptoms'])} 条")

# 按 src_label 统计
from collections import Counter
src_dist = Counter(c['src_label'] for c in all_cases)
print(f"\n=== 按篇分布 ===")
for label, n in src_dist.most_common():
    with_pulse = sum(1 for c in all_cases if c['src_label'] == label and c['has_pulse'])
    print(f"  {label}: {n} 条 (有脉象 {with_pulse} 条, {with_pulse/n*100:.0f}%)")

# 脉象字符 Top 30
char_counter = Counter()
for c in all_cases:
    for ch in c['pulse_chars']:
        char_counter[ch] += 1
print(f"\n=== 28 脉单字 Top 30 ===")
for ch, n in char_counter.most_common(30):
    print(f"  {ch}: {n} 条")

# 脉象组合 Top 20
sig_counter = Counter()
for c in all_cases:
    if c['pulse_signature_raw']:
        sig_counter[c['pulse_signature_raw']] += 1
print(f"\n=== 脉象组合 Top 20 (共 {len(sig_counter)} 种唯一组合) ===")
for sig, n in sig_counter.most_common(20):
    print(f"  {sig}: {n} 条")

# 张锡纯特色 (重按/关前/两尺/弦长有力 等)
ZX_PATTERNS = [
    '弦长有力', '重按不实', '按之不实', '重按甚实', '重按无', '按之即无',
    '上盛下虚', '两尺无根', '两尺不任', '关前', '右寸独', '弦硬而长', '弦硬大',
    '重按无力', '按之有力', '按之虚', '参伍不调', '六脉皆闭', '和缓',
]
print(f"\n=== 张锡纯特色 19 项 ===")
for p in ZX_PATTERNS:
    cnt = sum(1 for c in all_cases if p in c['content'])
    print(f"  {p}: {cnt} 条")

# 保存
output = {
    'version': 'v2.2',
    'method': '按 X.方名/X、病名 切分边界, 完整 content 保留, 脉象按"诊其脉...句号"取完整描述',
    'case_count': len(all_cases),
    'pulse_chinese_28': PULSE_28,
    'zx_patterns': ZX_PATTERNS,
    'src_distribution': dict(src_dist),
    'pulse_chars_freq': dict(char_counter),
    'pulse_signatures_count': len(sig_counter),
    'cases': all_cases,
}

out_path = Path("/workspace/zhangxichun-bianzhi/assets/data/cases_unified_v2.2.json")
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

print(f"\n✅ 输出: {out_path}")
print(f"   size: {out_path.stat().st_size:,} bytes")
