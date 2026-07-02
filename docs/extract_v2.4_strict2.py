#!/usr/bin/env python3
"""
v2.4 严格从原书提取 - 第二版

方法: 按 "X. 方名/X、病名" 行切分, 严格判断标题
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

COMMON_FORMULAS = [
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
]

CASE_NARRATIVE = [
    '一剂', '数剂', '数剂全愈', '数剂见轻', '服之', '服后', '服数剂', '服一剂',
    '服药后', '投以此汤', '投以此方', '遂为制', '为制此方', '后延医',
    '延愚', '延医', '延诊', '后愚诊', '愚为诊', '为诊视', '为之诊',
    '治一', '治此', '治之', '治验', '验案', '愈', '全愈', '见轻', '见效',
    '无效', '增剧', '病愈', '后愈', '后未', '后未尝', '近今', '其后',
    '门人', '友人', '曾治', '又治', '再治', '按',
]


def is_case_title_line(line):
    """判断是否是医案/方剂标题行"""
    s = line.strip()
    if not s or len(s) > 60:
        return False
    # X. 方名 (X 为数字)
    if re.match(r'^\d+[、．\.]\s*\S{2,40}$', s):
        return True
    # X. 方名 - 但要排除 "58." "59." 等纯页码
    if re.match(r'^\d{1,2}[、．\.]\s*\d+$', s):
        return False
    # X、病名
    if re.match(r'^\d+[、，]\s*[一-鿿]{2,40}$', s):
        return True
    # 中文数字 X. 方名
    if re.match(r'^[一二三四五六七八九十]+[、．\.]\s*\S{2,40}$', s):
        return True
    return False


def is_real_case(content):
    """判定是否真医案: 4 条件"""
    if not content or len(content) < 30:
        return False, "内容太短"
    pulse_count = sum(1 for c in content if c in PULSE_28)
    if pulse_count < 2 and '诊其脉' not in content and '脉象' not in content and '其脉' not in content:
        return False, "无脉象"
    has_formula = any(f in content for f in COMMON_FORMULAS)
    has_narrative = any(n in content for n in CASE_NARRATIVE)
    if not (has_formula or has_narrative):
        return False, "无方剂无叙述"
    return True, "通过"


def extract_cases(text, src_label):
    """按行扫描, 找标题, 累积内容到下一个标题"""
    lines = text.split('\n')
    # 先去掉 PDF 分页标记
    lines = [l for l in lines if not re.match(r'^\s*={5,}\s*PDF Page', l)]

    cases = []
    current_title = None
    current_content = []
    rejected = 0

    def flush():
        nonlocal rejected
        if current_title and current_content:
            content = '\n'.join(current_content).strip()
            ok, reason = is_real_case(content)
            if ok:
                cases.append({'title': current_title, 'content': content})
            else:
                rejected += 1

    for line in lines:
        if is_case_title_line(line):
            # 收尾
            flush()
            current_content = []
            current_title = line.strip()
        else:
            line_s = line.strip()
            if line_s and current_title:
                current_content.append(line_s)
            elif line_s and not current_title:
                # 段头在标题前的内容 (通常是上一页尾巴), 跳过
                pass

    flush()
    return cases, rejected


def main():
    all_cases = []
    case_id = 0
    src_stats = Counter()
    src_rejected = Counter()
    pulse_count = 0
    formula_count = 0

    for label, fn, src_label in SRC_FILES:
        fp = ORIG / fn
        if not fp.exists():
            print(f"⚠️ {fn} 不存在")
            continue
        text = fp.read_text(encoding="utf-8", errors="ignore")
        cases, rejected = extract_cases(text, src_label)
        print(f"📖 {src_label}: {len(cases)} 条 (拒绝 {rejected})")

        for c in cases:
            case_id += 1
            src_stats[src_label] += 1

            # 提取脉象
            pulse_sigs = []
            for trigger in ['诊其脉', '其脉', '脉象', '此脉']:
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

            # 提取方剂
            formulas = [f for f in COMMON_FORMULAS if f in c['content']]

            if pulse_sigs:
                pulse_count += 1
            if formulas:
                formula_count += 1

            all_cases.append({
                'case_id': case_id,
                'src_file': fn,
                'src_label': src_label,
                'title': c['title'],
                'content': c['content'],
                'content_length': len(c['content']),
                'pulse_signatures': pulse_sigs,
                'has_pulse': bool(pulse_sigs),
                'formulas': formulas,
                'has_formula': bool(formulas),
            })

    out = {
        'version': 'v2.4',
        'method': '按 "X.方名/X、病名/中文编号" 标题切分, 4 条件过滤 (有脉象 + 有方剂/叙述 + 内容>=30)',
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
