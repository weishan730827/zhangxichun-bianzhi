#!/usr/bin/env python3
"""
v2.4 终极版: 区分"医论/方解"vs"真医案"

真医案硬条件:
1. 标题是方剂编号 X.方名 OR 医案编号 X、病名
2. 标题里的方名 在张锡纯方剂库
3. 标题/内容里出现"一人/一妇/某氏/某X来函/门人X治/友人X治/愚为X治"
4. 至少 1 个脉象描述

OR

1. 标题是 X、病名 (医案篇)
2. 至少 1 个脉象
3. 至少 30 字符
"""
import json
import re
from pathlib import Path
from collections import Counter

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

PULSE_28 = '浮沉伏迟数疾缓虚实滑涩弦紧细微弱洪大长短濡芤革牢动促结代散'

# 78 个张锡纯方剂 (从校后_v2 全文统计)
ZHANG_FORMULAS = [
    '升陷汤', '白虎加人参汤', '理饮汤', '滋培汤', '龙骨牡蛎汤', '健脾化痰丸',
    '秘红丹', '化血丹', '磁朱丸', '镇肝熄风汤', '起痿汤', '搜风汤',
    '急救回生丹', '卫生防疫宝丹', '滋阴清燥汤', '清解汤', '宣解汤', '凉解汤',
    '寒解汤', '醴泉饮', '参麦汤', '十全育真汤', '资生汤', '扶中汤',
    '醒脾升陷汤', '升降汤', '培脾疏肝汤', '金铃泻肝汤', '活络效灵丹',
    '内托生肌散', '托里消毒散', '振颓汤', '振颓丸', '黄芪膏',
    '清金解毒汤', '清金益气汤', '安肺宁嗽丸', '清凉华盖饮', '保元寒降汤',
    '保元清降汤', '温降汤', '清降汤', '保和汤', '白前汤', '二鲜饮', '三鲜饮',
    '化瘀理膈丹', '急救回阳汤', '加味苓桂术甘汤', '加味四神丸', '敦复汤',
    '补脑振痿汤', '振中汤', '理中汤', '活络祛寒汤', '健运汤', '曲直汤',
    '来复汤', '既济汤', '黄芪五物汤', '黄芪建中汤', '薯蓣纳气汤', '参赭镇气汤',
    '赭遂攻结汤', '镇逆汤', '坎离互根汤', '寿胎丸', '安冲汤', '固冲汤',
    '清带汤', '加味麦门冬汤', '鸡胵汤', '鸡胵茅根汤', '宁嗽丸', '葱白汤',
    '硝石', '逐风汤', '通变白虎加人参汤', '一味薯蓣饮', '薯蓣粥', '白虎加人参以山药代粳米汤',
    '清肾汤', '肾气丸', '培土养阴汤', '新拟', '建瓴汤', '清降汤', '石膏阿斯匹林汤',
]

# 医案叙述信号 (必须有具体患者)
PATIENT_PATTERNS = [
    r'一人[、，]?\s*[年体]?\s*[一二三四五六七八九十]',  # 一人、年二十
    r'一[妇女人女老少]+[、，]?\s*[年体]?\s*[一二三四五六七八九十]',  # 一妇人、年四十
    r'一室女',  # 一室女
    r'曾治一[一-鿿]',  # 曾治一
    r'治一[一-鿿]',  # 治一
    r'愚治[一-鿿]',  # 愚治
    r'愚为[制诊]',  # 愚为制/愚为诊
    r'门人[一-鿿]{1,3}[曾]?治',  # 门人高X曾治
    r'友人[一-鿿]{1,3}[曾]?治',  # 友人毛X曾治
    r'族[弟兄]',  # 族弟
    r'[刘张李王赵陈孙周吴郑钱徐胡朱高林郭何马梁][一-鿿]{1,3}来函',  # 高X来函
    r'[刘张李王赵陈孙周吴郑钱徐胡朱高林郭何马梁][一-鿿]{1,3}[母女夫]',  # 高X母
    r'[沧青天京津沪渝][州县市镇]',  # 沧州 / 青县
    r'某[省县市村镇]',  # 某省
    r'奉天[省一-鿿]',  # 奉天省
]
PATIENT_NARRATIVE = re.compile('|'.join(PATIENT_PATTERNS))

# 医论标题 (要排除)
DISCUSSION_TITLES = re.compile(r'论[一-鿿]|说[一-鿿]|解[一-鿿]|辩[一-鿿]|原[一-鿿]|理[一-鿿]|意[一-鿿]')


def is_formula_title(title):
    """标题是方剂名吗"""
    for f in ZHANG_FORMULAS:
        if f in title:
            return True
    return False


def is_real_case_strict(title, content):
    """
    终极判断: 是不是真医案

    规则 A: 标题是 "X. 方名" + 标题/内容含具体患者叙述 + 含脉象
    规则 B: 标题是 "X、病名" (医案篇) + 含脉象
    规则 C: 标题是方剂名 + 内容含具体患者 + 含脉象 (验案)
    """
    if not content or len(content) < 30:
        return False, "内容太短"

    # 排除明显医论
    if DISCUSSION_TITLES.search(title) and not is_formula_title(title):
        return False, "标题是医论非医案"

    has_patient = bool(PATIENT_NARRATIVE.search(content))
    pulse_count = sum(1 for c in content if c in PULSE_28)
    has_pulse = pulse_count >= 2 or '诊其脉' in content or '其脉' in content or '脉象' in content

    if not has_pulse:
        return False, "无脉象"

    # 规则 A: 方剂标题 (X.方名) + 患者叙述
    if is_formula_title(title) and has_patient:
        return True, "方剂验案"

    # 规则 B: 医案篇编号 (X、病名)
    if re.match(r'^\d+[、，]\s*[一-鿿]', title):
        return True, "医案篇编号"

    # 规则 C: 方剂名 + 患者 + 脉象 (就是规则 A)
    # 已经在上面处理

    # 规则 D: 标题是 "论方义" 类但有具体验案
    if is_formula_title(title) and pulse_count >= 5:
        return True, "方解附验案"

    return False, f"未匹配 (有患者={has_patient}, 脉象数={pulse_count})"


def is_title_line(line):
    """判断是否是标题行"""
    s = line.strip()
    if not s or len(s) > 60:
        return False
    if re.match(r'^\d+[、．\.]\s*\S{2,40}$', s):
        return True
    if re.match(r'^\d{1,2}[、．\.]\s*\d+$', s):
        return False
    if re.match(r'^\d+[、，]\s*[一-鿿]{2,40}$', s):
        return True
    if re.match(r'^[一二三四五六七八九十]+[、．\.]\s*\S{2,40}$', s):
        return True
    return False


def main():
    all_cases = []
    case_id = 0
    src_stats = Counter()
    src_rejected = Counter()
    src_reject_reasons = {}
    pulse_count = 0
    formula_count = 0

    for label, fn, src_label in SRC_FILES:
        fp = ORIG / fn
        if not fp.exists():
            print(f"⚠️ {fn} 不存在")
            continue
        text = fp.read_text(encoding="utf-8", errors="ignore")
        lines = [l for l in text.split('\n') if not re.match(r'^\s*={5,}\s*PDF Page', l)]

        # 切分
        cases_raw = []
        current_title = None
        current_content = []
        for line in lines:
            if is_title_line(line):
                if current_title and current_content:
                    content = '\n'.join(current_content).strip()
                    cases_raw.append((current_title, content))
                current_title = line.strip()
                current_content = []
            else:
                line_s = line.strip()
                if line_s and current_title:
                    current_content.append(line_s)
        if current_title and current_content:
            content = '\n'.join(current_content).strip()
            cases_raw.append((current_title, content))

        # 过滤
        cases = []
        rejected = 0
        reasons = Counter()
        for title, content in cases_raw:
            ok, reason = is_real_case_strict(title, content)
            if ok:
                cases.append({'title': title, 'content': content, 'rule': reason})
            else:
                rejected += 1
                reasons[reason] += 1

        print(f"📖 {src_label}: {len(cases)} 条真医案 (拒绝 {rejected})")
        for r, n in reasons.most_common(3):
            print(f"     拒绝原因: {r} ({n})")

        for c in cases:
            case_id += 1
            src_stats[src_label] += 1

            # 提取脉象
            pulse_sigs = []
            for trigger in ['诊其脉', '其脉', '脉象']:
                for m in re.finditer(re.escape(trigger), c['content']):
                    start = m.end()
                    end = start
                    for ch in c['content'][start:start+50]:
                        if ch in '。；\n':
                            break
                        end += 1
                    sig = c['content'][start:min(end, start+25)].strip().rstrip('，,。;、')
                    if 2 <= len(sig) <= 25 and any(p in sig for p in PULSE_28):
                        pulse_sigs.append(sig)

            formulas = [f for f in ZHANG_FORMULAS if f in c['content']]

            if pulse_sigs:
                pulse_count += 1
            if formulas:
                formula_count += 1

            all_cases.append({
                'case_id': case_id,
                'src_file': fn,
                'src_label': src_label,
                'title': c['title'],
                'rule': c['rule'],
                'content': c['content'],
                'content_length': len(c['content']),
                'pulse_signatures': pulse_sigs,
                'has_pulse': bool(pulse_sigs),
                'formulas': formulas,
                'has_formula': bool(formulas),
            })

    out = {
        'version': 'v2.4 (strict)',
        'method': '真医案 3 规则: 方剂验案 / 医案篇编号 / 方解附验案. 排除医论.',
        'case_count': len(all_cases),
        'with_pulse': pulse_count,
        'with_formula': formula_count,
        'by_src': dict(src_stats),
        'cases': all_cases,
    }

    out_path = Path("/workspace/zhangxichun-bianzhi/assets/data/cases_real_v2.4.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\n{'='*60}")
    print(f"✅ v2.4 严格提取完成")
    print(f"   总案例: {len(all_cases)}")
    print(f"   有脉象: {pulse_count} ({pulse_count/len(all_cases)*100:.1f}%)")
    print(f"   有方剂: {formula_count} ({formula_count/len(all_cases)*100:.1f}%)")
    print(f"   size: {out_path.stat().st_size:,} bytes")
    print(f"\n=== 按篇分布 ===")
    for s, n in src_stats.most_common():
        with_p = sum(1 for c in all_cases if c['src_label'] == s and c['has_pulse'])
        with_f = sum(1 for c in all_cases if c['src_label'] == s and c['has_formula'])
        print(f"  {s}: {n} 条 (有脉象 {with_p}, 有方剂 {with_f})")


if __name__ == "__main__":
    main()
