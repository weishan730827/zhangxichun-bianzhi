/* 仿张锡纯辨证施治 v0.7 - 彻底忠实于原书·反向检索 */
'use strict';

let KB = null;
let CASES = null;          // 56 个真医案段
let PULSE_INDEX = null;    // 脉象 → 医案 反向索引
let FORMULA_INDEX = null;  // 方剂 → 医案 反向索引
let INPUT_MODE = 'qna';

// 脉象释义（张锡纯/中医基础理论）
const PULSE_MEANING = {
  '浮': '浮脉轻取即得，重按稍减而不空。主表证，亦主虚阳外越。',
  '沉': '沉脉轻取不应，重按始得。主里证。沉而有力为里实，沉而无力为里虚。',
  '迟': '迟脉脉来缓慢，一息不足四至（<60次/分）。主寒证，亦主阳虚。',
  '数': '数脉脉来快速，一息五至以上（>90次/分）。主热证，亦主虚热。',
  '虚': '虚脉举之无力，按之空虚。主气血两虚。',
  '实': '实脉举按皆有力。主实证。',
  '滑': '滑脉往来流利，如珠走盘。主痰饮、食滞。',
  '涩': '涩脉迟细而短，往来艰涩。主血瘀、气滞、精伤。',
  '弦': '弦脉端直以长，如按琴弦。主肝胆病、痛证、痰饮。',
  '紧': '紧脉绷急有力，状如转索。主寒证、痛证。',
  '细': '细脉脉细如线，但应指明显。主气血两虚、诸虚劳损、湿病。',
  '弱': '弱脉极软而沉细。主气血不足、阳气虚衰。',
  '微': '微脉极细极软，似有似无。主阴阳气血诸虚，阳气衰微。',
  '洪': '洪脉脉体阔大，滔滔满指，来盛去衰。主热盛、气分热盛。',
  '缓': '缓脉一息四至，从容和缓。主湿病、脾胃虚弱。',
  '大': '大脉脉体阔大，但无汹涌之势。主病进、虚证。',
  '濡': '濡脉浮而细软。主虚证、湿证。',
  '芤': '芤脉浮大中空，如按葱管。主失血、伤阴。',
  '革': '革脉浮弦中空，如按鼓皮。主精血亏虚、崩漏、亡血。',
  '牢': '牢脉沉实弦长，坚牢不移。主里实、疝气、癥瘕。',
  '动': '动脉短而滑数，厥厥动摇。主痛证、惊证。',
  '促': '促脉数而时一止，止无定数。主阳盛实热、气血痰食停滞。',
  '结': '结脉缓而时一止，止无定数。主阴盛气结、痰滞血瘀。',
  '代': '代脉止有定数，不能自还。主脏气衰微。',
  '伏': '伏脉重按着骨始得。主邪闭、厥证、痛极。',
  '疾': '疾脉脉来急疾，一息七八至（>120次/分）。主阳极阴竭、元气将脱。',
  '长': '长脉脉体超过本位。主阳气有余、气逆、火盛。',
  '短': '短脉脉体短缩，不及本位。主气虚、气郁。',
  '有力': '有力脉举按皆应指有根，主实证。张锡纯分「真有力」(和缓中见)与「假有力」(弦硬大而有力)两种。',
  '无力': '无力脉举按皆软弱空虚，主虚证。',
  '真有力': '真有力脉当于敦浓和缓中见之，张锡纯认为此为脾胃健旺之常脉，区别于弦硬之假有力。',
  '假有力': '假有力脉弦硬大而按之不实，张锡纯认为此为「脾胃真气外泄」之病脉。',
  '和缓': '和缓脉从容和缓，一息四至，为平脉之常。张锡纯：「脉来和缓有神，此胃气充足」。',
  '无根': '无根脉尺部重按不应指，主肾气衰败、命门火衰。',
  '动脉': '动脉短而滑数，厥厥动摇，主痛证、惊证、孕脉。',
};

// 加载所有数据
async function loadAll() {
  try {
    const [kbR, casesR, pIdxR, fIdxR] = await Promise.all([
      fetch('assets/data/kb.json'),
      fetch('assets/data/cases_full.json'),
      fetch('assets/data/pulse_index.json'),
      fetch('assets/data/formula_index.json'),
    ]);
    KB = await kbR.json();
    CASES = await casesR.json();
    PULSE_INDEX = await pIdxR.json();
    FORMULA_INDEX = await fIdxR.json();

    console.log(`KB: ${KB.total_formulas} 方剂`);
    console.log(`医案: ${CASES.total_case_segments} 段 (真医案)`);
    console.log(`脉象索引: ${PULSE_INDEX.pulse_count} 种脉象`);
    console.log(`方剂索引: ${FORMULA_INDEX.formula_count} 个方剂`);

    // 填充 4.1 节
    fillSection4_1();
  } catch (e) {
    console.error('数据加载失败', e);
  }
}

// ============ 4.1 节数据填充 ============
function fillSection4_1() {
  // ① Top 15 脉象
  const topPulses = Object.entries(PULSE_INDEX.index).slice(0, 15);
  let html = '<table><tr><th>排名</th><th>脉象</th><th>医案段数</th></tr>';
  topPulses.forEach(([p, v], i) => {
    html += `<tr><td>${i+1}</td><td><b>${p}</b></td><td>${v.count}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('top-pulses').innerHTML = html;

  // ② 升陷汤验案脉象
  const sxData = FORMULA_INDEX.index['升陷汤'];
  if (sxData) {
    const sxCases = sxData.cases;
    const charFreq = {};
    sxCases.forEach(c => {
      (c.pulse_chars || []).forEach(ch => {
        charFreq[ch] = (charFreq[ch] || 0) + 1;
      });
    });
    const sxSorted = Object.entries(charFreq).sort((a,b) => b[1] - a[1]);
    let h = `<p style="font-size:11px;color:var(--ink-soft);margin:4px 0">统计自 <b>${sxCases.length}</b> 个升陷汤真实医案段：</p>`;
    h += '<table><tr><th>脉象</th><th>出现频次</th></tr>';
    sxSorted.slice(0, 10).forEach(([pc, n]) => {
      h += `<tr><td>${pc}</td><td>${n}</td></tr>`;
    });
    h += '</table>';
    document.getElementById('shengxian-pulse-stats').innerHTML = h;
  } else {
    document.getElementById('shengxian-pulse-stats').innerHTML = '<p style="color:var(--ink-soft)">暂无升陷汤医案数据</p>';
  }

  // ③ 白虎加人参汤验案脉象
  const bhData = FORMULA_INDEX.index['白虎加人参汤'];
  if (bhData) {
    const bhCases = bhData.cases;
    const charFreq = {};
    bhCases.forEach(c => {
      (c.pulse_chars || []).forEach(ch => {
        charFreq[ch] = (charFreq[ch] || 0) + 1;
      });
    });
    const bhSorted = Object.entries(charFreq).sort((a,b) => b[1] - a[1]);
    let h = `<p style="font-size:11px;color:var(--ink-soft);margin:4px 0">统计自 <b>${bhCases.length}</b> 个白虎加人参汤真实医案段：</p>`;
    h += '<table><tr><th>脉象</th><th>出现频次</th></tr>';
    bhSorted.slice(0, 10).forEach(([pc, n]) => {
      h += `<tr><td>${pc}</td><td>${n}</td></tr>`;
    });
    h += '</table>';
    document.getElementById('baihu-pulse-stats').innerHTML = h;
  }

  // ④ 弦脉医案主方
  const xianData = PULSE_INDEX.index['弦'];
  if (xianData) {
    const fFreq = {};
    xianData.cases.forEach(c => {
      (c.formulas || []).forEach(f => {
        fFreq[f] = (fFreq[f] || 0) + 1;
      });
    });
    const fSorted = Object.entries(fFreq).sort((a,b) => b[1] - a[1]);
    let h = `<p style="font-size:11px;color:var(--ink-soft);margin:4px 0">统计自 <b>${xianData.count}</b> 个含"弦"脉的真实医案：</p>`;
    h += '<table><tr><th>方剂</th><th>频次</th></tr>';
    fSorted.slice(0, 10).forEach(([f, n]) => {
      h += `<tr><td>${f}</td><td>${n}</td></tr>`;
    });
    h += '</table>';
    document.getElementById('xian-formula-stats').innerHTML = h;
  }

  // ⑤ 特殊脉统计
  const setText = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${n} 段`;
  };
  setText('stat-zhenyouli', PULSE_INDEX.index['真有力']?.count || 0);
  setText('stat-jiayouli', PULSE_INDEX.index['假有力']?.count || 0);
  setText('stat-hehuan', PULSE_INDEX.index['和缓']?.count || 0);
  setText('stat-wugen', PULSE_INDEX.index['无根']?.count || 0);
  // 数+虚/微/弱
  const shuXu = CASES.cases.filter(c => {
    const pc = c.pulse_chars || [];
    return pc.includes('数') && pc.some(x => ['虚','微','弱'].includes(x));
  }).length;
  setText('stat-shuxu', shuXu);
  // 弦+细+弱
  const xianXiRuo = CASES.cases.filter(c => {
    const pc = c.pulse_chars || [];
    return pc.includes('弦') && pc.includes('细') && pc.includes('弱');
  }).length;
  setText('stat-xianxiruo', xianXiRuo);
}

loadAll();

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
  // 长按显示释义
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

// ========== 核心: 反向检索 + 整合所有差分析 ==========
function updateAllDiff() {
  const get = id => document.getElementById(id).value || '';

  // 收集所有已勾选脉象(总按 + 分部)
  const allPulses = new Set();
  ['pulse_left_total', 'pulse_right_total',
   'pulse_left_cun', 'pulse_left_guan', 'pulse_left_chi',
   'pulse_right_cun', 'pulse_right_guan', 'pulse_right_chi'].forEach(id => {
     const v = get(id);
     [...v].forEach(ch => allPulses.add(ch));
   });
  const userPulses = [...allPulses];

  // 4.0 两手总按对比(只显示用户勾的总按部分)
  const totalL = get('pulse_left_total');
  const totalR = get('pulse_right_total');
  const totalEl = document.getElementById('diff-content-total');
  if (totalEl) {
    totalEl.innerHTML = renderTotalPulseDiff(totalL, totalR);
  }

  // 4.2 反向检索(使用所有已勾的脉象)
  const diffEl = document.getElementById('diff-content');
  if (diffEl) {
    if (userPulses.length === 0) {
      diffEl.innerHTML = '勾选脉象后自动反查张锡纯真实医案';
    } else {
      diffEl.innerHTML = renderReverseLookup(userPulses);
    }
  }
}

// 4.0 总按左右对比(简化,只显示已勾脉象,不做病机推断)
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
  }
  return lines.join('<br>');
}

// 4.2 反向检索: 用户脉象 → 真实医案
function renderReverseLookup(userPulses) {
  if (!PULSE_INDEX) return '<p style="color:var(--ink-soft)">数据加载中...</p>';

  // 1. 对每个脉象反查
  const pulseHits = {};
  userPulses.forEach(p => {
    const idx = PULSE_INDEX.index[p];
    if (idx) pulseHits[p] = idx;
  });

  // 2. 找同时含所有用户脉象的医案(交集)
  let intersection = null;
  if (userPulses.length > 0) {
    const sets = userPulses.map(p => {
      const idx = pulseHits[p];
      return idx ? new Set(idx.cases.map(c => c.src_idx + '_' + (c.src_title || '').slice(0,15))) : new Set();
    });
    if (sets.every(s => s.size > 0)) {
      intersection = [...sets[0]].filter(x => sets.every(s => s.has(x)));
    } else {
      intersection = [];
    }
  }

  // 3. 输出
  let html = `<p style="font-size:12px;color:var(--primary-d)">您勾选了 <b>${userPulses.join(' + ')}</b>：</p>`;

  // 各脉象独立命中
  html += '<div style="margin:6px 0"><b>各脉象单独命中:</b><ul style="margin:4px 0 0 16px;font-size:12px">';
  userPulses.forEach(p => {
    const idx = pulseHits[p];
    if (idx) {
      // 找该脉象 Top 3 方剂
      const fFreq = {};
      idx.cases.forEach(c => {
        (c.formulas || []).forEach(f => {
          fFreq[f] = (fFreq[f] || 0) + 1;
        });
      });
      const topF = Object.entries(fFreq).sort((a,b) => b[1] - a[1]).slice(0, 3);
      html += `<li><b>${p}</b>: ${idx.count} 个医案段,主方 ${topF.map(([f,n]) => `${f}(${n})`).join(' / ')}</li>`;
    } else {
      html += `<li><b>${p}</b>: 0 个医案段 (此脉张锡纯原书未单独立案)</li>`;
    }
  });
  html += '</ul></div>';

  // 全部交集
  if (userPulses.length >= 2) {
    if (intersection && intersection.length > 0) {
      html += `<div class="diff-case" style="margin-top:8px"><b>✅ 同时含 ${userPulses.length} 个脉象的真实医案: ${intersection.length} 个</b><ul style="margin:4px 0 0 16px;font-size:11px">`;
      intersection.slice(0, 5).forEach(key => {
        const [idx, title] = key.split('_');
        html += `<li>篇 #${idx}: ${title}</li>`;
      });
      if (intersection.length > 5) {
        html += `<li>...还有 ${intersection.length - 5} 个</li>`;
      }
      html += '</ul></div>';
    } else {
      html += `<div class="diff-warn" style="margin-top:8px"><b>⚠️ 您的组合 ${userPulses.join('+')} 在张锡纯 56 个真实医案中未同时出现</b><br><span style="font-size:11px">这不一定说明组合错误,可能因:①原书脉象描述方式与教科书不同 ②案例数量有限 ③您可参考各脉象单独命中的方剂</span></div>`;
    }
  }

  return html;
}

// 收集函数
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

// 辨证: 简化为反向检索+数据展示
function diagnose() {
  const data = collect();
  const resultEl = document.getElementById('result-content') || document.getElementById('dx-result') || document.getElementById('step-result');
  goStep('result');

  // 收集所有脉象
  const allPulses = new Set();
  ['pulse_left_total','pulse_right_total',
   'pulse_left_cun','pulse_left_guan','pulse_left_chi',
   'pulse_right_cun','pulse_right_guan','pulse_right_chi'].forEach(k => {
     if (data[k]) [...data[k]].forEach(ch => allPulses.add(ch));
   });
  const pulses = [...allPulses];

  // 显示辨证结果
  let html = '<h2>📋 辨证结果（基于张锡纯真实医案）</h2>';

  // 1. 用户输入总结
  html += '<div class="dx-block"><h3>您输入的脉象</h3><div class="dx-content">';
  if (data.pulse_summary) {
    html += `<p><b>原话:</b> <i>${data.pulse_summary}</i></p>`;
  }
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
  html += '</div></div>';

  // 2. 反向检索结果
  html += '<div class="dx-block"><h3>📚 张锡纯真实医案对照</h3><div class="dx-content">';
  if (pulses.length === 0) {
    html += '<p style="color:var(--ink-soft)">未勾选脉象,无法反查医案</p>';
  } else {
    html += renderReverseLookup(pulses);
  }
  html += '</div></div>';

  // 3. 提示
  html += `<div style="background:rgba(201,124,31,0.1); padding:10px; border-left:3px solid var(--warn); border-radius:3px; font-size:12px; margin-top:12px">
    <b>⚠️ 重要提示</b>:本系统<b>不</b>给出辨证结论(如"气虚血瘀"等),<b>只</b>展示张锡纯原书用相同脉象治过的真实医案。
    临床请结合四诊、患者整体情况,由执业中医师判断。
  </div>`;

  if (resultEl) {
    resultEl.innerHTML = html;
    resultEl.classList.remove('hidden');
  }
}

function showDemo() {
  // 自动填充一个升陷汤经典医案
  goStep('pulse');
  // 模拟勾选
  setTimeout(() => {
    const demo = {左总: ['沉','迟','微','弱'], 右总: ['沉','迟','微','弱','无力']};
    Object.entries(demo).forEach(([pos, ps]) => {
      ps.forEach(p => {
        const span = document.querySelector(`.ms[data-pos="${pos}"][class*="ms"]:not(.on)`);
        // 简单办法: 直接点
        const allSpans = document.querySelectorAll(`.ms[data-pos="${pos}"]`);
        allSpans.forEach(s => {
          if (s.textContent === p) s.click();
        });
      });
    });
  }, 100);
}
