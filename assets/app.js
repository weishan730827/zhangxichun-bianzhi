/* 仿张锡纯辨证施治 v0.6 - 完整知识库 + 脉象矩阵 */
'use strict';

let KB = null;
let INPUT_MODE = 'qna';

// 脉象释义（张锡纯/中医基础理论）
const PULSE_MEANING = {
  '浮': '浮脉轻取即得，重按稍减而不空。主表证，亦主虚阳外越。',
  '沉': '沉脉轻取不应，重按始得。主里证。沉而有力为里实，沉而无力为里虚。',
  '迟': '迟脉脉来缓慢，一息不足四至（<60次/分）。主寒证，亦主阳虚。',
  '数': '数脉脉来快速，一息五至以上（>90次/分）。主热证，亦主虚热。',
  '虚': '虚脉举之无力，按之空虚。主气血两虚。张锡纯：「凡虚脉皆元气虚损之象」。',
  '实': '实脉举按皆有力。主实证。张锡纯：「实脉多见于外感实热、痰火、积滞」。',
  '滑': '滑脉往来流利，如珠走盘。主痰饮、食滞、孕脉。张锡纯：「滑而有力为热痰，无力为虚痰」。',
  '涩': '涩脉迟细而短，往来艰涩。主血瘀、气滞、精伤。张锡纯：「涩脉乃气血运行不畅」。',
  '弦': '弦脉端直以长，如按琴弦。主肝胆病、痛证、痰饮。张锡纯：「弦为肝脉」。',
  '紧': '紧脉绷急有力，状如转索。主寒证、痛证。张锡纯：「紧脉乃弦之甚者」。',
  '细': '细脉脉细如线，但应指明显。主气血两虚、诸虚劳损、湿病。张锡纯：「细脉为气血不足」。',
  '弱': '弱脉极软而沉细。主气血不足、阳气虚衰。张锡纯：「弱脉多见于虚损」。',
  '微': '微脉极细极软，似有似无。主阴阳气血诸虚，阳气衰微。张锡纯：「微脉为元阳欲脱」。',
  '洪': '洪脉脉体阔大，滔滔满指，来盛去衰。主热盛、气分热盛。张锡纯：「洪而有力为实热，无力为虚热」。',
  '缓': '缓脉一息四至，从容和缓。主湿病、脾胃虚弱。',
  '大': '大脉脉体阔大，但无汹涌之势。主病进、虚证。张锡纯：「大而无力为虚阳外越」。',
  '濡': '濡脉浮而细软。主虚证、湿证。张锡纯：「濡脉多见于气血不足之体」。',
  '芤': '芤脉浮大中空，如按葱管。主失血、伤阴。张锡纯：「芤脉为阴血大伤」。',
  '革': '革脉浮弦中空，如按鼓皮。主精血亏虚、崩漏、亡血。',
  '牢': '牢脉沉实弦长，坚牢不移。主里实、疝气、癥瘕。',
  '动': '动脉短而滑数，厥厥动摇。主痛证、惊证。',
  '促': '促脉数而时一止，止无定数。主阳盛实热、气血痰食停滞。',
  '结': '结脉缓而时一止，止无定数。主阴盛气结、痰滞血瘀。张锡纯：「结脉非死脉也，气分郁滞使然」。',
  '代': '代脉止有定数，不能自还。主脏气衰微。张锡纯：「代脉多见于气血虚极」。',
};

// 加载知识库
async function loadKB() {
  try {
    const r = await fetch('assets/data/kb.json');
    KB = await r.json();
    console.log(`KB loaded: ${KB.total_formulas} 方剂, ${KB.total_cases} 医案, ${KB.total_pulses} 脉象`);
    return KB;
  } catch (e) {
    console.error('KB load failed', e);
    return null;
  }
}
loadKB();

// 步骤切换
function goStep(step) {
  ['step1','step-look','step-ask','step-pulse','step-result'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const target = 'step-' + step;
  const el = document.getElementById(target);
  if (el) el.classList.remove('hidden');
  window.scrollTo({top: 0, behavior: 'smooth'});
}

// 选择输入方式
document.querySelectorAll('.choice').forEach(btn => {
  btn.addEventListener('click', () => {
    INPUT_MODE = btn.dataset.mode;
    if (INPUT_MODE === 'demo') {
      showDemo();
    } else {
      goStep('look');
    }
  });
});

// ========== 脉象矩阵交互 ==========
// 脉象推荐显示顺序（按张锡纯常用描述次序：沉迟微弱）
const PULSE_ORDER = ['浮','沉','伏','迟','缓','数','疾','虚','实','滑','涩','弦','紧','细','微','弱','洪','大','濡','芤','革','牢','动','促','结','代','长','短','散'];
document.querySelectorAll('.ms').forEach(span => {
  span.addEventListener('click', () => {
    span.classList.toggle('on');
    // 更新对应 hidden input
    const pos = span.dataset.pos;
    const posMap = {
      '左寸': 'pulse_left_cun', '左关': 'pulse_left_guan', '左尺': 'pulse_left_chi',
      '右寸': 'pulse_right_cun', '右关': 'pulse_right_guan', '右尺': 'pulse_right_chi'
    };
    const inputId = posMap[pos];
    const selected = [...document.querySelectorAll(`.ms[data-pos="${pos}"].on`)].map(s => s.textContent);
    // 按推荐顺序排序（如：沉→迟→微→弱 而不是 弱→微→迟→沉）
    selected.sort((a, b) => PULSE_ORDER.indexOf(a) - PULSE_ORDER.indexOf(b));
    document.getElementById(inputId).value = selected.join('');
    // 更新左右脉差分析
    updateDiff();
  });
  // 长按显示释义
  let pressTimer = null;
  span.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => {
      showMeaning(span);
    }, 500);
  });
  span.addEventListener('touchend', () => clearTimeout(pressTimer));
  span.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => showMeaning(span), 500);
  });
  span.addEventListener('mouseup', () => clearTimeout(pressTimer));
  span.addEventListener('mouseleave', () => clearTimeout(pressTimer));
});

function showMeaning(span) {
  const pulse = span.textContent;
  const meaning = PULSE_MEANING[pulse];
  if (!meaning) return;
  // 移除所有已有的释义
  document.querySelectorAll('.pulse-meaning').forEach(el => el.remove());
  // 在该 span 后插入
  const div = document.createElement('div');
  div.className = 'pulse-meaning show';
  div.innerHTML = `<b>${pulse}脉：</b>${meaning}`;
  span.insertAdjacentElement('afterend', div);
  setTimeout(() => div.classList.remove('show'), 4000);
}

// 左右脉差自动识别
function updateDiff() {
  const get = id => document.getElementById(id).value || '';
  const data = {
    左寸: get('pulse_left_cun'),
    左关: get('pulse_left_guan'),
    左尺: get('pulse_left_chi'),
    右寸: get('pulse_right_cun'),
    右关: get('pulse_right_guan'),
    右尺: get('pulse_right_chi')
  };
  const result = analyzePulseDiff(data);
  document.getElementById('diff-content').innerHTML = result;
}

// 核心：分析左右脉差
function analyzePulseDiff(p) {
  const lines = [];
  // 复合脉解析
  const composite = (str) => {
    if (!str) return [];
    return [...str]; // 每个字
  };

  const allL = (p.左寸 + p.左关 + p.左尺);
  const allR = (p.右寸 + p.右关 + p.右尺);
  if (!allL && !allR) return '勾选脉象后自动分析';

  // 1. 单手 vs 双手总览（去重 + 排序）
  const PULSE_SORT = ['浮','沉','伏','迟','缓','数','疾','虚','实','滑','涩','弦','紧','细','微','弱','洪','大','濡','芤','革','牢','动','促','结','代','长','短','散'];
  const uniqSorted = (str) => {
    const chars = [...new Set([...str])];
    return chars.sort((a,b) => PULSE_SORT.indexOf(a) - PULSE_SORT.indexOf(b)).join('');
  };
  if (allL || allR) {
    const summary = [];
    if (allL) summary.push(`左手：${uniqSorted(allL) || '-'}`);
    if (allR) summary.push(`右手：${uniqSorted(allR) || '-'}`);
    lines.push(`<b>两手总览：</b>${summary.join(' | ')}`);
  }

  // 2. 左右寸对比
  analyzeLRSame(p.左寸, p.右寸, '寸（上焦：心 vs 肺）', lines);
  analyzeLRSame(p.左关, p.右关, '关（中焦：肝 vs 脾胃）', lines);
  analyzeLRSame(p.左尺, p.右尺, '尺（下焦：肾阴 vs 命门）', lines);

  // 3. 张锡纯特有辨证规则
  if (p.右寸.includes('微') || p.右寸.includes('弱') || (p.右关.includes('弱') && p.右关.includes('迟'))) {
    lines.push(`<div class="diff-case"><b>🔍 大气下陷预警：</b>右寸/右关见微弱，可能为大气下陷（升陷汤证）。张锡纯："肺之脉诊在右部，大气下陷右部多微弱"。</div>`);
  }
  if (p.左关.includes('弦') && p.右关.includes('弦')) {
    lines.push(`<div class="diff-case"><b>🔍 肝木横逆犯胃：</b>左右关皆弦。张锡纯："左关弦硬为肝阴亏，右关弦长为冲胃气逆，左右皆弦硬为脑充血之兆"。</div>`);
  }
  if (p.右关.includes('弦') && !p.左关.includes('弦')) {
    lines.push(`<div class="diff-warn"><b>⚠️ 冲气上冲：</b>仅右关弦长，可能为冲气上冲 + 胃气上逆。镇摄汤（重赭石）主之。</div>`);
  }
  if (allL.includes('数') && allL.includes('细')) {
    lines.push(`<div class="diff-warn"><b>⚠️ 阴虚内热：</b>左脉细数。张锡纯："阴虚火动者，脉多细数"。</div>`);
  }
  if (p.左尺.includes('数') && (p.右尺.includes('弱') || p.右尺.includes('微'))) {
    lines.push(`<div class="diff-warn"><b>⚠️ 阴虚阳浮：</b>左尺数 + 右尺弱。张锡纯："左尺数右尺弱，肾阴虚而相火动"。</div>`);
  }

  // 4. 数至
  const summary = document.getElementById('pulse-summary').value;
  if (summary) lines.push(`<b>原文/补充：</b>${summary}`);

  return lines.join('<br>');
}

function analyzeLRSame(l, r, name, lines) {
  if (!l && !r) return;
  if (!l) { lines.push(`<b>${name}：</b>仅右（${r}）`); return; }
  if (!r) { lines.push(`<b>${name}：</b>仅左（${l}）`); return; }
  if (l === r) {
    lines.push(`<b>${name}：</b>左右相同（${l}）`);
  } else {
    lines.push(`<b>${name}：</b>左：${l} ≠ 右：${r} <span style="color:#c97c1f">⚠️左右差</span>`);
  }
}

// 监听总评输入
document.addEventListener('DOMContentLoaded', () => {
  const sum = document.getElementById('pulse-summary');
  if (sum) sum.addEventListener('input', updateDiff);
});

// 收集表单数据
function collect() {
  const look = [...document.querySelectorAll('input[name="look"]:checked')].map(i => i.value);
  const ask = [...document.querySelectorAll('input[name="ask"]:checked')].map(i => i.value);
  const trigger = [...document.querySelectorAll('input[name="trigger"]:checked')].map(i => i.value);
  const pulse = {
    左寸: document.getElementById('pulse_left_cun').value,
    左关: document.getElementById('pulse_left_guan').value,
    左尺: document.getElementById('pulse_left_chi').value,
    右寸: document.getElementById('pulse_right_cun').value,
    右关: document.getElementById('pulse_right_guan').value,
    右尺: document.getElementById('pulse_right_chi').value,
  };
  const pulseAspects = [...document.querySelectorAll('input[name="pulse-aspect"]:checked')].map(i => i.value);
  return {
    望: look,
    问: { 主症: ask, 诱发: trigger, 补充: document.getElementById('ask-free').value },
    切: { ...pulse, 总评: document.getElementById('pulse-summary').value, 兼象: pulseAspects }
  };
}

// 诊断
function diagnose() {
  if (!KB) { alert('知识库加载中，请稍候再试'); return; }
  const data = collect();
  const result = matchFormula(data);
  renderResult(data, result);
  goStep('result');
}

function findCasesByPulse(pulses) {
  if (!pulses || pulses.length === 0) return [];
  const result = [];
  const seen = new Set();
  pulses.forEach(p => {
    if (KB.pulse_to_cases[p]) {
      KB.pulse_to_cases[p].forEach(c => {
        if (!seen.has(c.case_id)) {
          seen.add(c.case_id);
          result.push({...c, matched_pulse: p});
        }
      });
    }
  });
  return result;
}

function matchFormula(data) {
  // 收集所有脉象
  const allPulses = [];
  Object.entries(data.切).forEach(([k, v]) => {
    if (k !== '总评' && k !== '兼象' && v) {
      [...v].forEach(c => { if (!allPulses.includes(c)) allPulses.push(c); });
    }
  });
  if (data.切.总评) {
    ['浮','沉','迟','数','微','弱','弦','细','洪','滑','涩','紧','虚','实','结','代','大','长','短','芤','革','牢','动','缓','促','濡'].forEach(p => {
      if (data.切.总评.includes(p) && !allPulses.includes(p)) allPulses.push(p);
    });
  }
  const relatedCases = findCasesByPulse(allPulses);
  const formulaCount = {};
  relatedCases.forEach(c => {
    formulaCount[c.formula_id] = (formulaCount[c.formula_id] || 0) + 1;
  });
  const top = Object.entries(formulaCount).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const formulas = top.map(([fid, count]) => {
    const f = KB.formulas.find(x => x.id === fid);
    if (!f) return null;
    return { ...f, matched_count: count };
  }).filter(Boolean);
  return { formulas, relatedCases, allPulses };
}

function renderResult(data, result) {
  const root = document.getElementById('result-content');
  if (!result || result.formulas.length === 0) {
    root.innerHTML = `<div class="dx-block">
      <h3>未匹配到方剂</h3>
      <div class="dx-content">请补充脉象或症状描述。当前知识库: ${KB.total_formulas} 方剂 / ${KB.total_cases} 医案 / ${KB.total_pulses} 脉象。</div>
    </div>`;
    return;
  }
  const { formulas, relatedCases, allPulses } = result;
  const pulseStr = allPulses.length > 0 ? allPulses.join('、') : '无';

  // 脉象概要
  const pulseRows = [];
  ['寸','关','尺'].forEach(p => {
    const l = data.切['左'+p] || '-';
    const r = data.切['右'+p] || '-';
    pulseRows.push(`<tr><th>${p}</th><td>${l}</td><td>${r}</td></tr>`);
  });

  // 方剂 HTML
  const formulaHtml = formulas.map((f, idx) => {
    const cases = relatedCases.filter(c => c.formula_id === f.id);
    const caseHtml = cases.slice(0, 3).map(c => `
      <div class="case-box">
        <div><span class="pulse-tag">脉${c.matched_pulse}</span> <span class="label">出处：</span>${f.name}（${f.id}）</div>
        <div class="case-text">${c.case_text.substring(0, 250)}...</div>
      </div>
    `).join('');
    return `
      <div class="dx-block ${idx === 0 ? 'top-formula' : ''}">
        <h3>${idx === 0 ? '⭐ 最佳匹配：' : '备选：'}${f.name} <small style="font-weight:400; font-size:12px;">（${f.matched_count} 例医案支撑）</small></h3>
        <div class="dx-content"><div class="label">属性：</div>${f.attr}</div>
        <div class="dx-content" style="margin-top:6px"><div class="label">组成与方解：</div>${f.body.substring(0, 400)}...</div>
        ${caseHtml ? `<div class="dx-content" style="margin-top:6px"><div class="label">📚 真实医案（${cases.length} 例，展示前 3）：</div>${caseHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  const summary = data.切.总评 ? `<br><strong>脉象总评：</strong>${data.切.总评}` : '';
  const aspects = data.切.兼象.length > 0 ? `<br><strong>关键兼象：</strong>${data.切.兼象.join('、')}` : '';

  root.innerHTML = `
    <div class="dx-block">
      <h3>辨证依据（您输入的脉象 + 症状）</h3>
      <div class="dx-content">
        <strong>六部脉象：</strong>
        <table style="margin-top:6px; width:100%; border-collapse:collapse; font-size:12px;">
          <tr style="background:var(--accent)"><th></th><th>左</th><th>右</th></tr>
          ${pulseRows.join('')}
        </table>
        ${summary}${aspects}<br>
        <strong>主症：</strong>${data.问.主症.join('、') || '无'}<br>
        <strong>诱发：</strong>${data.问.诱发.join('、') || '无'}<br>
        <strong>补充：</strong>${data.问.补充 || '无'}<br>
        <strong>望诊：</strong>${data.望.join('、') || '无'}
      </div>
    </div>
    <div class="dx-block">
      <h3>📋 找到 ${relatedCases.length} 例相关医案（来自 ${formulas.length} 个方剂）</h3>
    </div>
    ${formulaHtml}
    <div class="dx-block">
      <h3>📖 知识库统计</h3>
      <div class="dx-content">
        方剂总数: <strong>${KB.total_formulas}</strong> · 医案总数: <strong>${KB.total_cases}</strong> · 脉象种类: <strong>${KB.total_pulses}</strong><br>
        数据来源: ${KB.source}
      </div>
    </div>
  `;
}

// 演示模式
function showDemo() {
  document.getElementById('result-content').innerHTML = `
    <div class="dx-block">
      <h3>演示案例：升陷汤·沈阳苏××案</h3>
      <div class="dx-content">完整流程：四诊合参 → 识别脉象"沉迟微弱，关前尤甚" → 判定"大气下陷" → 用升陷汤升举胸中大气。</div>
    </div>
    <div class="dx-block">
      <h3>辨证逻辑（张锡纯）</h3>
      <div class="dx-content">
        "此证得之力田劳苦过度。夫劳倦伤脾，脾伤则中气下陷；然脉右部濡、关前沉细，此胸中大气下陷之的候也。当升补胸中大气，佐以补肾固摄。"
      </div>
    </div>
    <div class="dx-block">
      <h3>处方：升陷汤</h3>
      <div class="formula">
        <span class="herb">生黄芪 六钱</span>
        <span class="herb">知母 三钱</span>
        <span class="herb">柴胡 一钱五分</span>
        <span class="herb">桔梗 一钱五分</span>
        <span class="herb">升麻 一钱</span>
      </div>
    </div>
    <button class="btn-restart" onclick="location.reload()">返回辨证</button>
  `;
  goStep('result');
}
