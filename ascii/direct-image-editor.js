import { readImage } from './ascii-canvas.js';
import { boardState, addBoardItem, selectBoardItem, getActiveBoardItem, removeBoardItem, clearBoardItems, updateBoardItem, moveBoardItem, getBoardItems } from './image-board.js';

const BOARD_AREA = { x: 990, y: 80, width: 960, height: 770 };
const STAGE = { width: 2000, height: 900 };
const DEFAULT_POSITIONS = [
  [0.50, 0.52], [0.34, 0.38], [0.66, 0.38], [0.34, 0.66], [0.66, 0.66], [0.50, 0.30]
];

export const directImageState = {
  error: '',
  busy: false,
  drag: null
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function itemStyle(item) {
  const width = (item.canvas.width * item.baseScale * item.scale) / STAGE.width;
  const height = (item.canvas.height * item.baseScale * item.scale) / STAGE.height;
  const left = (BOARD_AREA.x + BOARD_AREA.width * item.x) / STAGE.width;
  const top = (BOARD_AREA.y + BOARD_AREA.height * item.y) / STAGE.height;
  return `left:${percent(left)};top:${percent(top)};width:${percent(width)};height:${percent(height)};`;
}

function boardLayersMarkup() {
  if (!boardState.items.length) return '<p class="board-empty">暂未上传素材，请先选择图片。</p>';
  return `<div class="board-layers">${boardState.items.map((item, index) => `<button type="button" class="board-layer ${boardState.active === item.id ? 'active' : ''}" data-board-select="${item.id}"><span class="board-layer-index">${index + 1}</span><span class="board-layer-name">${esc(item.name)}</span></button>`).join('')}</div>`;
}

function controlsMarkup() {
  const active = getActiveBoardItem();
  if (!active) return '<p class="board-empty">上传后可在这里调节大小和位置，也可以直接在铭牌预览区拖动素材。</p>';
  const x = Math.round(active.x * 100);
  const y = Math.round(active.y * 100);
  const scale = Math.round(active.scale * 100);
  return `<div class="board-controls-grid">
    <div class="field"><label for="board-x">横向位置</label><input id="board-x" type="range" min="0" max="100" value="${x}" data-board-field="x"><small>${x}%</small></div>
    <div class="field"><label for="board-y">纵向位置</label><input id="board-y" type="range" min="0" max="100" value="${y}" data-board-field="y"><small>${y}%</small></div>
    <div class="field"><label for="board-scale">缩放</label><input id="board-scale" type="range" min="20" max="220" value="${scale}" data-board-field="scale"><small>${scale}%</small></div>
  </div>
  <div class="board-tool-actions">
    <button class="btn btn-ghost" type="button" data-board-move="down">下移一层</button>
    <button class="btn btn-ghost" type="button" data-board-move="up">上移一层</button>
    <button class="btn btn-ghost" type="button" data-board-remove="${active.id}">删除当前素材</button>
  </div>`;
}

export function directEditorMarkup() {
  return `<section class="screen"><p class="eyebrow">DIRECT IMAGE LAYOUT</p><h2>上传心仪图片，直接制作标识牌</h2><p class="lead">可同时上传多张素材，在铭牌底图中自由调整大小和位置。ASCII 分支保持不变，已单独保留。</p><div class="stack"><div class="field"><label for="board-files">上传素材图片</label><input id="board-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" multiple><small>支持多张上传，建议使用透明背景 PNG；上传后可拖动素材或使用下方滑块微调。</small></div><p class="error" id="board-status">${esc(directImageState.error)}</p><div class="board-stage-wrap"><div id="board-stage" class="board-stage">${boardState.items.map(item => `<button type="button" class="board-stage-item ${boardState.active === item.id ? 'active' : ''}" style="${itemStyle(item)}" data-board-select="${item.id}" data-board-draggable="${item.id}"><img src="${item.previewUrl}" alt="${esc(item.name)}"></button>`).join('')}</div></div><div class="personalize-panel"><div class="personalize-group"><p>已上传素材</p>${boardLayersMarkup()}</div><div class="personalize-group"><p>当前素材调节</p>${controlsMarkup()}</div></div></div><div class="actions"><button class="btn btn-primary" data-action="image-badge" ${!boardState.items.length || directImageState.busy ? 'disabled' : ''}>生成我的标识牌 →</button><button class="btn btn-ghost" data-action="back-image-branch">返回图片制作方式</button></div></section>`;
}

export async function handleBoardFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) throw new Error('请先选择图片。');
  directImageState.busy = true;
  directImageState.error = '';
  const startCount = boardState.items.length;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const canvas = await readImage(file);
    const previewBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const previewUrl = previewBlob ? URL.createObjectURL(previewBlob) : canvas.toDataURL('image/png');
    const item = addBoardItem(canvas, file.name, previewUrl);
    const pos = DEFAULT_POSITIONS[(startCount + index) % DEFAULT_POSITIONS.length];
    const ratio = Math.min((BOARD_AREA.width * 0.34) / canvas.width, (BOARD_AREA.height * 0.48) / canvas.height, 1);
    updateBoardItem(item.id, 'baseScale', ratio);
    updateBoardItem(item.id, 'x', pos[0]);
    updateBoardItem(item.id, 'y', pos[1]);
    updateBoardItem(item.id, 'scale', 1);
  }

  directImageState.busy = false;
  directImageState.error = `已上传 ${files.length} 张素材，可继续上传并调整位置。`;
}

export function updateActiveBoardField(field, rawValue) {
  const active = getActiveBoardItem();
  if (!active) return;
  if (field === 'scale') updateBoardItem(active.id, 'scale', clamp(rawValue, 20, 220) / 100);
  if (field === 'x') updateBoardItem(active.id, 'x', clamp(rawValue, 0, 100) / 100);
  if (field === 'y') updateBoardItem(active.id, 'y', clamp(rawValue, 0, 100) / 100);
}

export function removeActiveBoardItem() {
  const active = getActiveBoardItem();
  if (active) removeBoardItem(active.id);
}

export function resetDirectEditor() {
  clearBoardItems();
  directImageState.error = '';
  directImageState.busy = false;
  directImageState.drag = null;
}

export function beginBoardDrag(id, clientX, clientY, rect) {
  const item = boardState.items.find(entry => entry.id === id);
  if (!item || !rect) return;
  directImageState.drag = { id, startX: clientX, startY: clientY, originX: item.x, originY: item.y, rect };
  boardState.active = id;
}

export function updateBoardDrag(clientX, clientY) {
  const drag = directImageState.drag;
  if (!drag) return false;
  const dx = (clientX - drag.startX) / drag.rect.width;
  const dy = (clientY - drag.startY) / drag.rect.height;
  const x = clamp(drag.originX + dx / (BOARD_AREA.width / STAGE.width), 0, 1);
  const y = clamp(drag.originY + dy / (BOARD_AREA.height / STAGE.height), 0, 1);
  updateBoardItem(drag.id, 'x', x);
  updateBoardItem(drag.id, 'y', y);
  return true;
}

export function endBoardDrag() {
  directImageState.drag = null;
}

export { boardState, selectBoardItem, getActiveBoardItem, moveBoardItem, getBoardItems };
