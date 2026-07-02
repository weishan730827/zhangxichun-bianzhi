#!/usr/bin/env python3
"""
v2.5 终极: 1 验案 = 1 段 (从原书按"一人/一妇/曾治/门人X治"切分)

方法: 切分出"X.方名"段后, 在段内继续按患者叙述切分

判断一段内是 1 个验案 vs 多个验案:
- 1 个"X.X"段落里, 数"一[人男女妇妬室女老少]","曾治一","门人[一-鿿]+治"等叙述次数
- 每个叙述 = 1 个独立验案
- 如果 0 个叙述但有"一剂见轻"复诊 = 1 个验案
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
    '清肾汤', '培土养阴汤', '建瓴汤', '加味磁朱丸', '葱白汤',
]

# 验案起始模式 (1 验案 = 1 患者叙述开始)
CASE_START_PATTERNS = [
    r'(?<![\u4e00-\u9fff])一[人男女妇妬室女老少][、，]?\s*[年体]?[一二三四五六七八九十\d]+',  # 一人/一妇人/年四十
    r'(?<![\u4e00-\u9fff])一[人男女妇妬室女老少][、，]?[一二三四五六七八九十\d]+',  # 一人,40 岁
    r'曾治一[一-鿿]',  # 曾治一
    r'治一[一-鿿]',  # 治一
    r'愚治[一-鿿]',  # 愚治
    r'门人[一-鿿]{1,3}[曾]?治',  # 门人高X曾治
    r'友人[一-鿿]{1,3}[曾]?治',  # 友人毛X曾治
    r'族[弟兄]',  # 族弟
    r'[刘张李王赵陈孙周吴郑钱徐胡朱高林郭何马梁][一-鿿]{1,3}来函',  # 高X来函
    r'[刘张李王赵陈孙周吴郑钱徐胡朱高林郭何马梁][一-鿿]{1,3}[母女夫]',  # 高X母
    r'[沧青天京津沪渝][州县市镇][一-鿿]{0,4}[有某]',  # 沧州/青县
    r'奉天[一-鿿]{0,4}',  # 奉天
    r'某[省市县村镇]',  # 某省
    r'(?<![\u4e00-\u9fff])[一-鿿]{1,3}村[一-鿿]{0,2}[，。]',  # 某村
]

CASE_START_RE = re.compile('|'.join(CASE_START_PATTERNS))


def is_title_line(line):
    s = line.strip()
    if not s or len(s) > 60:
        return False
    # 去掉 "### 篇名 #N " 前缀
    s = re.sub(r'^#+\s*篇名\s*#?\d*\s*', '', s)
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


def split_paragraph_into_cases(content, parent_title):
    """
    在 1 个"X. 方名"段落内, 按患者叙述切分成多个验案

    返回 [(case_subtitle, case_content), ...]
    """
    if not content or len(content) < 30:
        return []

    # 找所有患者叙述的起始位置
    matches = list(CASE_START_RE.finditer(content))

    if len(matches) <= 1:
        # 整段 = 1 个验案
        return [(parent_title, content)]

    # 多个患者叙述: 按位置切分
    cases = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i+1].start() if i+1 < len(matches) else len(content)
        case_content = content[start:end].strip()
        if len(case_content) >= 30:
            # 取叙述开头 20 字作为子标题
            subtitle = case_content[:25].replace('\n', ' ')
            cases.append((subtitle, case_content))
    return cases


def is_formula_title(title):
    for f in ZHANG_FORMULAS:
        if f in title:
            return True
    return False


def main():
    all_cases = []
    case_id = 0
    src_stats = Counter()
    src_subcases = Counter()
    pulse_count = 0
    formula_count = 0
    patient_count = 0

    for label, fn, src_label in SRC_FILES:
        fp = ORIG / fn
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8", errors="ignore")
        lines = [l for l in text.split('\n') if not re.match(r'^\s*={5,}\s*PDF Page', l)]

        # 第一步: 切"X.方名"段
        raw_paragraphs = []
        current_title = None
        current_content = []
        for line in lines:
            if is_title_line(line):
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

        # 第二步: 在每段内切验案
        src_para_count = 0
        src_case_count = 0
        for title, content in raw_paragraphs:
            if not content or len(content) < 30:
                continue
            src_para_count += 1
            # 切分
            subcases = split_paragraph_into_cases(content, title)
            src_case_count += len(subcases)

            for sub_title, sub_content in subcases:
                if not sub_content or len(sub_content) < 30:
                    continue

                # 5 维度脉象
                pulse_by_loc = {k: [] for k in ['总按', '左手', '右手', '关前', '关后/尺', '重按', '轻取']}
                for trigger in ['诊其脉', '其脉', '脉象', '此脉']:
                    for m in re.finditer(re.escape(trigger), sub_content):
                        st = m.end()
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
                            for ch_p in PULSE_28:
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

                # 方剂
                formulas = [f for f in ZHANG_FORMULAS if f in sub_content]

                # 患者叙述
                has_patient = bool(CASE_START_RE.search(sub_content))

                if has_any_pulse:
                    pulse_count += 1
                if formulas:
                    formula_count += 1
                if has_patient:
                    patient_count += 1

                case_id += 1
                all_cases.append({
                    'case_id': case_id,
                    'src_file': fn,
                    'src_label': src_label,
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

        src_stats[src_label] = src_para_count
        src_subcases[src_label] = src_case_count

    out = {
        'version': 'v2.5',
        'method': '1 验案 = 1 患者叙述 (X.方名段内继续切分)',
        'case_count': len(all_cases),
        'with_pulse': pulse_count,
        'with_formula': formula_count,
        'with_patient': patient_count,
        'paragraphs_by_src': dict(src_stats),
        'subcases_by_src': dict(src_subcases),
        'cases': all_cases,
    }

    out_path = Path("/workspace/zhangxichun-bianzhi/assets/data/cases_real_v2.5.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\n{'='*60}")
    print(f"✅ v2.5 提取完成")
    print(f"   总验案: {len(all_cases)}")
    print(f"   有脉象: {pulse_count} ({pulse_count/len(all_cases)*100:.1f}%)")
    print(f"   有方剂: {formula_count} ({formula_count/len(all_cases)*100:.1f}%)")
    print(f"   有患者: {patient_count} ({patient_count/len(all_cases)*100:.1f}%)")
    print(f"   size: {out_path.stat().st_size:,} bytes")
    print(f"\n=== 按篇: 段 → 验案 展开 ===")
    for s in src_stats:
        para = src_stats[s]
        sub = src_subcases[s]
        avg = sub / para if para > 0 else 0
        print(f"  {s}: {para} 段 → {sub} 验案 (平均 {avg:.1f} 个验案/段)")


if __name__ == "__main__":
    main()
