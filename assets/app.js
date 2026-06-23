/* 仿张锡纯辨证施治 v0.5 - 完整知识库版 */
'use strict';

let KB = null;
let INPUT_MODE = 'qna';

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

// 收集表单数据
function collect() {
  const look = [...document.querySelectorAll('input[name="look"]:checked')].map(i => i.value);
  const ask = [...document.querySelectorAll('input[name="ask"]:checked')].map(i => i.value);
  const trigger = [...document.querySelectorAll('input[name="trigger"]:checked')].map(i => i.value);
  const pulse = {
    左寸: document.querySelector('[name="pulse_left_cun"]').value,
    左关: document.querySelector('[name="pulse_left_guan"]').value,
    左尺: document.querySelector('[name="pulse_left_chi"]').value,
    右寸: document.querySelector('[name="pulse_right_cun"]').value,
    右关: document.querySelector('[name="pulse_right_guan"]').value,
    右尺: document.querySelector('[name="pulse_right_chi"]').value,
  };
  const pulseAspects = [...document.querySelectorAll('input[name="pulse-aspect"]:checked')].map(i => i.value);
  return {
    望: look,
    问: { 主症: ask, 诱发: trigger, 补充: document.getElementById('ask-free').value },
    切: { ...pulse, 总评: document.getElementById('pulse-summary').value, 兼象: pulseAspects }
  };
}

// 核心：基于脉象-医案映射的辨证
function diagnose() {
  if (!KB) { alert('知识库加载中，请稍候再试'); return; }
  const data = collect();
  const result = matchFormula(data);
  renderResult(data, result);
  goStep('result');
}

// 查找与输入脉象相关的医案
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

// 匹配方剂 - 基于脉象+症状
function matchFormula(data) {
  // 收集所有脉象
  const allPulses = [];
  Object.entries(data.切).forEach(([k, v]) => {
    if (k !== '总评' && k !== '兼象' && v) allPulses.push(v);
  });
  // 总评里再分词
  if (data.切.总评) {
    ['沉','迟','数','微','弱','弦','细','洪','滑','涩','紧','虚','实','浮','结','代','大','长','短','芤','革','牢','动','缓','促'].forEach(p => {
      if (data.切.总评.includes(p) && !allPulses.includes(p)) allPulses.push(p);
    });
  }

  // 找相关医案
  const relatedCases = findCasesByPulse(allPulses);

  // 按方剂分组
  const formulaCount = {};
  relatedCases.forEach(c => {
    formulaCount[c.formula_id] = (formulaCount[c.formula_id] || 0) + 1;
  });

  // 排序
  const top = Object.entries(formulaCount).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // 找这些方剂的完整信息
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

  // 脉象概要
  const pulseStr = allPulses.length > 0 ? allPulses.join('、') : '无';

  // 方剂 HTML
  const formulaHtml = formulas.map((f, idx) => {
    // 找此方剂相关的医案
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
        <div class="dx-content">
          <div class="label">属性：</div>${f.attr}
        </div>
        <div class="dx-content" style="margin-top:6px">
          <div class="label">组成与方解：</div>${f.body.substring(0, 400)}...
        </div>
        ${caseHtml ? `
        <div class="dx-content" style="margin-top:6px">
          <div class="label">📚 真实医案（${cases.length} 例，展示前 3）：</div>
          ${caseHtml}
        </div>` : ''}
      </div>
    `;
  }).join('');

  // 左右手脉象展示
  const pulseDetail = Object.entries(data.切)
    .filter(([k,v]) => k !== '总评' && k !== '兼象' && v)
    .map(([k,v]) => `${k}：${v}`).join('，');
  const aspects = data.切.兼象.length > 0 ? `<br><strong>关键兼象：</strong>${data.切.兼象.join('、')}` : '';
  const summary = data.切.总评 ? `<br><strong>脉象总评：</strong>${data.切.总评}` : '';

  root.innerHTML = `
    <div class="dx-block">
      <h3>辨证依据（您输入的脉象 + 症状）</h3>
      <div class="dx-content">
        <strong>脉象：</strong>${pulseDetail || '无'}${summary}${aspects}<br>
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
      <div class="dx-content">
        选自《医学衷中参西录》治大气下陷方·升陷汤验案。<br>
        完整流程：四诊合参 → 识别脉象"沉迟微弱，关前尤甚" → 判定"大气下陷" → 用升陷汤升举胸中大气。
      </div>
    </div>
    <div class="dx-block">
      <h3>辨证逻辑（张锡纯）</h3>
      <div class="dx-content">
        "此证得之力田劳苦过度。夫劳倦伤脾，脾伤则中气下陷；
        然脉右部濡、关前沉细，此胸中大气下陷之的候也。
        大气一虚，则呼吸不利而气短；中气下陷则脏腑下垂而满闷；
        关后弦而无力者，肾气不固也。
        当升补胸中大气，佐以补肾固摄。"
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
      <div class="dx-content" style="margin-top:8px"><strong>方解：</strong>黄芪既善补气又善升气，为君；知母凉润制黄芪之热；柴胡引大气自左上升；升麻引大气自右上升；桔梗载药上达胸中为向导。</div>
    </div>
    <button class="btn-restart" onclick="location.reload()">返回辨证</button>
  `;
  goStep('result');
}
