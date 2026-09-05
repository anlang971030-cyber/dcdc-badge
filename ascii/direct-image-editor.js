import { readImage } from './ascii-canvas.js';

export const directItems = [];
let activeId = null;
let nextId = 1;

const STAGE_W = 2000;
const STAGE_H = 900;
const BOARD_AREA = { x: 990, y: 80, width: 960, height: 770 };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function stageStyle(item) {
  const drawWidth = item.canvas.width * item.baseScale * item.scale;
  const drawHeight = item.canvas.height * item.baseScale * item.scale;
  const left = ((BOARD_AREA.x + BOARD_AREA.width * item.x) / STAGE_W) * 100;
  const top = ((BOARD_AREA.y + BOARD_AREA.height * item.y) / STAGE_H) * 100;
  const width = (drawWidth / STAGE_W) * 100;
  const height = (drawHeight / STAGE_H) * 100;
  return `left:${left}%;top:${top}%;width:${width}%;height:${height}%;transform:translate(-50%,-50%) rotate(${item.rotation}deg);`;
}

function activeItem() {
  return directItems.find(item => item.id === activeId) || null;
}

function controlsMarkup() {
  const item = activeItem();
  if (!item) {
    return '<p class="board-empty">请先上传一张或多张图片。上传后可在底图上查看，并通过下方滑块调整位置、大小和方向。</p>';
  }
  return `
    <div class="direct-controls-grid">
      <div class="field"><label for="direct-x">横向位置</label><input id="direct-x" type="range" min="0" max="100" value="${Math.round(item.x * 100)}" data-direct-field="x" data-direct-id="${item.id}"><small>${Math.round(item.x * 100)}%</small></div>
      <div class="field"><label for="direct-y">纵向位置</label><input id="direct-y" type="range" min="0" max="100" value="${Math.round(item.y * 100)}" data-direct-field="y" data-direct-id="${item.id}"><small>${Math.round(item.y * 100)}%</small></div>
      <div class="field"><label for="direct-scale">缩放大小</label><input id="direct-scale" type="range" min="20" max="220" value="${Math.round(item.scale * 100)}" data-direct-field="scale" data-direct-id="${item.id}"><small>${Math.round(item.scale * 100)}%</small></div>
      <div class="field"><label for="direct-rotation">旋转方向</label><input id="direct-rotation" type="range" min="-180" max="180" value="${Math.round(item.rotation)}" data-direct-field="rotation" data-direct-id="${item.id}"><small>${Math.round(item.rotation)}°</small></div>
    </div>
    <div class="direct-toolbar">
      <button class="btn btn-ghost" data-action="direct-layer-down">下移一层</button>
      <button class="btn btn-ghost" data-action="direct-layer-up">上移一层</button>
      <button class="btn btn-ghost" data-action="direct-remove">删除当前图片</button>
    </div>`;
}

function listMarkup() {
  if (!directItems.length) return '<p class="board-empty">当前还没有上传图片。</p>';
  return `<div class="direct-list">${directItems.map((item, index) => `
    <button class="direct-list-item ${item.id === activeId ? 'active' : ''}" data-direct-select="${item.id}">
      <span class="direct-list-index">${index + 1}</span>
      <img src="${item.url}" alt="${escapeHtml(item.name)}">
      <span class="direct-list-name">${escapeHtml(item.name)}</span>
    </button>`).join('')}</div>`;
}

export function directEditorMarkup() {
  return `<section class="screen"><p class="eyebrow">DIRECT IMAGE</p><h2>上传心仪图片制作</h2><p class="lead">支持多张图片上传。下方会显示铭牌底图，上传的图片可在底图上调整大小、位置和方向；点击预览区中的图片或右侧列表即可切换当前编辑对象。</p><div class="stack"><div class="field"><label for="direct-files">上传图片</label><input id="direct-files" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"><small>支持多选；建议优先上传透明 PNG，也支持 JPG / WEBP。可以继续追加上传。</small></div><div class="direct-layout-grid"><div class="direct-stage-panel"><div class="direct-board" id="direct-board">${directItems.map(item => `<button type="button" class="direct-item ${item.id === activeId ? 'active' : ''}" data-direct-select="${item.id}" data-direct-draggable="${item.id}" style="${stageStyle(item)}"><img src="${item.url}" alt="${escapeHtml(item.name)}"></button>`).join('')}</div><p class="preview-note">提示：可直接拖动图片调整位置，也可使用下方滑块精细调整。</p></div><div class="personalize-panel direct-side-panel"><div class="personalize-group"><p>已上传图片</p>${listMarkup()}</div><div class="personalize-group"><p>当前图片调整</p>${controlsMarkup()}</div></div></div></div><div class="actions"><button class="btn btn-primary" data-action="image-badge" ${directItems.length ? '' : 'disabled'}>生成我的标识牌</button><button class="btn btn-ghost" data-action="back-image-choice">返回图片制作方式</button></div></section>`;
}

export async function handleDirectFiles(files) {
  for (const file of files) {
    const canvas = await readImage(file);
    const url = URL.createObjectURL(file);
    const baseScale = Math.min((BOARD_AREA.width * 0.34) / canvas.width, (BOARD_AREA.height * 0.44) / canvas.height, 1);
    const index = directItems.length;
    const offsets = [
      [0.50, 0.52], [0.33, 0.38], [0.67, 0.40], [0.35, 0.70], [0.68, 0.68], [0.52, 0.28]
    ];
    const [x, y] = offsets[index % offsets.length];
    const item = { id: nextId++, name: file.name, url, canvas, x, y, scale: 1, rotation: 0, baseScale };
    directItems.push(item);
    activeId = item.id;
  }
}

export function updateDirectItem(id, field, rawValue) {
  const item = directItems.find(entry => entry.id === Number(id));
  if (!item) return;
  if (field === 'x') item.x = clamp(rawValue, 0, 100) / 100;
  if (field === 'y') item.y = clamp(rawValue, 0, 100) / 100;
  if (field === 'scale') item.scale = clamp(rawValue, 20, 220) / 100;
  if (field === 'rotation') item.rotation = clamp(rawValue, -180, 180);
}

export function removeDirectItem(id = activeId) {
  const index = directItems.findIndex(entry => entry.id === Number(id));
  if (index < 0) return;
  const [removed] = directItems.splice(index, 1);
  if (removed?.url) URL.revokeObjectURL(removed.url);
  activeId = directItems[index]?.id ?? directItems[index - 1]?.id ?? null;
}

export function moveDirectItem(id = activeId, direction = 'up') {
  const index = directItems.findIndex(entry => entry.id === Number(id));
  if (index < 0) return;
  const target = direction === 'up' ? Math.min(directItems.length - 1, index + 1) : Math.max(0, index - 1);
  if (target === index) return;
  const [item] = directItems.splice(index, 1);
  directItems.splice(target, 0, item);
  activeId = item.id;
}

export function selectDirectItem(id) {
  if (directItems.some(item => item.id === Number(id))) activeId = Number(id);
}

export function getActiveDirectItem() {
  return activeItem();
}

export function setDirectPosition(id, x, y) {
  const item = directItems.find(entry => entry.id === Number(id));
  if (!item) return;
  item.x = clamp(x, 0, 1);
  item.y = clamp(y, 0, 1);
}

export function clearDirectItems() {
  directItems.splice(0, directItems.length).forEach(item => {
    if (item?.url) URL.revokeObjectURL(item.url);
  });
  activeId = null;
}
