/* 四诊合参 v2.1 — 4 步界面 + 加权匹配 + 实时浮窗 */
'use strict';

let CHECKLIST = null;   // 70 项
let MATCH = null;       // 607 段 × 70 项 命中矩阵
let CASES = null;       // 607 段
let CURRENT_STEP = 1;

// 脉诊 19 项按 6 维度归类 (位/息/力/体/势/止)
const PULSE_GROUPS = [
  { name: '位 (浮沉)', items: ['脉浮', '脉沉'] },
  { name: '息 (至数)', items: ['脉迟', '脉数'] },
  { name: '力 (强弱)', items: ['脉有力', '脉无力', '脉和缓(正常)'] },
  { name: '体 (大小)', items: ['脉大', '脉细', '脉虚'] },
  { name: '势 (形态)', items: ['脉弦', '脉弦硬', '脉滑', '脉长', '脉芤', '脉濡', '脉缓'] },
  { name: '特殊', items: ['脉无根', '脉上盛下虚'] },
];

async function loadAll() {
  const [cR, mR, csR] = await Promise.all([
    fetch('assets/data/checklist_v2.0.json'),
    fetch('assets/data/case_match_v2.2.json'),
    fetch('assets/data/cases_unified_v2.2.json'),
  ]);
  CHECKLIST = await cR.json();
  MATCH = await mR.json();
  CASES = await csR.json();

  document.getElementById('status-bar').innerHTML =
    `<b>📊 v2.2 数据加载完成</b>：共 <b>${MATCH.case_count}</b> 条 <b>一案一脉诊</b> 完整医案 (来自 8 个原书篇), ` +
    `<b>${Object.values(CHECKLIST.sheets).reduce((s, sh) => s + sh.modern_to_cases.length, 0)}</b> 项勾选 ` +
    `(面 ${CHECKLIST.sheets.face.modern_to_cases.length} + 舌 ${CHECKLIST.sheets.tongue.modern_to_cases.length} + 闻 ${CHECKLIST.sheets.listen.modern_to_cases.length} + 问 ${CHECKLIST.sheets.ask.modern_to_cases.length} + 切 ${CHECKLIST.sheets.pulse.modern_to_cases.length})。` +
    `权重：<b>望诊 1 / 闻诊 1 / 问诊 2 / 切诊 3</b>。`;

  renderLookItems();
  renderListenItems();
  renderAskItems();
  renderPulseItems();
  updateMatchPanel();
  goStep(1);
}

// ============== 渲染各步勾选项 ==============
function renderLookItems() {
  // 望诊 = face + tongue
  const html = renderSheetGroup('望诊 - 面色', CHECKLIST.sheets.face)
    + renderSheetGroup('望诊 - 舌', CHECKLIST.sheets.tongue);
  document.getElementById('look-items').innerHTML = html;
  bindCheckItems();
}

function renderListenItems() {
  const html = renderSheetGroup('闻诊', CHECKLIST.sheets.listen);
  document.getElementById('listen-items').innerHTML = html;
  bindCheckItems();
}

function renderAskItems() {
  // 30 项分两组方便浏览
  const items = CHECKLIST.sheets.ask.modern_to_cases;
  const mid = Math.ceil(items.length / 2);
  const g1 = { ...CHECKLIST.sheets.ask, modern_to_cases: items.slice(0, mid) };
  const g2 = { ...CHECKLIST.sheets.ask, modern_to_cases: items.slice(mid) };
  const html = renderSheetGroup('问诊 - 主症 (上半)', g1)
    + renderSheetGroup('问诊 - 二便/出血/妇科 (下半)', g2);
  document.getElementById('ask-items').innerHTML = html;
  bindCheckItems();
}

function renderPulseItems() {
  // 脉诊按 6 维度归类
  let html = '<table class="dim-grid" style="width:100%;border-collapse:collapse">';
  html += '<thead><tr><th></th><th>左手总按</th><th>右手总按</th></tr></thead><tbody>';

  // 用 sheet 但渲染时分维度
  const sheetItems = CHECKLIST.sheets.pulse.modern_to_cases;
  const itemMap = {};
  sheetItems.forEach((it, i) => { itemMap[it.modern_term] = { it, i }; });

  PULSE_GROUPS.forEach(g => {
    html += `<tr><th colspan="3" style="background:#e8edf2;text-align:left;padding:6px;font-size:12px">${g.name}</th></tr>`;
    g.items.forEach(term => {
      const { it, i } = itemMap[term] || {};
      if (!it) return;
      html += `<tr>
        <th>${it.modern_term}<br><small style="color:#888;font-weight:normal">${it.medical_meaning}</small></th>
        <td colspan="2" style="text-align:left;padding:4px">
          <span class="check-item" data-sheet="pulse" data-idx="${i}">${it.modern_term} <span class="cnt">(${it.case_count} 案)</span></span>
        </td>
      </tr>`;
    });
  });
  html += '</tbody></table>';
  document.getElementById('pulse-items').innerHTML = html;
  bindCheckItems();
}

function renderSheetGroup(title, sheet) {
  const sheetKey = sheet === CHECKLIST.sheets.face ? 'face'
                 : sheet === CHECKLIST.sheets.tongue ? 'tongue'
                 : sheet === CHECKLIST.sheets.listen ? 'listen'
                 : sheet === CHECKLIST.sheets.ask ? 'ask'
                 : 'ask';
  let html = `<div class="check-group">
    <div class="check-group-title">${title} (${sheet.modern_to_cases.length} 项)</div>
    <div class="check-items">`;
  sheet.modern_to_cases.forEach((it, i) => {
    html += `<span class="check-item" data-sheet="${sheetKey}" data-idx="${i}">${it.modern_term} <span class="cnt">(${it.case_count})</span></span>`;
  });
  html += '</div></div>';
  return html;
}

function bindCheckItems() {
  document.querySelectorAll('.check-item').forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', () => {
      el.classList.toggle('on');
      updateMatchPanel();
    });
  });
}

// ============== 加权匹配核心 ==============
function getPicks() {
  const picks = { face: [], tongue: [], listen: [], ask: [], pulse: [] };
  document.querySelectorAll('.check-item.on').forEach(el => {
    const sheet = el.dataset.sheet;
    const idx = parseInt(el.dataset.idx);
    if (picks[sheet]) picks[sheet].push(idx);
  });
  return picks;
}

function computeScores(picks) {
  // 权重
  const W = { face: 1, tongue: 1, listen: 1, ask: 2, pulse: 3 };
  const total = MATCH.case_count;
  // 最大可能分 = 用户所有勾选的权重之和 (假设每项都命中且权重最大)
  let maxScore = 0;
  for (const sheet of ['face', 'tongue', 'listen', 'ask', 'pulse']) {
    maxScore += picks[sheet].length * W[sheet];
  }
  const results = [];
  for (let ci = 0; ci < total; ci++) {
    const m = MATCH.match[ci];
    let score = 0;
    let matchedItems = { face: [], tongue: [], listen: [], ask: [], pulse: [] };
    for (const sheet of ['face', 'tongue', 'listen', 'ask', 'pulse']) {
      picks[sheet].forEach(idx => {
        if (m[sheet][idx] === 1) {
          score += W[sheet];
          matchedItems[sheet].push(idx);
        }
      });
    }
    if (score > 0) {
      results.push({
        case_idx: ci,
        case_id: MATCH.case_ids[ci],
        score: score,
        max_score: maxScore,
        coverage: maxScore > 0 ? score / maxScore : 0,
        matched: matchedItems,
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

function updateMatchPanel() {
  const picks = getPicks();
  const totalPicks = Object.values(picks).reduce((s, a) => s + a.length, 0);

  // 当前仍匹配的医案数
  const results = computeScores(picks);
  const matchCount = totalPicks === 0 ? MATCH.case_count : results.length;
  const countEl = document.getElementById('match-count');
  countEl.textContent = matchCount;
  countEl.classList.toggle('zero', matchCount === 0);

  // 已选条目
  const picksEl = document.getElementById('current-picks');
  if (totalPicks === 0) {
    picksEl.innerHTML = '<span style="color:#999">（未勾选）</span>';
  } else {
    const names = [];
    for (const sheet of ['face', 'tongue', 'listen', 'ask', 'pulse']) {
      picks[sheet].forEach(idx => {
        const it = CHECKLIST.sheets[sheet].modern_to_cases[idx];
        names.push(it.modern_term);
      });
    }
    picksEl.innerHTML = names.map(n => `<span style="display:inline-block;padding:1px 6px;background:#d4e8d4;border-radius:8px;margin:1px">${n}</span>`).join('');
  }

  // 各 sheet 已选数
  ['face', 'tongue', 'listen', 'ask', 'pulse'].forEach(s => {
    const el = document.getElementById(`bd-${s}-n`);
    if (el) el.textContent = picks[s].length;
  });

  // Top 5 当前最像
  const topList = document.getElementById('top-list');
  if (totalPicks === 0) {
    topList.innerHTML = '<div style="color:#999;text-align:center;padding:8px">勾选后显示 Top 5</div>';
  } else if (results.length === 0) {
    topList.innerHTML = '<div style="color:#c00;text-align:center;padding:8px">未匹配到任何医案</div>';
  } else {
    let h = '';
    results.slice(0, 5).forEach((r, i) => {
      const c = CASES.cases[r.case_idx];
      const title = (c.title || c.src_title || '').split('\n')[0].substring(0, 22);
      h += `<div class="ti">
        <span class="score">${r.score}</span>
        <b>#${r.case_id}</b> ${title}
        <span class="matched">匹配: 望${r.matched.face.length + r.matched.tongue.length} · 闻${r.matched.listen.length} · 问${r.matched.ask.length} · 切${r.matched.pulse.length}</span>
      </div>`;
    });
    topList.innerHTML = h;
  }
}

// ============== 步骤切换 ==============
function goStep(n) {
  CURRENT_STEP = n;
  ['step-look', 'step-listen', 'step-ask', 'step-pulse', 'step-result'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const map = { 1: 'step-look', 2: 'step-listen', 3: 'step-ask', 4: 'step-pulse' };
  const target = map[n] || 'step-result';
  document.getElementById(target).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goResult() {
  const picks = getPicks();
  const totalPicks = Object.values(picks).reduce((s, a) => s + a.length, 0);
  if (totalPicks === 0) {
    alert('请至少勾选一项！');
    return;
  }
  const results = computeScores(picks);
  // Top 10
  const top10 = results.slice(0, 10);

  // 汇总
  document.getElementById('result-summary').innerHTML =
    `<b>共勾选 ${totalPicks} 项 (面 ${picks.face.length} + 舌 ${picks.tongue.length} + 闻 ${picks.listen.length} + 问 ${picks.ask.length} + 切 ${picks.pulse.length})</b><br>` +
    `共 <b>${results.length}</b> 段医案匹配 (≥1分)。展示 Top 10。`;

  // 渲染 Top 10
  let html = '';
  top10.forEach((r, i) => {
    const c = CASES.cases[r.case_idx];
    const formulas = (c.formulas || []).map(f => (f.name || f)).join(' + ') || '（原书未列方剂）';
    const snippet = c.content_excerpt || (c.content ? c.content.substring(0, 200) : '');

    // 收集匹配项的中文名
    const matchedNames = [];
    ['face', 'tongue', 'listen', 'ask', 'pulse'].forEach(s => {
      r.matched[s].forEach(idx => {
        const it = CHECKLIST.sheets[s].modern_to_cases[idx];
        matchedNames.push({ name: it.modern_term, sheet: s });
      });
    });

    html += `<div class="result-card">
      <div class="rc-head">
        <div>
          <span class="rc-rank">${i + 1}</span>
          <b>#${r.case_id}</b> <span style="color:#666">${(c.title || c.src_title || '').split('\n')[0].substring(0, 30)}</span>
        </div>
        <div>
          <span class="rc-score">${r.score} / ${r.max_score} 分</span>
          <span style="font-size:11px;color:#888;margin-left:6px">${(r.coverage * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div class="rc-formula">📜 ${formulas}</div>
      <div class="rc-snippet">${snippet}</div>
      <div class="rc-matched">✅ 匹配项：${
        matchedNames.map(m => `<span data-s="${m.sheet}">${m.name}</span>`).join(' ')
      }</div>
    </div>`;
  });

  document.getElementById('result-list').innerHTML = html;
  goStep('result');
}

function resetAll() {
  document.querySelectorAll('.check-item.on').forEach(el => el.classList.remove('on'));
  updateMatchPanel();
  goStep(1);
}

loadAll();
