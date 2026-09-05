import { ARCHETYPES } from './personality/archetypes.js';
import { INTEREST_SLOT_NAMES, PERSONA_LAYOUTS, clearPersonaLayoutOverride, getPersonaLayout, savePersonaLayoutOverride } from './personality/persona-layouts.js';
import { renderBadge } from './badge/badge-renderer.js?v=20260905-4';

const DEBUG_PROFILE = { name: '调试用户', role: '视觉校准', group: '设计组', specialty: '参数调试' };
const clone = value => JSON.parse(JSON.stringify(value));

export function mountDebugPanel(root) {
  root.innerHTML = `<main class="debug-shell"><section class="debug-preview-pane"><div><p class="eyebrow">DCDC VISUAL DEBUG</p><h1>标识牌视觉调试</h1><p>人物与眼镜的尺寸、位置和旋转已按人格分别定稿。</p></div><figure class="debug-preview"><div class="loading-card">正在渲染…</div></figure></section><aside class="debug-controls"><label class="debug-field">PERSONA<select id="debug-persona">${ARCHETYPES.map(item => `<option value="${item.id}">${item.nameZh} / ${item.nameEn}</option>`).join('')}</select></label>${section('PERSONA · FIXED', [fixedGrid('persona', [['scale', 'scale'], ['xOffset', 'x'], ['yOffset', 'y'], ['rotation', 'rotation']])])}${section('GLASSES · FIXED', [`<label class="debug-check"><input id="debug-glasses" type="checkbox">预览眼镜</label>`, `<label class="debug-field">type<select id="debug-glasses-type"><option value="square">方框</option><option value="round">圆框</option></select></label>`, fixedGrid('glasses', [['x', 'x'], ['y', 'y'], ['width', 'width'], ['rotation', 'rotation']])])}${section('BACKGROUND', [`<label class="debug-field">layout<select id="debug-bg-layout"><option value="0">1</option><option value="1">2</option><option value="2">3</option></select></label>`, range('debug-bg-opacity', 'opacity', .4, 1.4, .01), range('debug-bg-x', 'main x', -220, 220, 1), range('debug-bg-y', 'main y', -160, 160, 1), range('debug-bg-width', 'main width', .6, 1.4, .01), range('debug-bg-height', 'main height', .6, 1.4, .01)])}${section('INTEREST ELEMENT', [`<label class="debug-field">按选择顺序<select id="debug-slot">${INTEREST_SLOT_NAMES.map((name, index) => `<option value="${name}">元素 ${index + 1} / ${name}</option>`).join('')}</select></label>`, range('debug-slot-x', 'x %', 0, 100, .1), range('debug-slot-y', 'y %', 0, 100, .1), range('debug-slot-w', 'width %', 8, 24, .1), range('debug-slot-rotate', 'rotate', -12, 12, .1)])}<div class="debug-actions"><button class="btn btn-primary" id="debug-apply">应用到本地正式预览</button><button class="btn" id="debug-copy">复制配置代码</button><button class="btn" id="debug-reset">恢复源码配置</button></div><p id="debug-status" class="debug-status" aria-live="polite"></p><textarea id="debug-output" readonly aria-label="当前正式配置代码"></textarea></aside></main>`;

  const personaSelect = root.querySelector('#debug-persona');
  const working = Object.fromEntries(Object.keys(PERSONA_LAYOUTS).map(id => [id, getPersonaLayout(id)]));
  let renderVersion = 0;
  let timer;

  function setValue(id, value) {
    const input = root.querySelector(`#${id}`);
    input.value = value;
    const output = root.querySelector(`[data-for="${id}"]`);
    if (output) output.textContent = Number(value).toFixed(input.step.includes('.') ? String(input.step).split('.')[1].length : 0);
  }
  function value(id) { return Number(root.querySelector(`#${id}`).value); }
  function current() { return working[personaSelect.value]; }

  function showFixed(prefix, values) {
    Object.entries(values).forEach(([name, value]) => {
      root.querySelector(`#debug-fixed-${prefix}-${name}`).textContent = Number(value).toFixed(name === 'scale' ? 3 : name === 'rotation' ? 2 : 3);
    });
  }

  function readControls() {
    const config = current();
    config.background = { layout: value('debug-bg-layout'), opacity: value('debug-bg-opacity'), mainShape: { x: value('debug-bg-x'), y: value('debug-bg-y'), width: value('debug-bg-width'), height: value('debug-bg-height') } };
    const slotName = root.querySelector('#debug-slot').value;
    config.interestSlots[slotName] = { ...config.interestSlots[slotName], x: value('debug-slot-x'), y: value('debug-slot-y'), w: value('debug-slot-w'), rotate: value('debug-slot-rotate') };
    return config;
  }

  function loadSlot() {
    const slot = current().interestSlots[root.querySelector('#debug-slot').value];
    setValue('debug-slot-x', slot.x); setValue('debug-slot-y', slot.y); setValue('debug-slot-w', slot.w); setValue('debug-slot-rotate', slot.rotate || 0);
  }

  function loadPersona() {
    const config = current();
    showFixed('persona', config.persona);
    showFixed('glasses', config.glassesAnchor);
    root.querySelector('#debug-glasses').checked = false;
    root.querySelector('#debug-glasses-type').value = 'square';
    root.querySelector('#debug-bg-layout').value = config.background.layout ?? 0;
    setValue('debug-bg-opacity', config.background.opacity); setValue('debug-bg-x', config.background.mainShape.x); setValue('debug-bg-y', config.background.mainShape.y); setValue('debug-bg-width', config.background.mainShape.width); setValue('debug-bg-height', config.background.mainShape.height);
    root.querySelector('#debug-slot').value = 'slot1'; loadSlot(); scheduleRender();
  }

  function exportConfig() { return `${personaSelect.value}: ${JSON.stringify(readControls(), null, 2)}`; }

  async function updatePreview() {
    const version = ++renderVersion;
    const persona = ARCHETYPES.find(item => item.id === personaSelect.value);
    const preferences = { glasses: root.querySelector('#debug-glasses').checked ? root.querySelector('#debug-glasses-type').value : 'none', interests: ['reading', 'fitness', 'pet', 'drink'] };
    const canvas = await renderBadge({ profile: DEBUG_PROFILE, persona, preferences, layoutOverride: readControls(), scale: .6 });
    if (version !== renderVersion) return;
    root.querySelector('.debug-preview').innerHTML = `<img src="${canvas.toDataURL('image/png')}" alt="调试标识牌预览">`;
    root.querySelector('#debug-output').value = exportConfig();
  }
  function scheduleRender() { window.clearTimeout(timer); timer = window.setTimeout(updatePreview, 45); }
  function status(message) { root.querySelector('#debug-status').textContent = message; }

  root.addEventListener('input', event => {
    const output = root.querySelector(`[data-for="${event.target.id}"]`);
    if (output) output.textContent = Number(event.target.value).toFixed(event.target.step?.includes('.') ? String(event.target.step).split('.')[1].length : 0);
    if (!['debug-persona', 'debug-slot'].includes(event.target.id)) readControls();
    scheduleRender();
  });
  personaSelect.addEventListener('change', loadPersona);
  root.querySelector('#debug-slot').addEventListener('change', () => { loadSlot(); scheduleRender(); });
  root.querySelector('#debug-apply').addEventListener('click', () => { savePersonaLayoutOverride(personaSelect.value, readControls()); status('已应用。普通页面重新生成标识牌后生效。'); });
  root.querySelector('#debug-reset').addEventListener('click', () => { working[personaSelect.value] = clone(clearPersonaLayoutOverride(personaSelect.value)); loadPersona(); status('已恢复该人格的源码配置。'); });
  root.querySelector('#debug-copy').addEventListener('click', async () => {
    const output = root.querySelector('#debug-output'); output.value = exportConfig();
    try { await navigator.clipboard.writeText(output.value); } catch { output.select(); document.execCommand('copy'); }
    status('已复制，可直接替换 PERSONA_LAYOUTS 中同名人格配置。');
  });
  loadPersona();
}

function fixedGrid(prefix, fields) {
  return `<div class="debug-fixed-grid">${fields.map(([name, label]) => `<span>${label}<strong id="debug-fixed-${prefix}-${name}"></strong></span>`).join('')}</div>`;
}
function range(id, label, min, max, step) { return `<label class="debug-range"><span>${label}<output data-for="${id}"></output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"></label>`; }
function section(title, controls) { return `<fieldset class="debug-section"><legend>${title}</legend>${controls.join('')}</fieldset>`; }
