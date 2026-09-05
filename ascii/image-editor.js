import { DEFAULTS, COPY, readImage, renderAscii, cropTransparent } from './ascii-canvas.js';

const BOARD_AREA = { width: 960, height: 770 };
const MAX_BOARD_ITEMS = 12;

export const imageState = {
  flow: null,
  config: { ...DEFAULTS },
  source: null,
  subject: null,
  artwork: null,
  url: '',
  originalUrl: '',
  subjectUrl: '',
  previewSubject: null,
  previewUrl: '',
  error: '',
  busy: false,
  split: false,
  revision: 0,
  useSelection: true,
  selection: null,
  selecting: false,
  dragStart: null,
  boardItems: [],
  activeItemId: '',
  draggingBoardId: '',
  boardDragOrigin: null,
  artworkItemId: ''
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

function selectionStyle(selection) {
  if (!selection || selection.w <= 0 || selection.h <= 0) return 'display:none;';
  return `display:block;left:${selection.x * 100}%;top:${selection.y * 100}%;width:${selection.w * 100}%;height:${selection.h * 100}%;`;
}

function nextId(prefix = 'item') {
  imageState.revision += 1;
  return `${prefix}-${Date.now()}-${imageState.revision}`;
}

function itemDisplayWidthPercent(item) {
  const width = item.canvas.width * item.baseScale * item.scale;
  return Math.max(6, Math.min(92, (width / BOARD_AREA.width) * 100));
}

function currentItem() {
  return imageState.boardItems.find(item => item.id === imageState.activeItemId) || null;
}

function setActiveItem(id) {
  imageState.activeItemId = id || '';
}

async function canvasToBlobUrl(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  return blob ? URL.createObjectURL(blob) : '';
}

async function createBoardItemFromCanvas(canvas, name, options = {}) {
  const longest = Math.max(canvas.width, canvas.height) || 1;
  const target = options.targetSize || 300;
  const item = {
    id: nextId(options.type || 'asset'),
    type: options.type || 'asset',
    name: name || '图片素材',
    canvas,
    url: await canvasToBlobUrl(canvas),
    x: clamp01(options.x ?? 0.5),
    y: clamp01(options.y ?? 0.52),
    scale: clamp(options.scale ?? 1, 0.2, 2.4),
    baseScale: target / longest
  };
  return item;
}

function releaseBoardItems() {
  for (const item of imageState.boardItems) {
    try { if (item.url) URL.revokeObjectURL(item.url); } catch {}
    try { if (item.canvas) item.canvas.width = item.canvas.width; } catch {}
  }
  imageState.boardItems = [];
  imageState.activeItemId = '';
  imageState.artworkItemId = '';
}

export function releaseArtwork() {
  const s = imageState;
  if (s.url) URL.revokeObjectURL(s.url);
  s.url = '';
  if (s.artwork) s.artwork.width = 1;
  s.artwork = null;
  if (s.subjectUrl) URL.revokeObjectURL(s.subjectUrl);
  s.subjectUrl = '';
  if (s.subject) s.subject.width = 1;
  s.subject = null;
  if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
  s.previewUrl = '';
  s.previewSubject = null;
  if (s.originalUrl) URL.revokeObjectURL(s.originalUrl);
  s.originalUrl = '';
  if (s.source) s.source.width = 1;
  s.source = null;
  clearSelection();
}

export function resetImageFlow() {
  releaseArtwork();
  releaseBoardItems();
  imageState.flow = null;
  imageState.error = '';
  imageState.busy = false;
}

export function selectImageFlow(flow) {
  imageState.flow = flow;
  imageState.error = flow === 'transparent'
    ? '请上传透明背景图片，可多张叠加，并在底板上拖动、缩放。'
    : '请先上传照片并生成 ASCII 画像；也可同时上传多张透明背景素材进行组合。';
}

export function getBoardItems() {
  return imageState.boardItems;
}

export async function handleTransparentFiles(fileList) {
  const files = Array.from(fileList || []).slice(0, MAX_BOARD_ITEMS - imageState.boardItems.length);
  if (!files.length) return;
  for (const file of files) {
    const canvas = await readImage(file);
    const item = await createBoardItemFromCanvas(canvas, file.name || '透明素材', { type: 'asset' });
    imageState.boardItems.push(item);
    imageState.activeItemId = item.id;
  }
  imageState.error = `已导入 ${files.length} 张透明背景图片，可在底板上拖动、缩放和调整位置。`;
}

export function removeBoardItem(id) {
  const index = imageState.boardItems.findIndex(item => item.id === id);
  if (index < 0) return;
  const [removed] = imageState.boardItems.splice(index, 1);
  try { if (removed.url) URL.revokeObjectURL(removed.url); } catch {}
  if (imageState.artworkItemId === removed.id) imageState.artworkItemId = '';
  imageState.activeItemId = imageState.boardItems[Math.max(0, index - 1)]?.id || imageState.boardItems[0]?.id || '';
}

export function updateBoardItem(field, value) {
  const item = currentItem();
  if (!item) return;
  if (field === 'x' || field === 'y') item[field] = clamp01(Number(value) / 100);
  if (field === 'scale') item.scale = clamp(Number(value) / 100, 0.2, 2.4);
}

export function beginBoardDrag(id, x, y) {
  const item = imageState.boardItems.find(entry => entry.id === id);
  if (!item) return;
  imageState.activeItemId = id;
  imageState.draggingBoardId = id;
  imageState.boardDragOrigin = { x: clamp01(x), y: clamp01(y), itemX: item.x, itemY: item.y };
}

export function updateBoardDrag(x, y) {
  const { draggingBoardId, boardDragOrigin } = imageState;
  if (!draggingBoardId || !boardDragOrigin) return;
  const item = imageState.boardItems.find(entry => entry.id === draggingBoardId);
  if (!item) return;
  item.x = clamp01(boardDragOrigin.itemX + (clamp01(x) - boardDragOrigin.x));
  item.y = clamp01(boardDragOrigin.itemY + (clamp01(y) - boardDragOrigin.y));
}

export function endBoardDrag() {
  imageState.draggingBoardId = '';
  imageState.boardDragOrigin = null;
}

export function chooseBoardItem(id) {
  setActiveItem(id);
}

export function clearSelection() {
  imageState.selection = null;
  imageState.selecting = false;
  imageState.dragStart = null;
  if (imageState.previewUrl) URL.revokeObjectURL(imageState.previewUrl);
  imageState.previewUrl = '';
  imageState.previewSubject = null;
}

export function setUseSelection(checked) {
  imageState.useSelection = !!checked;
}

export function beginSelection(x, y) {
  imageState.selecting = true;
  imageState.dragStart = { x: clamp01(x), y: clamp01(y) };
  imageState.selection = { x: clamp01(x), y: clamp01(y), w: 0, h: 0 };
}

export function updateSelection(x, y) {
  if (!imageState.selecting || !imageState.dragStart) return imageState.selection;
  imageState.selection = normalizeRect(imageState.dragStart.x, imageState.dragStart.y, clamp01(x), clamp01(y));
  return imageState.selection;
}

async function previewSelectionSubject() {
  const s = imageState;
  if (!s.selection || !s.source) return;
  const x = Math.floor(s.selection.x * s.source.width);
  const y = Math.floor(s.selection.y * s.source.height);
  const w = Math.max(1, Math.floor(s.selection.w * s.source.width));
  const h = Math.max(1, Math.floor(s.selection.h * s.source.height));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(s.source, x, y, w, h, 0, 0, w, h);
  const url = await canvasToBlobUrl(canvas);
  if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
  s.previewSubject = canvas;
  s.previewUrl = url;
}

export function endSelection(x, y) {
  if (!imageState.selecting || !imageState.dragStart) return imageState.selection;
  imageState.selection = normalizeRect(imageState.dragStart.x, imageState.dragStart.y, clamp01(x), clamp01(y));
  imageState.selecting = false;
  imageState.dragStart = null;
  if (imageState.selection.w < 0.01 || imageState.selection.h < 0.01) {
    imageState.selection = null;
  } else {
    previewSelectionSubject().catch(() => {});
  }
  return imageState.selection;
}

function normalizeRect(ax, ay, bx, by) {
  const x1 = Math.min(ax, bx);
  const y1 = Math.min(ay, by);
  const x2 = Math.max(ax, bx);
  const y2 = Math.max(ay, by);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function extractFromSelection(source, selection) {
  const rect = {
    x: Math.max(0, Math.floor(selection.x * source.width)),
    y: Math.max(0, Math.floor(selection.y * source.height)),
    width: Math.max(1, Math.floor(selection.w * source.width)),
    height: Math.max(1, Math.floor(selection.h * source.height))
  };
  if (rect.width < 2 || rect.height < 2) throw new Error('框选区域过小，请重新框选主体。');
  const out = document.createElement('canvas');
  out.width = rect.width;
  out.height = rect.height;
  out.getContext('2d').drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return cropTransparent(out, 2);
}

async function upsertArtworkBoardItem(artwork) {
  const existed = imageState.boardItems.find(item => item.id === imageState.artworkItemId);
  if (existed) {
    try { if (existed.url) URL.revokeObjectURL(existed.url); } catch {}
    existed.canvas = artwork;
    existed.url = await canvasToBlobUrl(artwork);
    const longest = Math.max(artwork.width, artwork.height) || 1;
    existed.baseScale = 320 / longest;
    imageState.activeItemId = existed.id;
    return;
  }
  const item = await createBoardItemFromCanvas(artwork, 'ASCII画像', { type: 'ascii', targetSize: 320 });
  imageState.boardItems.push(item);
  imageState.artworkItemId = item.id;
  imageState.activeItemId = item.id;
}

export async function convertImage() {
  const s = imageState;
  if (!s.source) throw new Error('请先上传照片。');
  let working = s.source;
  if (s.useSelection && s.selection) {
    working = extractFromSelection(s.source, s.selection);
    s.subject = working;
    if (s.subjectUrl) URL.revokeObjectURL(s.subjectUrl);
    s.subjectUrl = await canvasToBlobUrl(working);
  }
  const artwork = renderAscii(working, s.config);
  const blob = await new Promise(resolve => artwork.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片导出失败，请降低参数后重试。');
  if (s.url) URL.revokeObjectURL(s.url);
  if (s.artwork) s.artwork.width = 1;
  s.artwork = artwork;
  s.url = URL.createObjectURL(blob);
  await upsertArtworkBoardItem(artwork);
  s.error = 'ASCII 画像已生成。你可以继续上传透明背景素材，并在底板上拖动、缩放后再生成标识牌。';
}

export async function handleImageFile(file) {
  const s = imageState;
  const source = await readImage(file);
  if (s.source) s.source.width = 1;
  if (s.originalUrl) URL.revokeObjectURL(s.originalUrl);
  if (s.subjectUrl) URL.revokeObjectURL(s.subjectUrl);
  if (s.url) URL.revokeObjectURL(s.url);
  if (s.artworkItemId) {
    removeBoardItem(s.artworkItemId);
  }
  clearSelection();
  s.source = source;
  s.artwork = null;
  s.url = '';
  s.subject = null;
  s.subjectUrl = '';
  const originalBlobUrl = await canvasToBlobUrl(source);
  s.originalUrl = originalBlobUrl;
  s.error = s.useSelection
    ? '照片已加载，请先框选主体区域，再点击“生成 ASCII 画像”。若背景过于复杂，可先在外部工具处理成透明 PNG 后再上传。'
    : '照片已加载，请点击“生成 ASCII 画像”。';
}

function renderBoardStage() {
  const s = imageState;
  const active = currentItem();
  return `
    <div class="editor-grid">
      <div class="field">
        <label for="transparent-files">上传心仪透明背景图（可多张）</label>
        <input id="transparent-files" type="file" accept="image/png,image/webp,image/jpeg" multiple>
        <small>建议上传透明背景 PNG，也支持一次上传多张。导入后可在底板预览中拖动、缩放和微调位置。</small>
        <div class="asset-chips">
          ${s.boardItems.length ? s.boardItems.map(item => `<button type="button" class="asset-chip ${item.id === s.activeItemId ? 'active' : ''}" data-board-item="${item.id}">${esc(item.name)}</button>`).join('') : '<span class="empty-inline">还没有导入素材</span>'}
        </div>
      </div>
      <div class="field">
        <label>底板排版预览</label>
        <div id="board-stage" class="board-stage" style="aspect-ratio:${BOARD_AREA.width} / ${BOARD_AREA.height};">
          <div class="board-stage-inner">
            ${s.boardItems.map(item => `<button type="button" class="board-item ${item.id === s.activeItemId ? 'active' : ''}" data-board-item="${item.id}" style="left:${item.x * 100}%;top:${item.y * 100}%;width:${itemDisplayWidthPercent(item)}%;"><img src="${item.url}" alt="${esc(item.name)}"></button>`).join('')}
            ${!s.boardItems.length ? '<div class="board-empty">上传透明图片后会显示在这里，可直接拖动摆放。</div>' : ''}
          </div>
        </div>
        <small>提示：点击素材后可拖动，也可以用下方滑杆精确调整。</small>
      </div>
    </div>
    <div class="board-controls ${active ? '' : 'disabled'}">
      <div class="field"><label for="board-x">水平位置</label><input id="board-x" type="range" min="0" max="100" value="${active ? Math.round(active.x * 100) : 50}" data-board-control="x" ${active ? '' : 'disabled'}></div>
      <div class="field"><label for="board-y">垂直位置</label><input id="board-y" type="range" min="0" max="100" value="${active ? Math.round(active.y * 100) : 52}" data-board-control="y" ${active ? '' : 'disabled'}></div>
      <div class="field"><label for="board-scale">缩放</label><input id="board-scale" type="range" min="20" max="240" value="${active ? Math.round(active.scale * 100) : 100}" data-board-control="scale" ${active ? '' : 'disabled'}></div>
      <div class="actions compact"><button class="btn btn-ghost" type="button" data-action="remove-board-item" ${active ? '' : 'disabled'}>删除当前素材</button></div>
    </div>`;
}

function renderAsciiPanel() {
  const s = imageState;
  const c = s.config;
  const select = (id, label, items) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-config="${id}">${items.map(([v, t]) => `<option value="${v}" ${c[id] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;

  const selectionPanel = s.originalUrl ? `
    <div class="field">
      <label>上传照片生成 ASCII 风格图</label>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;"><input id="use-selection" type="checkbox" ${s.useSelection ? 'checked' : ''}> 启用框选主体</label>
        <button class="btn btn-ghost" type="button" data-action="clear-selection">清除框选</button>
      </div>
      <small>如果照片背景比较复杂，可提示使用人员先去外部 AI/抠图工具处理成透明 PNG，再走上面的透明素材方案。</small>
      <div id="selection-stage" style="position:relative;display:inline-block;max-width:min(100%,520px);border-radius:22px;overflow:hidden;cursor:crosshair;background:linear-gradient(135deg,#f6f8fb,#eef4ff);box-shadow:inset 0 0 0 1px rgba(18,61,106,.08);margin-top:10px;touch-action:none;user-select:none;">
        <img src="${s.originalUrl}" alt="待处理原图" style="display:block;max-width:100%;height:auto;vertical-align:top;pointer-events:none;">
        <div id="selection-box" style="position:absolute;border:2px solid rgba(46,108,246,.95);background:rgba(46,108,246,.12);box-shadow:0 0 0 9999px rgba(18,37,66,.12);border-radius:14px;${selectionStyle(s.selection)}"></div>
      </div>
      <div class="subject-preview" style="margin-top:14px;">
        <label>主体快速预览</label>
        ${s.previewUrl ? `<img src="${s.previewUrl}" alt="主体预览" style="max-width:240px;max-height:240px;object-fit:contain;border-radius:18px;background:#f6f8fb;">` : '<small>框选完成后显示预览。</small>'}
      </div>
    </div>` : '';

  return `
    <div class="divider-block"></div>
    <div class="editor-grid">
      <div class="field"><label for="image-file">上传照片</label><input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"><small>不超过 20 MB / 4000 万像素；处理时最长边会缩至 1600 px。</small></div>
      ${select('preset','字符预设',[['CUSTOM','自定义中文 / 英文 / 代码'],['CLASSIC','经典'],['DENSE','密集'],['BLOCK','方块']])}
    </div>
    ${selectionPanel}
    <div class="editor-grid">
      <div class="field"><label for="customText">自定义字符（空白会忽略）</label><textarea id="customText" data-config="customText" maxlength="4000" rows="3">${esc(c.customText)}</textarea></div>
      ${select('colorMode','颜色',[['ORIGINAL','原图颜色'],['BLACK','黑色'],['BLUE','蓝色'],['CUSTOM','自定义颜色']])}
    </div>
    <div class="editor-grid">
      <div class="field"><label for="customColor">自定义颜色值</label><input type="color" id="customColor" data-config="customColor" value="${c.customColor}"></div>
      <div class="field"><label style="display:flex;gap:8px;align-items:center;margin-top:28px;"><input id="split-view" type="checkbox" ${s.split ? 'checked' : ''}> 原图 / 字符画并排对比</label></div>
    </div>
    <details><summary>高级设置</summary><div class="advanced-grid">${[['columns','列数',40,260],['fontSize','字符大小（像素块）',6,32],['lineHeight','行高',6,40],['alphaThreshold','透明阈值',120,255]].map(([id,t,min,max])=>`<div class="field"><label for="${id}">${t}</label><input type="number" id="${id}" data-config="${id}" min="${min}" max="${max}" value="${c[id]}"></div>`).join('')}</div></details>
    <div class="actions compact"><button class="btn btn-primary" data-action="convert-image" ${s.busy ? 'disabled' : ''}>${s.busy ? '正在处理…' : '生成 ASCII 画像'}</button><button class="btn btn-ghost" data-action="download-art" ${!s.url || s.busy ? 'disabled' : ''}>下载 ASCII PNG</button></div>
    <div class="image-comparison ${s.split ? 'split' : ''}" id="image-comparison">${s.originalUrl && s.split ? `<figure><img src="${s.originalUrl}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${s.url ? `<figure class="checker"><img src="${s.url}" alt="字符画"><figcaption>ASCII 风格图</figcaption></figure>` : ''}</div>`;
}

export function editorMarkup() {
  const s = imageState;
  if (!s.flow) {
    return `<section class="screen"><p class="eyebrow">IMAGE WORKFLOW</p><h2>选择图片制作入口</h2><p class="lead">把图片功能拆成两个分支：一个用于直接摆放透明素材，一个用于先生成 ASCII 风格图，再继续排版到底板中。</p><div class="mode-card-grid"><button class="mode-card" data-action="select-image-flow" data-flow="transparent"><strong>上传心仪透明背景图</strong><span>支持多张上传、自由移动、放大缩小，并直接生成标识牌。</span></button><button class="mode-card" data-action="select-image-flow" data-flow="ascii"><strong>上传照片生成 ASCII 风格图</strong><span>在透明素材排版能力基础上，叠加原来的 ASCII 生成功能。</span></button></div><div class="actions"><button class="btn btn-ghost" data-action="choose-mode">返回制作方式</button></div></section>`;
  }

  const title = s.flow === 'transparent' ? '上传心仪透明背景图' : '上传照片生成 ASCII 风格图';
  const desc = s.flow === 'transparent'
    ? '你可以同时上传多张透明背景图片，在底板图上自由排版后直接生成标识牌。'
    : '先生成 ASCII 风格图，再与透明背景素材一起在底板上组合。';

  return `<section class="screen"><p class="eyebrow">IMAGE TO BADGE</p><h2>${title}</h2><p class="lead">${desc}</p><div class="flow-tabs"><button class="tab-chip ${s.flow === 'transparent' ? 'active' : ''}" data-action="select-image-flow" data-flow="transparent">透明素材模式</button><button class="tab-chip ${s.flow === 'ascii' ? 'active' : ''}" data-action="select-image-flow" data-flow="ascii">ASCII 模式</button></div>${renderBoardStage()}${s.flow === 'ascii' ? renderAsciiPanel() : ''}<p class="error" role="status" id="image-status">${esc(s.error)}</p><div class="actions"><button class="btn btn-primary" data-action="image-badge" ${!s.boardItems.length || s.busy ? 'disabled' : ''}>生成我的标识牌 →</button><button class="btn btn-ghost" data-action="reset-image-flow">返回图片入口</button><button class="btn btn-ghost" data-action="choose-mode">返回制作方式</button></div></section>`;
}

window.addEventListener('pagehide', () => {
  try { releaseArtwork(); } catch {}
  try { releaseBoardItems(); } catch {}
});
