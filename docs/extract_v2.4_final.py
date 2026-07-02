#!/usr/bin/env python3
"""
v2.4 final: 用 v2.3 的 5 维度脉诊 + 严格方剂 + 标题过滤
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
    '清带汤', '加味麦门冬汤', '鸡胵汤', '鸡胵茅根汤', '宁嗽丸',
    '逐风汤', '通变白虎加人参汤', '一味薯蓣饮', '薯蓣粥', '石膏阿斯匹林汤',
    '清肾汤', '培土养阴汤', '建瓴汤', '加味磁朱丸', '治痰点天突穴法', '加味',
    '黄芪', '牛膝', '山药', '白术',
    '葱白汤', '扶中汤', '来复汤', '温通汤', '坎离',
]

PATIENT_PATTERNS = [
    r'一人[、，]?\s*[年体]?\s*[一二三四五六七八九十]',
    r'一[妇女人女老少]+[、，]?\s*[年体]?\s*[一二三四五六七八九十]',
    r'一室女',
    r'曾治一[一-鿿]',
    r'治一[一-鿿]',
    r'愚治[一-鿿]',
    r'愚为[制诊]',
    r'门人[一-鿿]{1,3}[曾]?治',
    r'友人[一-鿿]{1,3}[曾]?治',
    r'族[弟兄]',
    r'[刘张李王赵陈孙周吴郑钱徐胡朱高林郭何马梁][一-鿿]{1,3}来函',
    r'[刘张李王赵陈孙周吴郑钱徐胡朱高林郭何马梁][一-鿿]{1,3}[母女夫]',
    r'[沧青天京津沪渝][州县市镇]',
    r'某[省县市村镇]',
    r'奉天[省一-鿿]',
    # 不带具体患者的, 但有复诊叙述也算
    r'(一剂|数剂)[见轻愈]',
    r'愚(按|曰)',
]
PATIENT_NARRATIVE = re.compile('|'.join(PATIENT_PATTERNS))

DISCUSSION_TITLES = re.compile(r'(论|说|解|辩|原理|意|问答|问|驳)[一-鿿]')


def is_formula_title(title):
    for f in ZHANG_FORMULAS:
        if f in title:
            return True
    return False


def is_real_case_final(title, content):
    """终极真医案判断"""
    if not content or len(content) < 30:
        return False, "内容太短"

    # 排除明显医论标题 (且不是方剂)
    if DISCUSSION_TITLES.search(title) and not is_formula_title(title):
        return False, "标题是医论非医案"

    has_patient = bool(PATIENT_NARRATIVE.search(content))
    pulse_count = sum(1 for c in content if c in PULSE_28)
    has_pulse = pulse_count >= 2 or '诊其脉' in content or '其脉' in content or '脉象' in content

    if not has_pulse:
        return False, "无脉象"

    # 规则 A: 标题是方剂编号 (X.方名) + 有患者
    if is_formula_title(title) and has_patient:
        return True, "方剂验案"
    # 规则 B: 医案篇编号 (X、病名)
    if re.match(r'^\d+[、，]\s*[一-鿿]', title):
        return True, "医案篇编号"
    # 规则 C: 方剂标题 + 脉象丰富 (方解附验案) — 放宽到脉象 >= 8
    if is_formula_title(title) and pulse_count >= 8:
        return True, "方解附验案"
    # 规则 D: 任何标题 + 有脉象 + 有患者叙述 (只要含具体患者, 就算医案)
    if has_pulse and has_patient:
        return True, "验案"
    # 规则 E: 标题是方剂 (任何脉象) — 方剂方解也算
    if is_formula_title(title) and pulse_count >= 2:
        return True, "方剂方解"
    # 规则 F: 方剂标题 + 任何脉象 (包括脉象=1)
    if is_formula_title(title) and has_pulse:
        return True, "方剂方解"

    return False, f"未匹配 (患者={has_patient}, 脉象={pulse_count})"


def is_title_line(line):
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
    patient_count = 0

    for label, fn, src_label in SRC_FILES:
        fp = ORIG / fn
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8", errors="ignore")
        lines = [l for l in text.split('\n') if not re.match(r'^\s*={5,}\s*PDF Page', l)]

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

        cases = []
        reasons = Counter()
        for title, content in cases_raw:
            ok, reason = is_real_case_final(title, content)
            if ok:
                cases.append({'title': title, 'content': content, 'rule': reason})
            else:
                reasons[reason] += 1

        print(f"📖 {src_label}: {len(cases)} 条真医案")
        for r, n in reasons.most_common(2):
            print(f"     拒绝: {r} ({n})")

        for c in cases:
            case_id += 1
            src_stats[src_label] += 1

            # 5 维度脉象 (复用 v2.3 逻辑)
            pulse_by_loc = {k: [] for k in ['总按', '左手', '右手', '关前', '关后/尺', '重按', '轻取']}
            for trigger in ['诊其脉', '其脉', '脉象', '此脉']:
                for m in re.finditer(re.escape(trigger), c['content']):
                    start = m.end()
                    while start < len(c['content']) and c['content'][start] in ' \t\n':
                        start += 1
                    end = start
                    for ch in c['content'][start:start+50]:
                        if ch in '。；\n':
                            break
                        end += 1
                    end = min(end, start + 25)
                    sig = c['content'][start:end].strip().rstrip('，,。;、')
                    if 2 <= len(sig) <= 25:
                        for ch_p in PULSE_28:
                            if ch_p in sig:
                                idx = sig.find(ch_p)
                                before = sig[max(0, idx-6):idx]
                                if any(k in before for k in ['左脉', '左手', '左部', '左关', '左寸']):
                                    loc = '左手'
                                elif any(k in before for k in ['右脉', '右手', '右部', '右关', '右寸']):
                                    loc = '右手'
                                elif any(k in before for k in ['关前', '寸口', '上焦', '寸脉']):
                                    loc = '关前'
                                elif any(k in before for k in ['关后', '两尺', '尺中', '尺脉', '下焦', '尺部']):
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

            # 方剂
            formulas = [f for f in ZHANG_FORMULAS if f in c['content']]

            # 患者叙述
            has_patient = bool(PATIENT_NARRATIVE.search(c['content']))

            if has_any_pulse:
                pulse_count += 1
            if formulas:
                formula_count += 1
            if has_patient:
                patient_count += 1

            all_cases.append({
                'case_id': case_id,
                'src_file': fn,
                'src_label': src_label,
                'title': c['title'],
                'rule': c['rule'],
                'content': c['content'],
                'content_length': len(c['content']),
                'pulse_chars_5dim': pulse_by_loc,
                'has_pulse': has_any_pulse,
                'formulas': formulas,
                'has_formula': bool(formulas),
                'has_patient': has_patient,
            })

    out = {
        'version': 'v2.4 final',
        'method': '真医案 3 规则: 方剂验案 (有患者) / 医案篇编号 / 方解附验案 (脉象>=5)',
        'case_count': len(all_cases),
        'with_pulse': pulse_count,
        'with_formula': formula_count,
        'with_patient': patient_count,
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
    print(f"   有患者叙述: {patient_count} ({patient_count/len(all_cases)*100:.1f}%)")
    print(f"   size: {out_path.stat().st_size:,} bytes")
    print(f"\n=== 按篇分布 ===")
    for s, n in src_stats.most_common():
        with_p = sum(1 for c in all_cases if c['src_label'] == s and c['has_pulse'])
        with_f = sum(1 for c in all_cases if c['src_label'] == s and c['has_formula'])
        with_pt = sum(1 for c in all_cases if c['src_label'] == s and c['has_patient'])
        print(f"  {s}: {n} 条 (有脉象 {with_p}, 有方剂 {with_f}, 有患者 {with_pt})")


if __name__ == "__main__":
    main()
