/* 仿张锡纯辨证施治 v1.1 - 总按对比表 6 维太过/不及 + 10 个张锡纯脉诊场景识别 */
'use strict';

let KB = null;
let CASES = null;          // 546 个真医案段
let PULSE_INDEX = null;    // 脉象 → 医案
let FORMULA_INDEX = null;  // 方剂 → 医案
let SYMPTOM_INDEX = null;  // 症状 → 医案
let TOPIC_STATS = null;    // 关键方剂-脉象专题统计
let PULSE_SIGNATURES = null;  // v0.5 核心: 133 个脉诊指纹
let INPUT_MODE = 'qna';

const PULSE_MEANING = {
  '浮': '浮脉轻取即得，重按稍减而不空。主表证，亦主虚阳外越。',
  '沉': '沉脉轻取不应，重按始得。主里证。',
  '迟': '迟脉脉来缓慢，一息不足四至。主寒证、阳虚。',
  '数': '数脉脉来快速，一息五至以上。主热证、虚热。',
  '虚': '虚脉举之无力，按之空虚。主气血两虚。',
  '实': '实脉举按皆有力。主实证。',
  '滑': '滑脉往来流利，如珠走盘。主痰饮、食滞。',
  '涩': '涩脉迟细而短，往来艰涩。主血瘀、气滞、精伤。',
  '弦': '弦脉端直以长，如按琴弦。主肝胆病、痛证、痰饮。',
  '紧': '紧脉绷急有力，状如转索。主寒证、痛证。',
  '细': '细脉脉细如线，但应指明显。主气血两虚、湿病。',
  '弱': '弱脉极软而沉细。主气血不足、阳气虚衰。',
  '微': '微脉极细极软，似有似无。主阳气衰微。',
  '洪': '洪脉脉体阔大，来盛去衰。主热盛。',
  '缓': '缓脉一息四至，从容和缓。主湿病、脾胃虚弱。',
  '大': '大脉脉体阔大但无汹涌之势。主病进、虚证。',
  '濡': '濡脉浮而细软。主虚证、湿证。',
  '芤': '芤脉浮大中空。主失血、伤阴。',
  '革': '革脉浮弦中空。主精血亏虚、亡血。',
  '牢': '牢脉沉实弦长。主里实、疝气。',
  '动': '动脉短而滑数。主痛证、惊证。',
  '促': '促脉数而时一止。主阳盛实热。',
  '结': '结脉缓而时一止。主阴盛气结。',
  '代': '代脉止有定数。主脏气衰微。',
  '伏': '伏脉重按着骨始得。主邪闭、厥证。',
  '疾': '疾脉一息七八至。主阳极阴竭。',
  '长': '长脉超过本位。主阳气有余、气逆。',
  '短': '短脉短缩不及本位。主气虚。',
  '有力': '有力脉举按皆有根。张锡纯分「真有力」与「假有力」两种。',
  '无力': '无力脉举按皆软弱。主虚证。',
  '真有力': '真有力脉当于敦浓和缓中见之，为脾胃健旺之常脉。',
  '假有力': '假有力脉弦硬大而按之不实，为「脾胃真气外泄」之病脉。',
  '和缓': '和缓脉从容和缓，一息四至，为平脉之常。',
  '无根': '无根脉尺部重按不应指。主肾气衰败、命门火衰。',
  '动脉': '动脉短而滑数，厥厥动摇。主痛证、惊证。',
};

// ============== 张锡纯独特脉诊体系(从原书提取) ==============
const ZX_PULSE_FEATURES = {
  'right_lung_daqi': {
    name: '右寸候胸中大气',
    source: '升陷汤方论',
    desc: '张锡纯原书：肺之脉诊在右部，故大气下陷，右部之脉多微弱者其常也。',
    pulse_set: ['右寸', '右手', '右总'],
  },
  'shang_sheng_xia_xu': {
    name: '上盛下虚',
    source: '冲气上冲/脑充血',
    desc: '张锡纯原书：其脉上盛下虚，冲气上冲。建瓴汤/镇肝熄风汤主之。',
    pulse_set: ['上盛', '下虚', '弦硬'],
  },
  'left_invisible': {
    name: '左手不见/六脉不全',
    source: '升陷汤验案',
    desc: '大气下陷重症：诊其脉，左寸关尺皆不见，右部脉虽见而微弱欲无。',
    pulse_set: ['左寸关尺皆不见', '六脉不全'],
  },
  'wu_gen': {
    name: '无根(诊查动作)',
    source: '元气将脱',
    desc: '张锡纯体系里"无根"不是单看尺部，是反复重按能否找到脉搏。',
    pulse_set: ['无根'],
  },
};

async function loadAll() {
  try {
    const [kbR, casesR, pIdxR, fIdxR, sIdxR, tStatsR, sigR] = await Promise.all([
      fetch('assets/data/kb.json'),
      fetch('assets/data/cases_full.json'),
      fetch('assets/data/pulse_index.json'),
      fetch('assets/data/formula_index.json'),
      fetch('assets/data/symptom_index.json'),
      fetch('assets/data/topic_stats.json'),
      fetch('assets/data/pulse_signature.json'),
    ]);
    KB = await kbR.json();
    CASES = await casesR.json();
    PULSE_INDEX = await pIdxR.json();
    FORMULA_INDEX = await fIdxR.json();
    SYMPTOM_INDEX = await sIdxR.json();
    TOPIC_STATS = await tStatsR.json();
    PULSE_SIGNATURES = await sigR.json();

    console.log(`v1.0 加载完成:`);
    console.log(`  医案: ${CASES.total_case_segments} 段 (全书 8 期 30 卷扫描)`);
    console.log(`  含脉诊指纹: ${CASES.cases_with_signature} 段`);
    console.log(`  脉象索引: ${PULSE_INDEX.pulse_count} 种 (单字)`);
    console.log(`  方剂索引: ${FORMULA_INDEX.formula_count} 个`);
    console.log(`  症状索引: ${SYMPTOM_INDEX.symptom_count} 种`);
    console.log(`  ★ 脉诊指纹: ${PULSE_SIGNATURES.total_signatures} 个 (组合)`);
    console.log(`  源文件: ${CASES.sources ? CASES.sources.length : 0} 个`);

    // 顶部加 "医案总数 607" 显示
    const headerP = document.querySelector('header.topbar p');
    if (headerP) {
      headerP.innerHTML = `《医学衷中参西录》·全 8 期 30 卷 · <b style="color:#c00">${CASES.total_case_segments} 段真实医案</b> · ${PULSE_SIGNATURES.total_signatures} 个脉诊指纹 · ${FORMULA_INDEX.formula_count} 个方剂`;
    }

    fillSection4_1();
    fillSignatureList();
  } catch (e) {
    console.error('数据加载失败', e);
  }
}

function fillSection4_1() {
  // ① Top 15 脉象
  const topPulses = Object.entries(PULSE_INDEX.index).slice(0, 15);
  let html = '<table><tr><th>排名</th><th>脉象</th><th>医案段数</th><th>代表方剂</th></tr>';
  topPulses.forEach(([p, v], i) => {
    // 找该脉象 Top 3 方剂
    const fFreq = {};
    v.cases.forEach(c => {
      (c.formulas || []).forEach(f => {
        const fn = f.name || f;
        fFreq[fn] = (fFreq[fn] || 0) + 1;
      });
    });
    const topF = Object.entries(fFreq).sort((a,b) => b[1] - a[1]).slice(0, 3)
      .map(([f, n]) => `${f}(${n})`).join(' / ');
    html += `<tr><td>${i+1}</td><td><b>${p}</b></td><td>${v.count}</td><td style="font-size:11px">${topF || '-'}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('top-pulses').innerHTML = html;

  // ② 升陷汤
  fillFormulaStats('升陷汤', 'shengxian-pulse-stats');

  // ③ 白虎加人参汤
  fillFormulaStats('白虎加人参汤', 'baihu-pulse-stats');

  // ④ 弦脉主方
  fillPulseFormulas('弦', 'xian-formula-stats');

  // ⑤ 特殊脉
  const setText = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${n} 段`;
  };
  setText('stat-zhenyouli', PULSE_INDEX.index['真有力']?.count || 0);
  setText('stat-jiayouli', PULSE_INDEX.index['假有力']?.count || 0);
  setText('stat-hehuan', PULSE_INDEX.index['和缓']?.count || 0);
  setText('stat-wugen', PULSE_INDEX.index['无根']?.count || 0);
  setText('stat-shuxu', CASES.cases.filter(c => c.pulse_chars.includes('数') && c.pulse_chars.some(x => ['虚','微','弱'].includes(x))).length);
  setText('stat-xianxiruo', CASES.cases.filter(c => c.pulse_chars.includes('弦') && c.pulse_chars.includes('细') && c.pulse_chars.includes('弱')).length);

  // ⑥-⑦ 已在 HTML 中
  // ⑧ 张锡纯独特脉诊
  fillZXFeatures();
}

function fillFormulaStats(formula, elemId) {
  const data = FORMULA_INDEX.index[formula];
  if (!data) {
    document.getElementById(elemId).innerHTML = `<p style="color:var(--ink-soft)">无 ${formula} 医案</p>`;
    return;
  }
  const charFreq = {};
  data.cases.forEach(c => {
    (c.pulse_chars || []).forEach(ch => {
      charFreq[ch] = (charFreq[ch] || 0) + 1;
    });
  });
  const sorted = Object.entries(charFreq).sort((a,b) => b[1] - a[1]);
  let h = `<p style="font-size:11px;color:var(--ink-soft);margin:4px 0">统计自 <b>${data.count}</b> 个${formula}真实医案段：</p>`;
  h += '<table><tr><th>脉象</th><th>出现频次</th></tr>';
  sorted.slice(0, 10).forEach(([pc, n]) => {
    h += `<tr><td>${pc}</td><td>${n}</td></tr>`;
  });
  h += '</table>';
  document.getElementById(elemId).innerHTML = h;
}

function fillPulseFormulas(pulse, elemId) {
  const data = PULSE_INDEX.index[pulse];
  if (!data) return;
  const fFreq = {};
  data.cases.forEach(c => {
    (c.formulas || []).forEach(f => {
      const fn = f.name || f;
      fFreq[fn] = (fFreq[fn] || 0) + 1;
    });
  });
  const sorted = Object.entries(fFreq).sort((a,b) => b[1] - a[1]);
  let h = `<p style="font-size:11px;color:var(--ink-soft);margin:4px 0">统计自 <b>${data.count}</b> 个含"${pulse}"脉的真实医案：</p>`;
  h += '<table><tr><th>方剂</th><th>频次</th></tr>';
  sorted.slice(0, 10).forEach(([f, n]) => {
    h += `<tr><td>${f}</td><td>${n}</td></tr>`;
  });
  h += '</table>';
  document.getElementById(elemId).innerHTML = h;
}

function fillZXFeatures() {
  // 张锡纯特色脉诊统计
  const el = document.getElementById('zx-features');
  if (!el) return;
  let h = '<table><tr><th>张锡纯特色脉诊</th><th>真实医案支撑</th></tr>';
  // 1. 大气下陷
  const daqi = CASES.cases.filter(c =>
    ['弱', '微', '沉', '迟'].some(x => c.pulse_chars.includes(x))
    && c.formulas.some(f => f.name.includes('升陷'))
  );
  h += `<tr><td><b>大气下陷</b><br>右部多微弱/沉迟</td><td>升陷汤验案 <b>${daqi.length}</b> 段<br><i>原话：肺脉在右寸，候胸中大气</i></td></tr>`;
  // 2. 上盛下虚
  const ssxx = CASES.cases.filter(c =>
    c.content_preview.includes('上盛') || c.content_preview.includes('上盛下虚')
    || c.pulse_chars.includes('弦') && c.formulas.some(f => ['建瓴汤','镇肝熄风汤','镇摄汤'].includes(f.name))
  );
  h += `<tr><td><b>上盛下虚</b><br>冲气上冲/脑充血</td><td>建瓴汤/镇肝熄风汤/镇摄汤验案 <b>${ssxx.length}</b> 段<br><i>原话：其脉上盛下虚</i></td></tr>`;
  // 3. 弦硬大有力(假有力)
  const jia = CASES.cases.filter(c =>
    c.pulse_chars.includes('弦') && c.pulse_chars.includes('有力') && !c.pulse_chars.includes('和缓')
  );
  h += `<tr><td><b>弦硬大而有力</b><br>假有力/脾胃真气外泄</td><td>${jia.length} 段<br><i>原话：弦硬大而有力，此脾胃真气外泄</i></td></tr>`;
  // 4. 真有力(和缓中有力)
  const zhen = CASES.cases.filter(c =>
    (c.pulse_chars.includes('和缓') || c.pulse_chars.includes('真有力'))
    && c.pulse_chars.includes('有力')
  );
  h += `<tr><td><b>和缓中有力(真有力)</b><br>脾胃健旺</td><td>${zhen.length} 段<br><i>原话：当于敦浓和缓中见之</i></td></tr>`;
  h += '</table>';
  el.innerHTML = h;
}

// ============== v0.5 核心: 脉诊指纹反查 ==============
function fillSignatureList() {
  const el = document.getElementById('signature-list');
  if (!el || !PULSE_SIGNATURES) return;
  const sigs = PULSE_SIGNATURES.signatures;
  let h = '<table><tr><th>脉诊指纹</th><th>医案段数</th><th>主方</th><th>原书原话示例</th></tr>';
  sigs.slice(0, 100).forEach(s => {
    const sample = s.sample_pulse_raw ? `脉${s.sample_pulse_raw}` : '-';
    const topF = s.top_formula || '-';
    h += `<tr>
      <td><b>${s.signature}</b></td>
      <td>${s.count}</td>
      <td>${topF}</td>
      <td style="font-size:11px"><i>${sample}</i></td>
    </tr>`;
  });
  h += '</table>';
  el.innerHTML = h;
}

// 脉诊指纹反查: 用户输入完整脉诊组合, 找到张锡纯真实用过的同指纹医案
function lookupBySignature() {
  if (!PULSE_SIGNATURES) {
    alert('数据加载中, 请稍候...');
    return;
  }
  const userInput = document.getElementById('pulse-signature-input').value.trim();
  const resultEl = document.getElementById('signature-result-content');
  if (!userInput) {
    resultEl.innerHTML = '<span style="color:var(--ink-soft)">请先输入脉诊组合</span>';
    return;
  }
  const sigs = PULSE_SIGNATURES.signatures;
  // 1. 完整匹配
  const exact = sigs.filter(s => s.signature === userInput);
  // 2. 包含匹配 (用户输入是某个指纹的子串)
  const partial = sigs.filter(s => s.signature.includes(userInput) && s.signature !== userInput);
  // 3. 反向包含 (用户输入包含某指纹)
  const contain = sigs.filter(s => userInput.includes(s.signature) && s.signature !== userInput);

  let h = `<p style="font-size:12px;color:var(--primary-d)">您输入：<b>${userInput}</b></p>`;

  if (exact.length > 0) {
    h += `<div class="diff-case" style="margin-top:8px"><b>✅ 完整匹配 (${exact.length} 个指纹)</b>`;
    exact.forEach(s => {
      const formulas = Object.entries(s.formulas).map(([f,n]) => `${f}(${n})`).join(' / ');
      h += `<div style="margin:6px 0;padding:6px;background:rgba(45,106,79,0.08);border-radius:3px">
        <b>脉${s.signature}</b> 共 <b>${s.count}</b> 段真实医案<br>
        <b>主方：</b>${s.top_formula}<br>
        <b>全部方剂：</b>${formulas}<br>
        <b>原书原话：</b><i>"其脉${s.sample_pulse_raw || s.signature}"</i><br>
        <b>医案：</b>case #${s.case_ids ? s.case_ids.slice(0,5).join(', #') : ''}${s.case_ids && s.case_ids.length>5?` 等${s.case_ids.length}个`:''}
      </div>`;
    });
    h += '</div>';
  } else {
    h += `<div class="diff-warn" style="margin-top:6px"><b>⚠️ 未找到完全匹配"${userInput}"的指纹</b><br><span style="font-size:11px">可能因为：①原书未单独立此脉诊组合 ②请检查输入 ③参考下方部分匹配</span></div>`;
  }

  if (partial.length > 0) {
    h += `<div style="margin-top:8px"><b>📚 部分匹配 (您的输入是这些指纹的子串):</b><ul style="margin:4px 0 0 16px;font-size:12px">`;
    partial.slice(0, 10).forEach(s => {
      h += `<li>脉<b>${s.signature}</b>: ${s.count} 段 → 主方 ${s.top_formula}</li>`;
    });
    h += '</ul></div>';
  }

  if (contain.length > 0) {
    h += `<div style="margin-top:8px"><b>📚 您的输入包含这些指纹:</b><ul style="margin:4px 0 0 16px;font-size:12px">`;
    contain.slice(0, 10).forEach(s => {
      h += `<li>脉<b>${s.signature}</b>: ${s.count} 段 → 主方 ${s.top_formula}</li>`;
    });
    h += '</ul></div>';
  }

  if (!exact.length && !partial.length && !contain.length) {
    h += `<div style="margin-top:8px;color:var(--ink-soft);font-size:12px">
      💡 <b>提示：</b>133 个指纹包括常见组合：<br>
      - 弦(22) / 弦长(18) / 弦细(12) / 弦长有力(7) / 浮弦(7)<br>
      - 洪实(18) / 洪滑(7) / 实(10)<br>
      - 微弱(8) / 微细(9) / 弱(7)<br>
      - 数(13) / 沉(6) / 沉细(6) / 沉迟(5)<br>
      - 上盛下虚(6) / 无根(3) / 滑(7) / 迟(4)
    </div>`;
  }

  resultEl.innerHTML = h;
}

loadAll();

// 步骤切换
function goStep(step) {
  ['step1','step-look','step-ask','step-pulse','step-result','step-fingerprint'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const target = 'step-' + step;
  const el = document.getElementById(target);
  if (el) el.classList.remove('hidden');
  window.scrollTo({top: 0, behavior: 'smooth'});
}

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

const PULSE_ORDER = ['浮','沉','伏','迟','缓','数','疾','虚','实','滑','涩','弦','紧','细','微','弱','洪','大','濡','芤','革','牢','动','促','结','代','长','短','散'];
document.querySelectorAll('.ms').forEach(span => {
  span.addEventListener('click', () => {
    span.classList.toggle('on');
    const pos = span.dataset.pos;
    const posMap = {
      '左寸': 'pulse_left_cun', '左关': 'pulse_left_guan', '左尺': 'pulse_left_chi',
      '右寸': 'pulse_right_cun', '右关': 'pulse_right_guan', '右尺': 'pulse_right_chi',
      '左总': 'pulse_left_total', '右总': 'pulse_right_total'
    };
    const inputId = posMap[pos];
    if (!inputId) return;
    const selected = [...document.querySelectorAll(`.ms[data-pos="${pos}"].on`)].map(s => s.textContent);
    selected.sort((a, b) => PULSE_ORDER.indexOf(a) - PULSE_ORDER.indexOf(b));
    document.getElementById(inputId).value = selected.join('');
    updateAllDiff();
  });
  let pressTimer = null;
  span.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => showMeaning(span), 500);
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
  document.querySelectorAll('.pulse-meaning').forEach(el => el.remove());
  const div = document.createElement('div');
  div.className = 'pulse-meaning show';
  div.innerHTML = `<b>${pulse}脉：</b>${meaning}`;
  span.insertAdjacentElement('afterend', div);
  setTimeout(() => div.classList.remove('show'), 4000);
}

// ============== 核心: 三维反查 (脉象 + 症状 + 方剂) ==============
function updateAllDiff() {
  const get = id => document.getElementById(id).value || '';

  // 收集所有已勾选脉象
  const allPulses = new Set();
  ['pulse_left_total', 'pulse_right_total',
   'pulse_left_cun', 'pulse_left_guan', 'pulse_left_chi',
   'pulse_right_cun', 'pulse_right_guan', 'pulse_right_chi'].forEach(id => {
     const v = get(id);
     [...v].forEach(ch => allPulses.add(ch));
   });
  const userPulses = [...allPulses];

  // 收集已勾选症状
  const userSymptoms = [...document.querySelectorAll('input[name="ask"]:checked')].map(x => x.value);

  // 4.0 总按左右对比
  const totalL = get('pulse_left_total');
  const totalR = get('pulse_right_total');
  const totalEl = document.getElementById('diff-content-total');
  if (totalEl) {
    totalEl.innerHTML = renderTotalPulseDiff(totalL, totalR);
  }

  // 4.2 三维反查
  const diffEl = document.getElementById('diff-content');
  if (diffEl) {
    if (userPulses.length === 0 && userSymptoms.length === 0) {
      diffEl.innerHTML = '勾选脉象或症状后自动反查张锡纯真实医案';
    } else {
      diffEl.innerHTML = render3DLookup(userPulses, userSymptoms);
    }
  }
}

function renderTotalPulseDiff(l, r) {
  if (!l && !r) return '勾选后自动对比';
  const lines = [];
  const PULSE_SORT = PULSE_ORDER.concat(['有力','无力','和缓','真有力','假有力','无根','动脉']);
  const uniqSorted = (str) => {
    const chars = [...new Set([...str])];
    return chars.sort((a,b) => PULSE_SORT.indexOf(a) - PULSE_SORT.indexOf(b)).join('');
  };
  if (l) lines.push(`<b>左手：</b>${uniqSorted(l)}`);
  if (r) lines.push(`<b>右手：</b>${uniqSorted(r)}`);
  if (l && r) {
    const onlyL = [...l].filter(x => !r.includes(x));
    const onlyR = [...r].filter(x => !l.includes(x));
    if (onlyL.length || onlyR.length) {
      lines.push('<br><b>左右差异:</b>');
      if (onlyL.length) lines.push(`仅左手有: <b>${uniqSorted(onlyL.join(''))}</b>`);
      if (onlyR.length) lines.push(`仅右手有: <b>${uniqSorted(onlyR.join(''))}</b>`);
    }
    // ============ v1.1: 六维太过/不及/正常 对比 ============
    lines.push('<br><b>📐 6 维太过/不及判定（基线=和缓）:</b>');
    lines.push(renderSixDimCompare(l, r));

    // ============ v1.1: 张锡纯特色脉诊场景识别 ============
    const sceneResult = detectZXScene(l, r);
    if (sceneResult) {
      lines.push(`<div class="diff-case" style="margin-top:6px;background:rgba(139,26,26,0.08);padding:8px;border-left:3px solid #8b1a1a">
        <b>🎯 张锡纯脉诊场景识别：</b>${sceneResult}
      </div>`);
    }
  }
  return lines.join('<br>');
}

// 6 维对比: 判定每维的太过/不及/正常
function renderSixDimCompare(l, r) {
  // 6 维标准: 基线=和缓
  const DIM_RULES = {
    '位(浮沉)': {
      baseline: '不浮不沉',
      excessive: ['浮','洪','芤','革','散'],
      deficient: ['沉','伏','牢','弱','微','细'],
    },
    '息(迟数)': {
      baseline: '一息四至',
      excessive: ['数','疾','促','动脉'],
      deficient: ['迟','缓'],
    },
    '力(强弱)': {
      baseline: '和缓有力',
      excessive: ['有力','实','弦硬','弦','紧','真有力'],
      deficient: ['弱','微','虚','无力'],
    },
    '体(大小)': {
      baseline: '不大不小',
      excessive: ['大','洪'],
      deficient: ['细','微'],
    },
    '势(缓急)': {
      baseline: '缓和',
      excessive: ['弦','紧','长','滑','动'],
      deficient: ['涩','短'],
    },
    '止(节律)': {
      baseline: '不止',
      excessive: ['促','动脉'],
      deficient: ['结','代'],
    },
  };
  let html = '<table style="width:100%;font-size:11px;margin-top:4px;border-collapse:collapse">';
  html += '<tr style="background:#f5f5dc"><th style="padding:3px">维度</th><th>基线</th><th>左手</th><th>右手</th><th>左右对比</th></tr>';
  for (const [dim, rule] of Object.entries(DIM_RULES)) {
    const lE = rule.excessive.some(x => l.includes(x));
    const lD = rule.deficient.some(x => l.includes(x));
    const rE = rule.excessive.some(x => r.includes(x));
    const rD = rule.deficient.some(x => r.includes(x));
    const lState = lE ? '<span style="color:#c00">太过</span>' : lD ? '<span style="color:#06c">不及</span>' : '<span style="color:#080">正常</span>';
    const rState = rE ? '<span style="color:#c00">太过</span>' : rD ? '<span style="color:#06c">不及</span>' : '<span style="color:#080">正常</span>';
    let comp = '';
    if (lE && rE) comp = '<b style="color:#c00">两手都太过</b>';
    else if (lD && rD) comp = '<b style="color:#06c">两手都不及</b>';
    else if (lE && rD) comp = '<b style="color:#c00">左太过/右不及</b>';
    else if (lD && rE) comp = '<b style="color:#c00">右太过/左不及</b>';
    else if (lE) comp = '左太过';
    else if (rE) comp = '右太过';
    else if (lD) comp = '左不及';
    else if (rD) comp = '右不及';
    else comp = '<span style="color:#080">两手都正常</span>';
    html += `<tr>
      <td style="padding:3px">${dim}</td>
      <td>${rule.baseline}</td>
      <td>${lState}</td>
      <td>${rState}</td>
      <td>${comp}</td>
    </tr>`;
  }
  html += '</table>';
  return html;
}

// 张锡纯脉诊场景识别 (核心: 用户举的 3 个例子)
function detectZXScene(l, r) {
  const scenes = [];
  // 把脉象字符串拆成 char 集合
  const L = new Set([...l]);
  const R = new Set([...r]);
  const has = (set, ...items) => items.some(x => set.has(x));

  // 场景 1: 右手太过 (弦硬/实/有力) + 左手不及 (弱/微/沉/细)
  const rExcessive = has(R, '弦','实','有力','弦硬');
  const lDeficient = has(L, '弱','微','沉','细','虚','无力');
  if (rExcessive && lDeficient) {
    scenes.push(`<b>「右手太过 / 左手不及」</b> → 张锡纯原书<b>"上盛下虚"</b>特征，常见于<b>冲气上冲/脑充血/肝阳上亢</b>。参考方：建瓴汤、镇肝熄风汤、镇摄汤。`);
  }

  // 场景 2: 两手都太过
  const lExcessive = has(L, '弦','实','有力','弦硬');
  if (lExcessive && rExcessive) {
    scenes.push(`<b>「两手都太过」</b> → 张锡纯原书<b>"弦硬"脉全身皆现</b>，常见于<b>肝气横恣/气逆上冲</b>。参考方：建瓴汤、镇肝熄风汤。`);
  }

  // 场景 3: 两手都不及
  const lDef = has(L, '弱','微','虚','无力');
  const rDef = has(R, '弱','微','虚','无力');
  if (lDef && rDef) {
    scenes.push(`<b>「两手都不及（虚）」</b> → 张锡纯原书<b>"气血两虚"</b>特征，常见于<b>虚劳/久病/产后</b>。参考方：十全育真汤、扶中汤、醴泉饮。`);
  }

  // 场景 4: 右手独弱/沉/微 → 大气下陷
  const rWeak = has(R, '弱','微','沉') && !has(R, '弦','实','有力');
  if (rWeak && !has(L, '弱','微','沉')) {
    scenes.push(`<b>「仅右手弱/沉/微」</b> → 张锡纯原书<b>"大气下陷"</b>特征。原话：<i>"肺之脉诊在右部，故大气下陷，右部之脉多微弱者其常也"</i>。主方：<b>升陷汤</b>。`);
  }

  // 场景 5: 仅左脉弦 → 肝阴亏
  if (has(L, '弦') && !has(R, '弦')) {
    scenes.push(`<b>「仅左脉弦」</b> → 张锡纯原书<b>"肝阴亏/肝火"</b>特征，清肝（白芍、玄参）为主。`);
  }

  // 场景 6: 用户举例 1: 左手弦沉弱，右手也弱 (相对强但都不及)
  if (has(L, '弦','弱') && has(R, '弱') && !rExcessive) {
    scenes.push(`<b>「左弦弱、右弱」</b>（您举例1）→ 张锡纯体系：<b>右手虽弱但为大气升发之源</b>，左脉弦为肝气不柔，治以升陷汤佐以柔肝。`);
  }

  // 场景 7: 右手弦硬 + 左手弱沉细 (用户举例 2)
  if (has(R, '弦') && has(L, '弱','细','沉')) {
    scenes.push(`<b>「右弦硬、左弱沉细」</b>（您举例2）→ <b>右手太过（上盛）</b>，左手不及（下虚）→ 典型<b>"上盛下虚"</b>。`);
  }

  // 场景 8: 两手都弦硬 (用户举例 3)
  if (has(L, '弦') && has(R, '弦') && (has(L, '实','有力') || has(R, '实','有力'))) {
    scenes.push(`<b>「两手都弦硬」</b>（您举例3）→ <b>全身阳亢/气逆</b>，参考方：建瓴汤、镇肝熄风汤。`);
  }

  // 场景 9: 微弱而迟（升陷汤）
  if (has(R, '微','弱') && has(L, '微','弱') && (has(L, '迟') || has(R, '迟'))) {
    scenes.push(`<b>「微弱而迟」</b> → 张锡纯原书<b>"升陷汤最典型脉"</b>，主方：<b>升陷汤</b>。`);
  }

  // 场景 10: 上盛下虚字面检测
  if (l.includes('盛') || l.includes('下') || l.includes('虚') || r.includes('盛') || r.includes('下') || r.includes('虚')) {
    // 跳过上盛下虚, 因为场景 1 已处理
  }

  return scenes.length > 0 ? scenes.join('<br><br>') : null;
}

// 三维反查: 脉象 + 症状 → 真实医案 + 方剂
function render3DLookup(pulses, symptoms) {
  if (!PULSE_INDEX) return '<p style="color:var(--ink-soft)">数据加载中...</p>';

  // 1. 计算每个医案得分
  const scored = CASES.cases.map(c => {
    let score = 0;
    let pulseMatched = [];
    let symptomMatched = [];

    // 脉象匹配 (单字)
    pulses.forEach(p => {
      if (c.pulse_chars && c.pulse_chars.includes(p)) {
        score += 2;
        pulseMatched.push(p);
      }
    });
    // 症状匹配
    symptoms.forEach(s => {
      if (c.symptoms && c.symptoms.includes(s)) {
        score += 3;  // 症状权重高
        symptomMatched.push(s);
      }
    });
    return { case: c, score, pulseMatched, symptomMatched };
  }).filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  let html = `<p style="font-size:12px;color:var(--primary-d)">您输入：<b>脉象</b> [${pulses.join('+') || '无'}] + <b>症状</b> [${symptoms.join('+') || '无'}]</p>`;

  // 第一部分: 完全匹配(脉象+症状都有)
  if (pulses.length > 0 && symptoms.length > 0) {
    const fullMatch = scored.filter(x => x.pulseMatched.length > 0 && x.symptomMatched.length > 0);
    if (fullMatch.length > 0) {
      html += `<div class="diff-case" style="margin-top:6px"><b>✅ 脉象+症状同时匹配的真实医案：${fullMatch.length} 个</b><ul style="margin:4px 0 0 16px;font-size:11px">`;
      fullMatch.slice(0, 5).forEach(x => {
        const f = (x.case.formulas || []).map(ff => ff.name || ff).join('+') || '无方剂';
        const p = x.pulseMatched.join('+');
        const s = x.symptomMatched.join('+');
        html += `<li>篇 #${x.case.src_idx} | 脉: ${p} | 症: ${s} | 方: <b>${f}</b></li>`;
      });
      if (fullMatch.length > 5) {
        html += `<li>...还有 ${fullMatch.length - 5} 个</li>`;
      }
      html += '</ul></div>';
    } else {
      html += `<div class="diff-warn" style="margin-top:6px"><b>⚠️ 您的脉象+症状组合在 337 个真实医案中未同时出现</b><br><span style="font-size:11px">可能因为：①张锡纯原书描述方式不同 ②案例数量有限 ③请参考下方部分匹配结果</span></div>`;
    }
  }

  // 第二部分: 脉象 Top 命中
  if (pulses.length > 0) {
    html += '<div style="margin:8px 0"><b>📚 脉象反查 (Top 命中):</b><ul style="margin:4px 0 0 16px;font-size:12px">';
    pulses.forEach(p => {
      const idx = PULSE_INDEX.index[p];
      if (idx) {
        const fFreq = {};
        idx.cases.forEach(c => {
          (c.formulas || []).forEach(f => {
            const fn = f.name || f;
            fFreq[fn] = (fFreq[fn] || 0) + 1;
          });
        });
        const topF = Object.entries(fFreq).sort((a,b) => b[1] - a[1]).slice(0, 3)
          .map(([f, n]) => `${f}(${n})`).join(' / ');
        html += `<li><b>${p}</b>: ${idx.count} 段,主方 ${topF}</li>`;
      } else {
        html += `<li><b>${p}</b>: 0 段 (此脉张锡纯原书未单独立案)</li>`;
      }
    });
    html += '</ul></div>';
  }

  // 第三部分: 症状反查
  if (symptoms.length > 0) {
    html += '<div style="margin:8px 0"><b>🩺 症状反查 (Top 命中):</b><ul style="margin:4px 0 0 16px;font-size:12px">';
    symptoms.forEach(s => {
      const idx = SYMPTOM_INDEX.index[s];
      if (idx) {
        const fFreq = {};
        idx.cases.forEach(c => {
          (c.formulas || []).forEach(f => {
            const fn = f.name || f;
            fFreq[fn] = (fFreq[fn] || 0) + 1;
          });
        });
        const topF = Object.entries(fFreq).sort((a,b) => b[1] - a[1]).slice(0, 3)
          .map(([f, n]) => `${f}(${n})`).join(' / ');
        html += `<li><b>${s}</b>: ${idx.count} 段,主方 ${topF}</li>`;
      } else {
        html += `<li><b>${s}</b>: 0 段 (此症状张锡纯原书未单独记载)</li>`;
      }
    });
    html += '</ul></div>';
  }

  // 第四部分: 排序后的最佳医案 Top 5
  if (scored.length > 0) {
    html += '<div style="margin:8px 0"><b>⭐ 最佳匹配 (脉+症综合排序 Top 5):</b>';
    scored.slice(0, 5).forEach((x, i) => {
      const c = x.case;
      const f = (c.formulas || []).map(ff => ff.name || ff).join('+') || '无';
      const title = (c.src_title || '').slice(0, 20);
      const pulseRaw = c.pulse_signature_raw || c.pulse_signature || '';
      html += `<div class="diff-case" style="margin:4px 0"><b>#${i+1}</b> 篇 #${c.src_idx || c.case_id} ${title}<br>匹配: 脉[${x.pulseMatched.join('+')}] 症[${x.symptomMatched.join('+')}] 分=${x.score}<br>方剂: <b>${f}</b><br>原文脉象: <i>${pulseRaw}</i></div>`;
    });
    html += '</div>';
  }

  return html;
}

function collect() {
  return {
    look: [...document.querySelectorAll('input[name="look"]:checked')].map(x => x.value),
    ask: [...document.querySelectorAll('input[name="ask"]:checked')].map(x => x.value),
    trigger: [...document.querySelectorAll('input[name="trigger"]:checked')].map(x => x.value),
    pulse_left_total: document.getElementById('pulse_left_total').value,
    pulse_right_total: document.getElementById('pulse_right_total').value,
    pulse_left_cun: document.getElementById('pulse_left_cun').value,
    pulse_left_guan: document.getElementById('pulse_left_guan').value,
    pulse_left_chi: document.getElementById('pulse_left_chi').value,
    pulse_right_cun: document.getElementById('pulse_right_cun').value,
    pulse_right_guan: document.getElementById('pulse_right_guan').value,
    pulse_right_chi: document.getElementById('pulse_right_chi').value,
    pulse_summary: document.getElementById('pulse-summary')?.value || '',
    pulse_aspect: [...document.querySelectorAll('input[name="pulse-aspect"]:checked')].map(x => x.value),
    ask_free: document.getElementById('ask-free')?.value || '',
  };
}

function diagnose() {
  const data = collect();
  const resultEl = document.getElementById('result-content') || document.getElementById('dx-result') || document.getElementById('step-result');
  goStep('result');

  const allPulses = new Set();
  ['pulse_left_total','pulse_right_total',
   'pulse_left_cun','pulse_left_guan','pulse_left_chi',
   'pulse_right_cun','pulse_right_guan','pulse_right_chi'].forEach(k => {
     if (data[k]) [...data[k]].forEach(ch => allPulses.add(ch));
   });
  const pulses = [...allPulses];
  const symptoms = data.ask;

  let html = '<h2>📋 辨证结果（基于张锡纯真实医案 v0.8）</h2>';
  html += '<div class="dx-block"><h3>您输入</h3><div class="dx-content">';
  if (data.pulse_summary) html += `<p><b>原话:</b> <i>${data.pulse_summary}</i></p>`;
  if (data.pulse_left_total) html += `<p>左手总按: <b>${data.pulse_left_total}</b></p>`;
  if (data.pulse_right_total) html += `<p>右手总按: <b>${data.pulse_right_total}</b></p>`;
  ['pulse_left_cun','pulse_left_guan','pulse_left_chi',
   'pulse_right_cun','pulse_right_guan','pulse_right_chi'].forEach(k => {
     if (data[k]) {
       const label = {pulse_left_cun:'左寸',pulse_left_guan:'左关',pulse_left_chi:'左尺',
                      pulse_right_cun:'右寸',pulse_right_guan:'右关',pulse_right_chi:'右尺'}[k];
       html += `<p>${label}: <b>${data[k]}</b></p>`;
     }
   });
  if (data.pulse_aspect.length) html += `<p>兼象: ${data.pulse_aspect.join(' / ')}</p>`;
  if (symptoms.length) html += `<p>症状: ${symptoms.join(' / ')}</p>`;
  html += '</div></div>';

  html += '<div class="dx-block"><h3>📚 张锡纯真实医案三维反查</h3><div class="dx-content">';
  if (pulses.length === 0 && symptoms.length === 0) {
    html += '<p style="color:var(--ink-soft)">未勾选脉象或症状</p>';
  } else {
    html += render3DLookup(pulses, symptoms);
  }
  html += '</div></div>';

  html += `<div style="background:rgba(201,124,31,0.1); padding:10px; border-left:3px solid var(--warn); border-radius:3px; font-size:12px; margin-top:12px">
    <b>⚠️ 重要提示</b>:本系统<b>不</b>给出辨证结论(如"气虚血瘀"等),<b>只</b>展示张锡纯原书 337 个真实医案中含相同/相似脉象+症状的真实用方。
    临床请结合四诊、患者整体情况,由执业中医师判断。
  </div>`;

  if (resultEl) {
    resultEl.innerHTML = html;
    resultEl.classList.remove('hidden');
  }
}

function showDemo() {
  goStep('pulse');
}
