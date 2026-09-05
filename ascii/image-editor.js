import { DEFAULTS, COPY, readImage, renderAscii } from './ascii-canvas.js';

const BOARD_AREA = { width: 960, height: 770 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || a));
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const imageState = {
  flow: null,
  config: { ...DEFAULTS },
  source: null,
  artwork: null,
  url: '',
  originalUrl: '',
  error: '',
  busy: false,
  split: false,
  boardItems: [],
  activeItemId: '',
  draggingBoardId: '',
  boardDragOrigin: null,
  pendingPhotoFiles: []
};

function currentItem() {
  return imageState.boardItems.find(item => item.id === imageState.activeItemId) || null;
}

function nextId(prefix = 'asset') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function canvasToBlobUrl(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  return blob ? URL.createObjectURL(blob) : '';
}

function revokeItem(item) {
  try { if (item?.url) URL.revokeObjectURL(item.url); } catch {}
}

function itemDisplayWidthPercent(item) {
  const drawW = item.canvas.width * item.baseScale * item.scale;
  return Math.max(7, Math.min(96, drawW / BOARD_AREA.width * 100));
}

async function createBoardItem(canvas, name = '图片素材', type = 'asset') {
  const longest = Math.max(canvas.width, canvas.height) || 1;
  return {
    id: nextId(type),
    type,
    name,
    canvas,
    url: await canvasToBlobUrl(canvas),
    x: 0.5,
    y: 0.52,
    scale: 1,
    baseScale: 320 / longest
  };
}

export function selectImageFlow(flow) {
  imageState.flow = flow;
  imageState.error = flow === 'transparent'
    ? '请直接上传你喜欢的图片，可多张上传，并在底板中自行缩放和定位。'
    : '请上传照片生成 ASCII 风格图；支持一次上传多张，生成后可在底板中自行缩放和定位。';
}

export function resetImageFlow() {
  releaseArtwork();
  for (const item of imageState.boardItems) revokeItem(item);
  imageState.boardItems = [];
  imageState.activeItemId = '';
  imageState.draggingBoardId = '';
  imageState.boardDragOrigin = null;
  imageState.pendingPhotoFiles = [];
  imageState.flow = null;
  imageState.error = '';
}

export function releaseArtwork() {
  if (imageState.url) URL.revokeObjectURL(imageState.url);
  imageState.url = '';
  if (imageState.originalUrl) URL.revokeObjectURL(imageState.originalUrl);
  imageState.originalUrl = '';
  if (imageState.artwork) imageState.artwork.width = 1;
  imageState.artwork = null;
  if (imageState.source) imageState.source.width = 1;
  imageState.source = null;
  imageState.pendingPhotoFiles = [];
}

export function clearSelection() {}
export function setUseSelection() {}
export function beginSelection() {}
export function updateSelection() { return null; }
export function endSelection() { return null; }

export function chooseBoardItem(id) {
  imageState.activeItemId = id;
}

export function removeBoardItem(id) {
  const index = imageState.boardItems.findIndex(item => item.id === id);
  if (index < 0) return;
  revokeItem(imageState.boardItems[index]);
  imageState.boardItems.splice(index, 1);
  imageState.activeItemId = imageState.boardItems[Math.max(0, index - 1)]?.id || imageState.boardItems[0]?.id || '';
}

export function updateBoardItem(field, value) {
  const item = currentItem();
  if (!item) return;
  if (field === 'x' || field === 'y') item[field] = clamp01((Number(value) || 0) / 100);
  if (field === 'scale') item.scale = clamp((Number(value) || 100) / 100, 0.2, 3);
}

export function beginBoardDrag(id, x, y) {
  const item = imageState.boardItems.find(entry => entry.id === id);
  if (!item) return;
  imageState.activeItemId = id;
  imageState.draggingBoardId = id;
  imageState.boardDragOrigin = { x: clamp01(x), y: clamp01(y), itemX: item.x, itemY: item.y };
}

export function updateBoardDrag(x, y) {
  const item = imageState.boardItems.find(entry => entry.id === imageState.draggingBoardId);
  const origin = imageState.boardDragOrigin;
  if (!item || !origin) return;
  item.x = clamp01(origin.itemX + (clamp01(x) - origin.x));
  item.y = clamp01(origin.itemY + (clamp01(y) - origin.y));
}

export function endBoardDrag() {
  imageState.draggingBoardId = '';
  imageState.boardDragOrigin = null;
}

export function getBoardItems() {
  return imageState.boardItems;
}

export async function handleTransparentFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) throw new Error('请先选择图片。');
  for (const file of list) {
    const canvas = await readImage(file);
    const item = await createBoardItem(canvas, file.name, 'photo');
    imageState.boardItems.push(item);
    imageState.activeItemId = item.id;
  }
  imageState.error = `已导入 ${list.length} 张图片，可在底板中拖动、缩放和定位。`;
}

export async function handleImageFile(input) {
  const files = Array.isArray(input) ? input : Array.from(input?.length !== undefined ? input : [input]).filter(Boolean);
  if (!files.length) throw new Error('请先选择图片。');
  imageState.pendingPhotoFiles = files;

  const first = await readImage(files[0]);
  if (imageState.source) imageState.source.width = 1;
  if (imageState.originalUrl) URL.revokeObjectURL(imageState.originalUrl);
  if (imageState.url) URL.revokeObjectURL(imageState.url);
  imageState.source = first;
  imageState.artwork = null;
  imageState.url = '';
  imageState.originalUrl = await canvasToBlobUrl(first);
  imageState.error = files.length > 1
    ? `已选择 ${files.length} 张照片。点击“生成 ASCII 图层”后会按当前参数逐张生成，并自动加入底板。`
    : '照片已加载，请点击“生成 ASCII 图层”。';
}

export async function convertImage() {
  const files = imageState.pendingPhotoFiles?.length ? imageState.pendingPhotoFiles : [];
  const sources = [];
  if (files.length) {
    for (let i = 0; i < files.length; i++) {
      if (i === 0 && imageState.source) sources.push({ canvas: imageState.source, name: files[i].name || `照片${i + 1}` });
      else sources.push({ canvas: await readImage(files[i]), name: files[i].name || `照片${i + 1}` });
    }
  } else if (imageState.source) {
    sources.push({ canvas: imageState.source, name: 'ASCII图片' });
  } else {
    throw new Error('请先上传照片。');
  }

  let lastArtwork = null;
  for (const entry of sources) {
    const artwork = renderAscii(entry.canvas, imageState.config);
    lastArtwork = artwork;
    const item = await createBoardItem(artwork, `ASCII · ${entry.name}`, 'ascii');
    imageState.boardItems.push(item);
    imageState.activeItemId = item.id;
  }

  if (imageState.url) URL.revokeObjectURL(imageState.url);
  if (imageState.artwork) imageState.artwork.width = 1;
  imageState.artwork = lastArtwork;
  imageState.url = await canvasToBlobUrl(lastArtwork);
  imageState.error = `已生成 ${sources.length} 张 ASCII 图层，可继续在底板中缩放和定位。`;
}

function boardEditorMarkup() {
  const active = currentItem();
  return `
    <div class="field">
      <label>底板图排版</label>
      <div id="board-stage" class="board-stage" style="aspect-ratio:${BOARD_AREA.width}/${BOARD_AREA.height};">
        <div class="board-stage-inner">
          ${imageState.boardItems.map(item => `<button type="button" class="board-item ${item.id === imageState.activeItemId ? 'active' : ''}" data-board-item="${item.id}" style="left:${item.x * 100}%;top:${item.y * 100}%;width:${itemDisplayWidthPercent(item)}%;"><img src="${item.url}" alt="${esc(item.name)}"></button>`).join('')}
          ${!imageState.boardItems.length ? '<div class="board-empty">图片会显示在这里，支持拖动、缩放和定位。</div>' : ''}
        </div>
      </div>
      <div class="asset-chips">
        ${imageState.boardItems.length ? imageState.boardItems.map(item => `<button type="button" class="asset-chip ${item.id === imageState.activeItemId ? 'active' : ''}" data-board-item="${item.id}">${esc(item.name)}</button>`).join('') : '<span class="empty-inline">暂无已生成图片</span>'}
      </div>
    </div>
    <div class="board-controls ${active ? '' : 'disabled'}">
      <div class="field"><label for="board-x">水平位置</label><input id="board-x" type="range" min="0" max="100" value="${active ? Math.round(active.x * 100) : 50}" data-board-control="x" ${active ? '' : 'disabled'}></div>
      <div class="field"><label for="board-y">垂直位置</label><input id="board-y" type="range" min="0" max="100" value="${active ? Math.round(active.y * 100) : 52}" data-board-control="y" ${active ? '' : 'disabled'}></div>
      <div class="field"><label for="board-scale">缩放</label><input id="board-scale" type="range" min="20" max="300" value="${active ? Math.round(active.scale * 100) : 100}" data-board-control="scale" ${active ? '' : 'disabled'}></div>
      <div class="actions compact"><button class="btn btn-ghost" type="button" data-action="remove-board-item" ${active ? '' : 'disabled'}>删除当前图片</button></div>
    </div>`;
}

function transparentFlowMarkup() {
  return `<section class="screen"><p class="eyebrow">IMAGE LAYOUT</p><h2>上传心仪透明背景图</h2><p class="lead">直接上传你觉得好看的图片，支持多张上传，并在底板图上自行缩放、定位和排版。</p>
    <div class="stack">
      <div class="field"><label for="transparent-files">上传图片（可多张）</label><input id="transparent-files" type="file" accept="image/png,image/jpeg,image/webp" multiple><small>推荐透明背景 PNG；普通 JPG / PNG 也可以直接使用。</small></div>
      ${boardEditorMarkup()}
    </div>
    <p class="error" role="status" id="image-status">${esc(imageState.error)}</p>
    <div class="actions"><button class="btn btn-primary" data-action="image-badge" ${imageState.boardItems.length ? '' : 'disabled'}>生成我的标识牌 →</button><button class="btn btn-ghost" data-action="reset-image-flow">返回图片入口</button><button class="btn btn-ghost" data-action="choose-mode">返回制作方式</button></div></section>`;
}

function asciiFlowMarkup() {
  const c = imageState.config;
  const select = (id, label, items) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-config="${id}">${items.map(([v, t]) => `<option value="${v}" ${c[id] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  return `<section class="screen"><p class="eyebrow">IMAGE TO CHARACTERS</p><h2>${COPY.title}</h2><p class="lead">上传一张或多张照片生成 ASCII 风格图；生成后的图片会进入底板编辑区，可继续缩放、定位和排版。</p>
    <div class="stack">
      <div class="field"><label for="image-file">上传照片（可多张）</label><input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" multiple><small>已删除原来的框选主体步骤，直接按整张图生成 ASCII 风格图。</small></div>
      ${imageState.originalUrl ? `<div class="image-comparison ${imageState.split ? 'split' : ''}" id="image-comparison">${imageState.originalUrl && imageState.split ? `<figure><img src="${imageState.originalUrl}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${imageState.url ? `<figure class="checker"><img src="${imageState.url}" alt="ASCII 风格图"><figcaption>ASCII 风格图</figcaption></figure>` : ''}</div>` : ''}
      <div class="editor-grid">${select('preset','字符预设',[['CUSTOM','自定义中文 / 英文 / 代码'],['CLASSIC','经典'],['DENSE','密集'],['BLOCK','方块']])}${select('colorMode','颜色',[['ORIGINAL','原图颜色'],['BLACK','黑色'],['BLUE','蓝色'],['INVERT','反相'],['CUSTOM','自定义颜色']])}</div>
      <div class="editor-grid"><div class="field"><label for="customText">自定义字符（空白会忽略）</label><textarea id="customText" data-config="customText" maxlength="4000" rows="3">${esc(c.customText)}</textarea></div><div class="field"><label for="customColor">自定义颜色值</label><input type="color" id="customColor" data-config="customColor" value="${c.customColor}"><label style="display:flex;gap:8px;align-items:center;margin-top:16px;"><input id="split-view" type="checkbox" ${imageState.split ? 'checked' : ''}> 原图 / ASCII 并排对比</label></div></div>
      <details><summary>高级设置</summary><div class="advanced-grid">${[['columns','列数',40,260],['fontSize','字符大小（像素块）',6,32],['lineHeight','行高',6,40],['alphaThreshold','透明阈值',120,255]].map(([id,t,min,max])=>`<div class="field"><label for="${id}">${t}</label><input type="number" id="${id}" data-config="${id}" min="${min}" max="${max}" value="${c[id]}" /></div>`).join('')}</div></details>
      <div class="actions compact"><button class="btn btn-primary" data-action="convert-image" ${imageState.busy ? 'disabled' : ''}>${imageState.busy ? '正在处理…' : '生成 ASCII 图层'}</button><button class="btn btn-ghost" data-action="download-art" ${imageState.url ? '' : 'disabled'}>下载当前 ASCII PNG</button></div>
      ${boardEditorMarkup()}
    </div>
    <p class="error" role="status" id="image-status">${esc(imageState.error)}</p>
    <div class="actions"><button class="btn btn-primary" data-action="image-badge" ${imageState.boardItems.length ? '' : 'disabled'}>生成我的标识牌 →</button><button class="btn btn-ghost" data-action="reset-image-flow">返回图片入口</button><button class="btn btn-ghost" data-action="choose-mode">返回制作方式</button></div></section>`;
}

export function editorMarkup() {
  if (!imageState.flow) {
    return `<section class="screen"><p class="eyebrow">IMAGE WORKFLOW</p><h2>选择图片制作方式</h2><div class="mode-card-grid"><button class="mode-card" data-action="select-image-flow" data-flow="transparent"><strong>上传心仪透明背景图</strong><span>上传你喜欢的图片，支持多张上传，并在底板图上自行缩放与定位。</span></button><button class="mode-card" data-action="select-image-flow" data-flow="ascii"><strong>上传照片生成 ASCII</strong><span>进入当前 ASCII 生成功能，移除框选步骤，并支持多张生成后放到底板上排版。</span></button></div><div class="actions"><button class="btn btn-ghost" data-action="choose-mode">返回制作方式</button></div></section>`;
  }
  return imageState.flow === 'transparent' ? transparentFlowMarkup() : asciiFlowMarkup();
}

window.addEventListener('pagehide', () => {
  try { releaseArtwork(); } catch {}
  try { imageState.boardItems.forEach(revokeItem); } catch {}
});
