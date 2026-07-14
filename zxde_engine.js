/* ZXDE v6 JS Engine - 症状-方剂投票引擎
 * 配套: zxde_data.js (方剂+症状+脉象反向索引)
 * 用法: diagnose(symptomsStr, pulseStr) -> {query, top_k, recommend}
 */

// ==================== 同义词归并词典 ====================
const SYNONYM_GROUPS = {
    "短气": ["短气", "气短", "气息不足", "气不够用", "气息不接", "呼吸短", "短气不足以息"],
    "胸闷": ["胸闷", "闷", "胸中满闷", "胸中闷", "胸膈满闷", "胸满", "胸次"],
    "喘": ["喘", "气喘", "喘息", "喘促", "气促", "喘急"],
    "咳嗽": ["咳嗽", "咳", "嗽"],
    "乏力": ["乏力", "无力", "倦怠", "疲乏", "神疲", "倦怠嗜卧"],
    "自汗": ["自汗", "汗出", "汗多", "动则汗出", "漏汗"],
    "心悸": ["心悸", "心跳", "怔忡", "心慌", "心怔", "惊悸"],
    "失眠": ["失眠", "不寐", "少寐", "寐差", "睡不着", "多梦"],
    "纳呆": ["纳呆", "不思食", "食欲不振", "不欲食", "食少", "不能食", "纳少", "不能饮食"],
    "泄泻": ["泄泻", "腹泻", "下泻", "泻", "大便溏", "溏泻", "下利"],
    "便秘": ["便秘", "大便干", "便结", "燥屎", "便闭", "不大便"],
    "头晕": ["头晕", "眩晕", "头眩", "目眩", "晕", "昏眩"],
    "腰痛": ["腰痛", "腰酸", "腰疼", "腰膝酸软", "腰脊痛"],
    "畏寒": ["畏寒", "恶寒", "身寒", "寒热"],
    "肢厥": ["四肢厥冷", "肢冷", "手足冷", "厥冷", "四肢逆冷", "四肢不温"],
    "面赤": ["面赤", "颧红", "面红", "满面通红", "面色红"],
    "浮肿": ["浮肿", "水肿", "肿", "面目浮肿", "足肿"],
    "麻木": ["麻木", "木", "不知痛痒", "肌肤不仁", "肢体不仁"],
    "疼痛": ["痛", "疼", "疼痛"],
    "中风": ["中风", "卒中", "半身不遂", "口眼歪斜", "喎斜"],
    "崩漏": ["崩漏", "血崩", "月经过多", "经血不止", "下血不止"],
    "发热": ["发热", "热", "身热", "壮热", "微热", "灼热", "烦热"],
    "口渴": ["口渴", "思饮", "喜饮", "大渴", "渴"],
    "烦躁": ["烦躁", "烦", "躁", "心烦", "躁扰"],
    "神昏": ["神昏", "昏愦", "昏迷", "不省人事", "昏不知人"],
    "呕吐": ["呕吐", "呕", "吐", "干呕", "恶心", "欲吐"],
    "腹胀": ["腹胀", "胀", "腹满", "胀满", "痞满"],
    "小便不利": ["小便不利", "癃闭", "小便不通", "淋"],
    "痰": ["痰", "痰多", "痰饮", "痰涎壅盛", "吐痰"],
    "出血": ["出血", "血", "吐血", "衄血", "便血", "尿血", "咯血", "下血"],
};

const PULSE_SYNONYMS = {
    "数": ["数", "数脉", "脉数", "脉数至", "至数"],
    "迟": ["迟", "迟脉", "脉迟"],
    "弦": ["弦", "弦脉", "脉弦", "弦硬", "弦细", "弦数", "弦滑"],
    "滑": ["滑", "滑脉", "脉滑"],
    "涩": ["涩", "涩脉", "脉涩"],
    "细": ["细", "细脉", "脉细", "细数", "细弱", "微细"],
    "虚": ["虚", "虚脉", "脉虚", "虚大", "虚数", "虚而"],
    "实": ["实", "实脉", "脉实"],
    "大": ["大", "脉大", "洪大", "洪"],
    "洪": ["洪", "洪大", "洪脉"],
    "沉": ["沉", "沉脉", "脉沉", "沉细", "沉弦", "沉紧", "沉微", "沉弱"],
    "浮": ["浮", "浮脉", "脉浮"],
    "紧": ["紧", "紧脉", "脉紧", "弦紧"],
    "缓": ["缓", "缓脉", "脉缓"],
    "弱": ["弱", "弱脉", "脉弱", "虚弱", "无力"],
    "微": ["微", "微脉", "脉微", "微弱"],
    "短": ["短", "短脉", "脉短", "短缩"],
    "长": ["长", "长脉", "脉长"],
    "芤": ["芤", "芤脉", "脉芤"],
    "濡": ["濡", "濡脉"],
    "动": ["动", "动脉"],
    "结": ["结", "结脉"],
    "代": ["代", "代脉"],
    "促": ["促", "促脉"],
    "有力": ["有力"],
    "无力": ["无力", "无根", "不任按"],
};

const MOD_PRIOR = {
    "短气": ["1_气虚虚劳与急救", "2_胸腹气机升降", "5_痰饮喘息与肺"],
    "胸闷": ["2_胸腹气机升降", "5_痰饮喘息与肺", "1_气虚虚劳与急救"],
    "喘": ["5_痰饮喘息与肺", "1_气虚虚劳与急救"],
    "咳嗽": ["5_痰饮喘息与肺"],
    "乏力": ["1_气虚虚劳与急救"],
    "自汗": ["1_气虚虚劳与急救", "2_胸腹气机升降"],
    "心悸": ["2_胸腹气机升降", "1_气虚虚劳与急救"],
    "失眠": ["1_气虚虚劳与急救"],
    "纳呆": ["6_脾胃泄泻与消渴"],
    "泄泻": ["6_脾胃泄泻与消渴"],
    "便秘": ["3_伤寒温病与热病", "6_脾胃泄泻与消渴"],
    "头晕": ["4_脑卒中与气血上逆", "1_气虚虚劳与急救"],
    "腰痛": ["1_气虚虚劳与急救", "7_女科男科与杂症"],
    "畏寒": ["1_气虚虚劳与急救", "3_伤寒温病与热病"],
    "肢厥": ["1_气虚虚劳与急救", "3_伤寒温病与热病"],
    "面赤": ["3_伤寒温病与热病", "4_脑卒中与气血上逆"],
    "浮肿": ["6_脾胃泄泻与消渴", "5_痰饮喘息与肺"],
    "麻木": ["4_脑卒中与气血上逆", "3_伤寒温病与热病"],
    "中风": ["4_脑卒中与气血上逆"],
    "崩漏": ["7_女科男科与杂症"],
    "发热": ["3_伤寒温病与热病"],
    "口渴": ["3_伤寒温病与热病"],
    "烦躁": ["3_伤寒温病与热病", "1_气虚虚劳与急救"],
    "神昏": ["3_伤寒温病与热病", "4_脑卒中与气血上逆"],
    "呕吐": ["6_脾胃泄泻与消渴", "3_伤寒温病与热病"],
    "腹胀": ["6_脾胃泄泻与消渴", "2_胸腹气机升降"],
    "小便不利": ["6_脾胃泄泻与消渴"],
    "痰": ["5_痰饮喘息与肺"],
    "出血": ["3_伤寒温病与热病", "1_气虚虚劳与急救"],
};

const SYMPTOM_RULES = [
    {
        name: "脑充血中风",
        must_have_any: ["头晕", "麻木", "中风", "面赤", "肢厥"],
        must_have_pulse_any: ["弦", "有力"],
        boost: ["镇肝熄风汤", "建瓴汤", "脑血立通汤", "脑充血头疼", "脑充血兼痰厥", "论脑充血之原因及治法", "息风汤"],
        score: 5.0,
    },
    {
        name: "少阴伤寒",
        must_have_any: ["肢厥", "畏寒", "泄泻"],
        must_have_pulse_any: ["沉", "微", "迟"],
        boost: ["通脉四逆汤", "白通加猪胆汁汤", "急救回阳汤", "敦复汤", "回阳升陷汤", "少阴病提纲及意义", "少阴病白通汤证及白通加猪胆汁汤证"],
        score: 4.0,
    },
    {
        name: "女科崩漏",
        must_have_any: ["崩漏", "出血"],
        boost: ["固冲汤", "清带汤", "寿胎丸", "安冲汤", "理中汤", "温中汤"],
        score: 4.0,
    },
    {
        name: "阳明热盛",
        must_have_any: ["发热", "口渴", "烦躁"],
        must_have_pulse_any: ["洪", "大"],
        boost: ["白虎加人参汤", "白虎加人参以山药代粳米汤", "白虎汤", "白虎承气汤", "石膏解", "寒解汤", "凉解汤", "仙露汤", "石膏粳米汤", "温病遗方"],
        score: 4.0,
    },
    {
        name: "痰饮咳嗽",
        must_have_all: ["痰", "咳嗽"],
        boost: ["理饮汤", "理痰汤", "龙理痰汤", "期颐饼", "健脾化痰丸", "寒降汤", "清降汤", "保元寒降汤", "二鲜饮", "清金益气汤", "沃雪汤", "水晶桃", "论肺病治法", "肺劳喘咳", "肺劳喘嗽兼不寐证", "从龙汤", "总论喘证治法"],
        score: 3.0,
    },
    {
        name: "脾胃泄泻",
        must_have_any: ["泄泻", "腹胀"],
        boost: ["薯蓣粥", "薯蓣鸡子黄粥", "三宝粥", "天水涤肠汤", "通变白头翁汤", "加味苓桂术甘汤", "扶中汤", "益脾饼", "论痢证治法", "急救回阳汤", "论霍乱治法", "温病兼下痢", "芍药汤", "白头翁汤"],
        score: 2.5,
    },
    {
        name: "大气下陷",
        must_have_any: ["短气", "胸闷", "自汗", "乏力"],
        boost: ["升陷汤", "醒脾升陷汤", "理郁升陷汤", "回阳升陷汤", "升降汤", "培脾舒肝汤"],
        score: 3.0,
    },
];

// ==================== Query 解析 ====================
function parseQuery(symptomsStr, pulseStr) {
    const text = (symptomsStr || "") + " " + (pulseStr || "");
    const querySym = new Set();
    for (const [main, alts] of Object.entries(SYNONYM_GROUPS)) {
        for (const alt of alts) {
            if (text.indexOf(alt) >= 0) {
                querySym.add(main);
                break;
            }
        }
    }
    const queryPulse = new Set();
    for (const [main, alts] of Object.entries(PULSE_SYNONYMS)) {
        for (const alt of alts) {
            if (text.indexOf(alt) >= 0) {
                queryPulse.add(main);
                break;
            }
        }
    }
    return {
        症状: [...querySym],
        脉象: [...queryPulse],
    };
}

// ==================== 引擎主函数 ====================
function diagnose(symptomsStr, pulseStr, topK = 5) {
    const q = parseQuery(symptomsStr, pulseStr);
    if (q.症状.length === 0 && q.脉象.length === 0) {
        return { error: "未提取到任何症状或脉象", query: q };
    }
    if (typeof ZXDE_DATA === "undefined") {
        return { error: "未加载 zxde_data.js" };
    }

    const { sym_to_formula, pulse_to_formula, formula_mod, formula_cases } = ZXDE_DATA;
    const formulaScores = {};
    const formulaHit = {};

    function addScore(fn, score, hitSym) {
        formulaScores[fn] = (formulaScores[fn] || 0) + score;
        if (hitSym) {
            if (!formulaHit[fn]) formulaHit[fn] = new Set();
            formulaHit[fn].add(hitSym);
        }
    }

    // 症状投票
    for (const s of q.症状) {
        const direct = sym_to_formula[s] || {};
        for (const [fn, c] of Object.entries(direct)) {
            const n = Math.max(1, formula_cases[fn] || 1);
            addScore(fn, c / Math.log(2 + n), s);
        }
        const alts = SYNONYM_GROUPS[s] || [];
        for (const alt of alts) {
            if (alt === s) continue;
            const altData = sym_to_formula[alt] || {};
            for (const [fn, c] of Object.entries(altData)) {
                const n = Math.max(1, formula_cases[fn] || 1);
                addScore(fn, 0.5 * c / Math.log(2 + n));
            }
        }
    }

    // 脉形投票
    for (const p of q.脉象) {
        const direct = pulse_to_formula[p] || {};
        for (const [fn, c] of Object.entries(direct)) {
            const n = Math.max(1, formula_cases[fn] || 1);
            addScore(fn, 0.3 * c / Math.log(2 + n));
        }
        const alts = PULSE_SYNONYMS[p] || [];
        for (const alt of alts) {
            if (alt === p) continue;
            const altData = pulse_to_formula[alt] || {};
            for (const [fn, c] of Object.entries(altData)) {
                const n = Math.max(1, formula_cases[fn] || 1);
                addScore(fn, 0.15 * c / Math.log(2 + n));
            }
        }
    }

    // 模块先验
    for (const s of q.症状) {
        const priors = MOD_PRIOR[s];
        if (!priors) continue;
        const primary = priors[0];
        for (const fn of Object.keys(formulaScores)) {
            const fmod = formula_mod[fn];
            if (fmod === primary) {
                addScore(fn, 1.0);
            } else if (priors.slice(1).indexOf(fmod) >= 0) {
                addScore(fn, 0.3);
            }
        }
    }

    // 症状硬关联规则
    for (const rule of SYMPTOM_RULES) {
        let ok = false;
        if (rule.must_have_any) {
            ok = rule.must_have_any.some(s => q.症状.indexOf(s) >= 0);
        }
        if (!ok && rule.must_have_all) {
            ok = rule.must_have_all.every(s => q.症状.indexOf(s) >= 0);
        }
        if (ok && rule.must_have_pulse_any) {
            ok = rule.must_have_pulse_any.some(p => q.脉象.indexOf(p) >= 0);
        }
        if (ok) {
            for (const fn of rule.boost) {
                addScore(fn, rule.score);
            }
        }
    }

    // 排序
    const top = Object.entries(formulaScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topK)
        .map(([fn, score], i) => ({
            rank: i + 1,
            formula: fn,
            module: formula_mod[fn] || "0_药物解与其他",
            score: Math.round(score * 1000) / 1000,
            hit_symptoms: formulaHit[fn] ? [...formulaHit[fn]] : [],
            sub_count: formula_cases[fn] || 0,
        }));

    return {
        query: q,
        top_k: top,
        recommend: top.length > 0 ? {
            formula: top[0].formula,
            module: top[0].module,
            score: top[0].score,
        } : null,
    };
}

// 暴露到全局
if (typeof window !== "undefined") {
    window.ZXDE = { diagnose, parseQuery, SYNONYM_GROUPS, PULSE_SYNONYMS, MOD_PRIOR, SYMPTOM_RULES };
}
