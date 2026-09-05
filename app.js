import { COPY } from './ascii/ascii-canvas.js';
import {
  imageState,
  editorMarkup,
  handleImageFile,
  convertImage,
  releaseArtwork,
  clearSelection,
  setUseSelection,
  beginSelection,
  updateSelection,
  endSelection
} from './ascii/image-editor.js';
import { renderImageBadge } from './badge/badge-renderer.js?v=20260905-4';
import { QUESTIONS } from './personality/questions.js';
import { scorePersonality } from './personality/scoring.js';
import { ARCHETYPE_BY_ID } from './personality/archetypes.js';
import { createPersonaSelection } from './personality/persona-variants.js';
import { INTEREST_ASSETS, MAX_INTERESTS, RECOMMENDED_INTERESTS, toggleInterestSelection } from './interests/interest-assets.js?v=20260905-4';
import { renderPersonaComposer } from './components/persona-composer.js?v=20260905-4';
import { mountDebugPanel } from './debug-panel.js?v=20260905-4';
import { renderBadge } from './badge/badge-renderer.js?v=20260905-4';

const STORAGE_KEY = 'dcdc-badge-v2';
const DEFAULT_PROFILE = { name: '', role: '', group: '科研组', customGroup: '', specialty: '' };
const GROUPS = ['研发组', '产品组', '科研组', '运营组', '其他'];

const app = document.querySelector('#app');
const saved = safeParse(localStorage.getItem(STORAGE_KEY));
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1';
const state = {
  step: 1,
  mode: null,
  profile: { ...DEFAULT_PROFILE, ...(saved?.profile || {}) },
  preferences: { glasses: saved?.preferences?.glasses || 'none', interests: [] },
  answers: {},
  questionIndex: 0,
  result: null,
  badgeUrl: '',
  badgeBlobUrl: '',
  lightbox: false,
  loading: false
};

let selectionSession = null;

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: state.profile, preferences: state.preferences }));
}

function effectiveGroup() {
  return state.profile.group === '其他' ? state.profile.customGroup.trim() : state.profile.group;
}

function chineseLength(value) {
  return [...value.trim()].length;
}

const brand = `<div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>我的数创标识牌</span></div>`;

function shell(content) {
  return `<div class="app-shell"><header class="topbar">${brand}<span class="step-count">Step ${typeof state.step === 'number' ? state.step : 3} / 5</span></header><div class="progress" aria-hidden="true"><span style="width:${(typeof state.step === 'number' ? state.step : 3) * 20}%"></span></div>${content}</div>`;
}

function field(id, label, placeholder, value, hint, maxLength) {
  return `<div class="field"><label for="${id}">${label} <span class="hint">${hint}</span></label><input id="${id}" maxlength="${maxLength}" value="${escapeHtml(value)}" placeholder="${placeholder}" autocomplete="off"><div class="error" data-error="${id}"></div></div>`;
}

function renderWelcome() {
  return shell(`<section class="screen welcome"><div class="welcome-art" aria-hidden="true"><span class="disc disc-a"></span><span class="disc disc-b"></span><span class="disc disc-c"></span></div><p class="eyebrow">DCDC DIGITAL PERSONA</p><h1>我的数创标识牌</h1><p class="lead welcome-copy">填写基础信息，选择人格测试或图片定制，生成你的专属数创中心员工标识牌。</p><button class="btn btn-primary" data-action="start">开始生成<span>→</span></button></section>`);
}

function renderProfile() {
  const profile = state.profile;
  const options = GROUPS.map(group => `<option ${profile.group === group ? 'selected' : ''}>${group}</option>`).join('');
  return shell(`<section class="screen"><p class="eyebrow">BASIC INFORMATION</p><h2>填写基础信息</h2><p class="lead">用于生成标识牌，信息只保存在当前浏览器中。</p><div class="stack">
    ${field('name', '姓名', '例如：林知夏', profile.name, '2—6 个汉字', 6)}
    ${field('role', '岗位', '例如：科技管理', profile.role, '不超过 10 个字 · 如软件研发、互联网运营等', 10)}
    <div class="field"><label for="group">部门 / 组别</label><select id="group">${options}</select></div>
    ${profile.group === '其他' ? field('customGroup', '自定义部门 / 组别', '请输入部门或组别', profile.customGroup, '不超过 10 个字', 10) : ''}
    ${field('specialty', '专业或所属方向', '例如：建筑数字化', profile.specialty, '不超过 12 个字 · 可以填专业，如建筑、结构；也可以填点儿别的，如念力码农、摸鱼者、修仙达人、选择困难选手等', 12)}
  </div><div class="actions split"><button class="btn btn-ghost" data-action="back">返回</button><button class="btn btn-primary" data-action="to-test">选择制作方式<span>→</span></button></div></section>`);
}

function renderTest() {
  const question = QUESTIONS[state.questionIndex];
  const selected = state.answers[question.id];
  const choices = question.choices.map(choice => `<button class="answer-card" data-answer="${choice.id}" aria-pressed="${selected === choice.id}"><span class="answer-index">${choice.id}</span><span>${choice.text}</span><i aria-hidden="true">→</i></button>`).join('');
  return shell(`<section class="screen test-screen"><div class="test-meta"><div><p class="eyebrow">DIGITAL PERSONA TEST</p><h2>数创人格测试</h2></div><strong>${state.questionIndex + 1}<small>/6</small></strong></div><p class="test-intro">6道问题，约20秒完成。这不是心理测评，而是一套用于生成专属视觉标识的数创人格测试。</p><div class="question-progress" aria-hidden="true">${QUESTIONS.map((_, index) => `<i class="${index <= state.questionIndex ? 'active' : ''}"></i>`).join('')}</div><div class="question-panel"><p class="question-number">QUESTION ${String(state.questionIndex + 1).padStart(2, '0')}</p><h3>${question.prompt}</h3><div class="answer-list">${choices}</div></div><div class="question-nav"><button class="text-button" data-action="previous-question">${state.questionIndex ? '← 上一题' : '← 返回制作方式'}</button></div></section>`);
}

function renderResult() {
  const { primary, secondary } = state.result;
  const composer = renderPersonaComposer({ profile: { ...state.profile, group: effectiveGroup() }, persona: primary, interests: [] });
  const glassesOptions = [['none', '无'], ['square', '方框'], ['round', '圆框']].map(([id, label]) => `<button class="personalize-chip" data-glasses="${id}" aria-pressed="${state.preferences.glasses === id}">${label}</button>`).join('');
  const interestOptions = INTEREST_ASSETS.map(item => {
    const selectedIndex = state.preferences.interests.indexOf(item.id);
    const selected = selectedIndex >= 0;
    const capped = state.preferences.interests.length >= MAX_INTERESTS && !selected;
    const order = selected ? `<span class="interest-order">${selectedIndex + 1}</span>` : '';
    return `<button class="personalize-chip interest-chip" data-interest="${item.id}" aria-pressed="${selected}" aria-disabled="${capped}" ${capped ? 'disabled' : ''}>${order}<span>${item.name}</span></button>`;
  }).join('');
  return shell(`<section class="screen result-screen"><p class="eyebrow">YOUR DIGITAL PERSONA</p><h2 class="result-kicker">你的数创人格是</h2>${composer}<div class="persona-title"><h1>${primary.nameZh}</h1><p>${primary.nameEn}</p></div><blockquote>“${primary.description}”</blockquote><p class="secondary-persona">偏向：<strong>${secondary.nameZh}</strong><span>${secondary.nameEn}</span></p><div class="personalize-panel"><div class="personalize-group"><p>角色眼镜</p><div class="chip-options" role="group" aria-label="角色眼镜">${glassesOptions}</div></div><div class="personalize-group"><p>给你的标识牌加一点兴趣彩蛋 <small>推荐选择 ${RECOMMENDED_INTERESTS} 个，最多 ${MAX_INTERESTS} 个</small></p><p class="interest-count">已选 ${state.preferences.interests.length} / ${MAX_INTERESTS}</p><p class="interest-hint">按选择顺序依次放入人格周围的位置 1—4；再次点击可取消。</p><div class="chip-options interest-options" role="group" aria-label="兴趣彩蛋">${interestOptions}</div></div></div><div class="actions"><button class="btn btn-primary" data-action="show-badge">查看我的标识牌<span>→</span></button><button class="btn btn-ghost" data-action="restart-test">重新测试</button><button class="btn btn-ghost" data-action="choose-mode">切换制作方式</button></div></section>`);
}

function renderBadgeScreen() {
  const persona = state.mode === 'image' ? null : state.result.primary;
  return shell(`<section class="screen badge-screen"><p class="eyebrow">YOUR DCDC BADGE</p><h2>专属标识牌已生成</h2><p class="lead">${escapeHtml(state.profile.name)} · ${persona ? `${persona.nameZh} / ${persona.nameEn}` : COPY.badgeLabel}</p><div class="preview-wrap"><figure class="preview-card">${state.loading ? '<div class="loading-card">正在合成标识牌…</div>' : `<img src="${state.badgeUrl}" alt="${escapeHtml(state.profile.name)}的专属数创标识牌" data-action="zoom">`}</figure><p class="preview-note">点击标识牌查看大图 · 高清文件 2000 × 900 px</p></div><div class="actions"><button class="btn btn-primary" data-action="download" ${state.loading ? 'disabled' : ''}>下载 PNG<span>↓</span></button><button class="btn btn-ghost" data-action="back-result">${state.mode === 'image' ? '返回图片定制' : '返回人格结果'}</button></div></section>`);
}

function renderMode() {
  return shell(`<section class="screen"><p class="eyebrow">MAKE IT YOURS</p><h2>选择制作方式</h2><p class="lead">${escapeHtml(state.profile.name)}，用你喜欢的方式制作标识牌。</p><div class="stack"><button class="answer-card" data-action="personality-mode">我要做人格测试 →</button><button class="answer-card" data-action="image-mode">我要上传图片定制我的标识卡 →</button></div><div class="actions"><button class="btn btn-ghost" data-action="edit-profile">返回基础信息</button></div></section>`);
}

function render() {
  if (state.step === 'mode') app.innerHTML = renderMode();
  if (state.step === 'image') app.innerHTML = shell(editorMarkup());
  if (state.step === 1) app.innerHTML = renderWelcome();
  if (state.step === 2) app.innerHTML = renderProfile();
  if (state.step === 3) app.innerHTML = renderTest();
  if (state.step === 4) app.innerHTML = renderResult();
  if (state.step === 5) app.innerHTML = renderBadgeScreen();
  if (state.lightbox && state.badgeUrl) {
    app.insertAdjacentHTML('beforeend', `<div class="lightbox" role="dialog" aria-modal="true" aria-label="标识牌大图"><button class="lightbox-close" aria-label="关闭" data-action="close-zoom">×</button><img src="${state.badgeUrl}" alt="高清标识牌"></div>`);
  }
  syncSelectionOverlay();
}

function validateProfile() {
  const profile = state.profile;
  const errors = {};
  if (!/^[\u3400-\u9fff]{2,6}$/.test(profile.name.trim())) errors.name = '请输入 2—6 个汉字';
  if (!profile.role.trim() || chineseLength(profile.role) > 10) errors.role = '岗位必填，且不超过 10 个字';
  if (profile.group === '其他' && (!profile.customGroup.trim() || chineseLength(profile.customGroup) > 10)) errors.customGroup = '请输入不超过 10 个字的部门或组别';
  if (!profile.specialty.trim() || chineseLength(profile.specialty) > 12) errors.specialty = '专业方向必填，且不超过 12 个字';
  document.querySelectorAll('[data-error]').forEach(element => { element.textContent = errors[element.dataset.error] || ''; });
  return Object.keys(errors).length === 0;
}

async function prepareBadge() {
  state.loading = true;
  state.badgeUrl = '';
  if (state.badgeBlobUrl) URL.revokeObjectURL(state.badgeBlobUrl);
  state.badgeBlobUrl = '';
  render();
  try {
    const canvas = state.mode === 'image'
      ? await renderImageBadge({ profile: { ...state.profile, group: effectiveGroup() }, artwork: imageState.artwork })
      : await renderBadge({
          profile: { ...state.profile, group: effectiveGroup() },
          persona: state.result.primary,
          preferences: state.preferences,
          scale: 1
        });
    state.badgeUrl = canvas.toDataURL('image/png');
    const badgeBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    state.badgeBlobUrl = URL.createObjectURL(badgeBlob);
  } catch (error) {
    console.error(error);
    alert('标识牌合成失败，请刷新页面后重试。');
  } finally {
    state.loading = false;
    render();
  }
}

function resetImagePreview(message = '参数已修改，请点击“应用效果”。') {
  imageState.error = message;
  releaseArtwork();
  const badgeButton = document.querySelector('[data-action="image-badge"]');
  const downloadButton = document.querySelector('[data-action="download-art"]');
  const comparison = document.querySelector('#image-comparison');
  const status = document.querySelector('#image-status');
  if (badgeButton) badgeButton.disabled = true;
  if (downloadButton) downloadButton.disabled = true;
  if (comparison) comparison.innerHTML = imageState.originalUrl && imageState.split
    ? `<figure><img src="${imageState.originalUrl}" alt="原图"><figcaption>原图</figcaption></figure>`
    : '';
  if (status) status.textContent = message;
}

function pointerPositionWithinStage(event, stage) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
  };
}

function syncSelectionOverlay() {
  const box = document.querySelector('#selection-box');
  if (!box) return;
  const selection = imageState.selection;
  if (!imageState.useSelection || !selection) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  box.style.left = `${selection.x * 100}%`;
  box.style.top = `${selection.y * 100}%`;
  box.style.width = `${selection.w * 100}%`;
  box.style.height = `${selection.h * 100}%`;
}

async function imageJob(job) {
  if (imageState.busy) return;
  imageState.busy = true;
  imageState.error = '';
  render();
  app.querySelectorAll('input, select, textarea, button').forEach(element => { element.disabled = true; });
  try {
    await new Promise(resolve => setTimeout(resolve, 30));
    await job();
  } catch (error) {
    imageState.error = error.message;
  } finally {
    imageState.busy = false;
    render();
  }
}

app.addEventListener('input', event => {
  const key = event.target.dataset.config;
  if (key && !imageState.busy) {
    imageState.config[key] = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    resetImagePreview('参数已修改，请点击“应用效果”。');
  }

  if (event.target.id in state.profile) {
    state.profile[event.target.id] = event.target.value;
    persist();
  }
});

app.addEventListener('change', async event => {
  if (event.target.id === 'image-file' && event.target.files[0]) {
    const file = event.target.files[0];
    await imageJob(() => handleImageFile(file));
  }

  if (event.target.id === 'split-view') {
    imageState.split = event.target.checked;
    render();
  }

  if (event.target.id === 'use-selection') {
    setUseSelection(event.target.checked);
    resetImagePreview(event.target.checked
      ? '已启用主体框选，请拖拽框选主体后点击“应用效果”。'
      : '已切换为整张图片处理，请点击“应用效果”。');
    render();
  }

  if (event.target.id === 'group') {
    state.profile.group = event.target.value;
    persist();
    render();
  }
});

app.addEventListener('pointerdown', event => {
  const stage = event.target.closest('#selection-stage');
  if (!stage || imageState.busy || !imageState.useSelection) return;
  event.preventDefault();
  const point = pointerPositionWithinStage(event, stage);
  selectionSession = { stage, pointerId: event.pointerId };
  beginSelection(point.x, point.y);
  syncSelectionOverlay();
});

window.addEventListener('pointermove', event => {
  if (!selectionSession) return;
  const point = pointerPositionWithinStage(event, selectionSession.stage);
  updateSelection(point.x, point.y);
  syncSelectionOverlay();
});

window.addEventListener('pointerup', event => {
  if (!selectionSession) return;
  const point = pointerPositionWithinStage(event, selectionSession.stage);
  endSelection(point.x, point.y);
  selectionSession = null;
  syncSelectionOverlay();
  resetImagePreview(imageState.selection
    ? '主体范围已更新，请点击“应用效果”。'
    : '框选区域过小，请重新框选主体。');
});

app.addEventListener('click', async event => {
  const glasses = event.target.closest('[data-glasses]');
  if (glasses) {
    state.preferences.glasses = glasses.dataset.glasses;
    persist();
    render();
    return;
  }

  const interest = event.target.closest('[data-interest]');
  if (interest) {
    state.preferences.interests = toggleInterestSelection(state.preferences.interests, interest.dataset.interest);
    persist();
    render();
    return;
  }

  const answer = event.target.closest('[data-answer]');
  if (answer && !state.loading) {
    state.loading = true;
    const question = QUESTIONS[state.questionIndex];
    state.answers[question.id] = answer.dataset.answer;
    answer.setAttribute('aria-pressed', 'true');
    answer.classList.add('selected');
    if (state.questionIndex < QUESTIONS.length - 1) {
      state.questionIndex += 1;
      window.setTimeout(() => { state.loading = false; render(); }, 130);
    } else {
      state.result = scorePersonality(state.answers);
      state.preferences.interests = [];
      persist();
      state.step = 4;
      window.setTimeout(() => { state.loading = false; render(); }, 160);
    }
    return;
  }

  const action = event.target.closest('[data-action]');
  if (!action || state.loading || imageState.busy) return;

  if (action.dataset.action === 'choose-mode') { state.step = 'mode'; render(); }
  if (action.dataset.action === 'edit-profile') { state.step = 2; render(); }
  if (action.dataset.action === 'personality-mode') { state.mode = 'personality'; state.step = state.result ? 4 : 3; render(); }
  if (action.dataset.action === 'image-mode') { state.mode = 'image'; state.step = 'image'; render(); }
  if (action.dataset.action === 'clear-selection') {
    clearSelection();
    resetImagePreview('框选已清除，请重新拖拽主体范围。');
    render();
  }
  if (action.dataset.action === 'convert-image') { await imageJob(() => convertImage()); }
  if (action.dataset.action === 'image-badge' && imageState.artwork) { state.step = 5; await prepareBadge(); }
  if (action.dataset.action === 'download-art' && imageState.url) {
    const a = document.createElement('a');
    a.href = imageState.url;
    a.download = 'DCDC-透明字符画.png';
    a.click();
  }

  if (action.dataset.action === 'start') { state.step = 2; render(); }
  if (action.dataset.action === 'back') { state.step = 1; render(); }
  if (action.dataset.action === 'to-test' && validateProfile()) {
    persist();
    state.step = 'mode';
    render();
  }
  if (action.dataset.action === 'previous-question') {
    if (state.questionIndex > 0) state.questionIndex -= 1;
    else state.step = 'mode';
    render();
  }
  if (action.dataset.action === 'restart-test') {
    state.loading = false;
    state.answers = {};
    state.questionIndex = 0;
    state.result = null;
    state.badgeUrl = '';
    if (state.badgeBlobUrl) URL.revokeObjectURL(state.badgeBlobUrl);
    state.badgeBlobUrl = '';
    state.step = 3;
    render();
  }
  if (action.dataset.action === 'show-badge') {
    state.step = 5;
    await prepareBadge();
  }
  if (action.dataset.action === 'back-result') { state.step = state.mode === 'image' ? 'image' : 4; render(); }
  if (action.dataset.action === 'zoom') { state.lightbox = true; render(); }
  if (action.dataset.action === 'close-zoom') { state.lightbox = false; render(); }
  if (action.dataset.action === 'download' && state.badgeBlobUrl) {
    const link = document.createElement('a');
    link.download = `DCDC-${state.profile.name}-${state.mode === 'image' ? 'Image' : state.result.primary.nameEn}.png`;
    link.href = state.badgeBlobUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
});

window.__DCDC__ = { QUESTIONS, scorePersonality, ARCHETYPE_BY_ID, createPersonaSelection };
if (DEBUG_MODE) mountDebugPanel(app);
else render();

window.addEventListener('pagehide', () => {
  if (state.badgeBlobUrl) URL.revokeObjectURL(state.badgeBlobUrl);
});
