import { COPY, DEFAULTS, renderAscii, readImage } from './ascii-canvas.js';

const BOARD_AREA = { x: 990, y: 80, width: 960, height: 770 };
const STAGE_W = 2000;
const STAGE_H = 900;
const DEFAULT_POSITIONS = [
  [0.50, 0.52], [0.33, 0.38], [0.67, 0.40], [0.35, 0.70], [0.68, 0.68], [0.52, 0.28]
];

let nextId = 1;

export const imageState = {
  source: null,
  config: { ...DEFAULTS },
  artwork: null,
  url: '',
  originalUrl: '',
  error: '',
  busy: false,
  split: false,
  revision: 0,
  flow: 'ascii',
  sourceItems: [],
  activeSourceId: null,
  activeArtworkId: null
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || a));

function activeSource() {
  return imageState.sourceItems.find(item => item.id === imageState.activeSourceId) || null;
}

function activeArtwork() {
  return imageState.sourceItems.find(item => item.id === imageState.activeArtworkId && item.artworkCanvas) || null;
}

function generatedItems() {
  return imageState.sourceItems.filter(item => item.artworkCanvas);
}

function indexForPosition(index) {
  return index % DEFAULT_POSITIONS.length;
}

function listSourcesMarkup() {
  if (!imageState.sourceItems.length) return '<p class="board-empty">尚未上传图片。</p>';
  return `<div class="ascii-source-list">${imageState.sourceItems.map((item, index) => `
    <button type="button" class="ascii-thumb ${item.id === imageState.activeSourceId ? 'active' : ''}" data-ascii-source-select="${item.id}">
      <span class="ascii-thumb-index">${index + 1}</span>
      <img src="${item.originalUrl}" alt="源图${index + 1}">
      <span class="ascii-thumb-status">${item.artworkCanvas ? '已生成' : '待生成'}</span>
    </button>`).join('')}</div>`;
}

function selectField(id, label, current, items) {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-config="${id}">${items.map(([v, t]) => `<option value="${v}" ${current === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
}

function configMarkup() {
  const item = activeSource();
  if (!item) return '<p class="board-empty">请先上传一张或多张图片，然后逐张调整 ASCII 生成参数。</p>';
  const c = item.config;
  return `
    <div class="ascii-config-grid">
      ${selectField('preset', '字符预设', c.preset, [[ 'CUSTOM','自定义中文 / 英文 / 代码' ],[ 'CLASSIC','经典' ],[ 'DENSE','密集' ],[ 'BLOCK','方块' ]])}
      ${selectField('colorMode', '颜色', c.colorMode, [[ 'ORIGINAL','原图颜色' ],[ 'BLACK','黑色' ],[ 'BLUE','蓝色' ],[ 'CUSTOM','自定义颜色' ]])}
      <div class="field ascii-custom-color"><label for="customColor">自定义颜色值</label><input type="color" id="customColor" data-config="customColor" value="${c.customColor}"></div>
      <div class="field ascii-custom-text"><label for="customText">自定义字符（空白会忽略）</label><textarea id="customText" data-config="customText" maxlength="4000" rows="4">${esc(c.customText)}</textarea></div>
    </div>
    <details class="ascii-settings-box" open>
      <summary>当前图片生成设置</summary>
      <div class="advanced-grid ascii-advanced-grid">${[['columns','列数',40,260],['fontSize','字符大小（像素块）',6,32],['lineHeight','行高',6,40],['alphaThreshold','透明阈值',120,255]].map(([id,t,min,max])=>`<div class="field"><label for="${id}">${t}</label><input type="number" id="${id}" data-config="${id}" min="${min}" max="${max}" value="${c[id]}"></div>`).join('')}</div>
      <div class="ascii-options-row">
        <label class="check-label"><input id="invert" type="checkbox" data-config="invert" ${c.invert ? 'checked' : ''}><span>生成反相 ASCII</span></label>
      </div>
    </details>`;
}

function comparisonMarkup() {
  const source = activeSource();
  const artwork = activeArtwork() && activeArtwork().id === source?.id ? activeArtwork() : source?.artworkUrl ? source : null;
  if (!source && !artwork) return '';
  const split = imageState.split;
  return `<div class="field checkbox-field compact"><label class="check-label"><input id="split-view" type="checkbox" ${split ? 'checked' : ''}><span>原图 / 字符画并排对比</span></label></div>
    <div class="image-comparison ${split ? 'split' : ''}" id="image-comparison">${split && source ? `<figure><img src="${source.originalUrl}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${artwork?.artworkUrl ? `<figure class="checker"><img src="${artwork.artworkUrl}" alt="字符画"><figcaption>透明字符画</figcaption></figure>` : ''}</div>`;
}

function stageStyle(item) {
  const drawWidth = item.artworkCanvas.width * item.baseScale * item.scale;
  const drawHeight = item.artworkCanvas.height * item.baseScale * item.scale;
  const left = ((BOARD_AREA.x + BOARD_AREA.width * item.x) / STAGE_W) * 100;
  const top = ((BOARD_AREA.y + BOARD_AREA.height * item.y) / STAGE_H) * 100;
  const width = (drawWidth / STAGE_W) * 100;
  const height = (drawHeight / STAGE_H) * 100;
  return `left:${left}%;top:${top}%;width:${width}%;height:${height}%;transform:translate(-50%,-50%) rotate(${item.rotation}deg);`;
}

function stageMarkup() {
  const items = generatedItems();
  if (!items.length) return '<p class="board-empty ascii-board-empty">生成 ASCII 后，可在这里像“直接上传图片制作”一样调整大小、方向和位置。</p>';
  return items.map((item, index) => `
    <button type="button" class="ascii-board-item ${item.id === imageState.activeArtworkId ? 'active' : ''}" data-ascii-art-select="${item.id}" data-ascii-draggable="${item.id}" data-ascii-order="${index}" style="${stageStyle(item)}"><img src="${item.artworkUrl}" alt="ASCII素材${index + 1}"></button>`).join('');
}

function generatedListMarkup() {
  const items = generatedItems();
  if (!items.length) return '<p class="board-empty">当前还没有生成 ASCII 素材。</p>';
  return `<div class="ascii-generated-list">${items.map((item, index) => `
    <button type="button" class="ascii-generated-card ${item.id === imageState.activeArtworkId ? 'active' : ''}" data-ascii-art-select="${item.id}">
      <span class="ascii-thumb-index">${index + 1}</span>
      <img src="${item.artworkUrl}" alt="ASCII素材${index + 1}">
    </button>`).join('')}</div>`;
}

function layoutControlsMarkup() {
  const item = activeArtwork();
  if (!item) return '<p class="board-empty">请先为当前图片生成 ASCII，生成后会出现在上方素材区。</p>';
  return `
    <div class="ascii-controls-grid">
      <div class="field"><label for="ascii-x">横向位置</label><input id="ascii-x" type="range" min="0" max="100" value="${Math.round(item.x * 100)}" data-ascii-layout="x" data-ascii-id="${item.id}"><small data-ascii-value="x">${Math.round(item.x * 100)}%</small></div>
      <div class="field"><label for="ascii-y">纵向位置</label><input id="ascii-y" type="range" min="0" max="100" value="${Math.round(item.y * 100)}" data-ascii-layout="y" data-ascii-id="${item.id}"><small data-ascii-value="y">${Math.round(item.y * 100)}%</small></div>
      <div class="field"><label for="ascii-scale">缩放大小</label><input id="ascii-scale" type="range" min="20" max="220" value="${Math.round(item.scale * 100)}" data-ascii-layout="scale" data-ascii-id="${item.id}"><small data-ascii-value="scale">${Math.round(item.scale * 100)}%</small></div>
      <div class="field"><label for="ascii-rotation">旋转方向</label><input id="ascii-rotation" type="range" min="-180" max="180" value="${Math.round(item.rotation)}" data-ascii-layout="rotation" data-ascii-id="${item.id}"><small data-ascii-value="rotation">${Math.round(item.rotation)}°</small></div>
    </div>
    <div class="ascii-toolbar">
      <button class="btn btn-ghost" data-action="ascii-layer-down">下移一层</button>
      <button class="btn btn-ghost" data-action="ascii-layer-up">上移一层</button>
      <button class="btn btn-ghost" data-action="ascii-remove-art">删除当前字符画</button>
    </div>`;
}

export function editorMarkup() {
  return `<section class="screen"><p class="eyebrow">IMAGE TO CHARACTERS</p><h2>${COPY.title}</h2><p class="lead">${COPY.hint}</p><div class="stack">
    <div class="field"><label for="image-file">上传图片</label><input id="image-file" class="ascii-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"><label class="ascii-file-button" for="image-file">选择图片</label><small>不超过 20 MB / 4000 万像素；处理时最长边缩至 1600 px，GIF 使用静态帧。</small><div id="ascii-source-list-wrap">${listSourcesMarkup()}</div></div>
    <div class="ascii-config-panel"><div class="personalize-group"><p>当前图片生成参数</p><div id="ascii-config-wrap">${configMarkup()}</div></div></div>
    <div id="ascii-comparison-wrap">${comparisonMarkup()}</div>
  </div>
  <p class="error" role="status" id="image-status">${esc(imageState.error)}</p>
  <div class="actions ascii-top-actions"><button class="btn btn-primary" data-action="convert-image" ${imageState.busy || !imageState.activeSourceId ? 'disabled' : ''}>${imageState.busy ? '正在处理…' : '生成当前图片 ASCII'}</button><button class="btn btn-ghost" data-action="download-art" ${!activeArtwork()?.artworkUrl ? 'disabled' : ''}>下载当前透明字符画 PNG</button><button class="btn btn-ghost" data-action="choose-mode">返回图标制作方式</button></div>
  <section class="ascii-layout-section">
    <p class="eyebrow">ASCII LAYOUT EDITOR</p>
    <h3>字符画自定义编辑区</h3>
    <div class="ascii-layout-stack">
      <div class="direct-stage-panel"><div class="ascii-board" id="ascii-board">${stageMarkup()}</div><p class="preview-note">提示：可直接拖动字符画调整位置，也可使用下方滑块微调。</p></div>
      <div class="personalize-panel ascii-bottom-panel"><div class="personalize-group"><p>已生成字符画</p><div id="ascii-generated-list-wrap">${generatedListMarkup()}</div></div><div class="personalize-group"><p>当前字符画调整</p><div id="ascii-layout-controls-wrap">${layoutControlsMarkup()}</div></div></div>
    </div>
  </section>
  <div class="actions"><button class="btn btn-primary" data-action="image-badge" ${generatedItems().length ? '' : 'disabled'}>生成我的标识牌 →</button></div></section>`;
}

function refreshCompatPointers() {
  const source = activeSource();
  const art = activeArtwork();
  imageState.source = source?.sourceCanvas || null;
  imageState.originalUrl = source?.originalUrl || '';
  imageState.config = source?.config || { ...DEFAULTS };
  imageState.artwork = art?.artworkCanvas || null;
  imageState.url = art?.artworkUrl || '';
}

export function clearGeneratedArtworks(onlyActive = false) {
  const targets = onlyActive ? [activeSource()].filter(Boolean) : imageState.sourceItems;
  for (const item of targets) {
    if (item.artworkUrl) URL.revokeObjectURL(item.artworkUrl);
    item.artworkUrl = '';
    item.artworkCanvas = null;
  }
  if (onlyActive && imageState.activeArtworkId && !generatedItems().some(item => item.id === imageState.activeArtworkId)) {
    imageState.activeArtworkId = generatedItems().at(-1)?.id || null;
  }
  if (!onlyActive) imageState.activeArtworkId = generatedItems().at(-1)?.id || null;
  refreshCompatPointers();
}

export function releaseArtwork() {
  clearGeneratedArtworks(false);
}

export async function handleImageFiles(files) {
  for (const file of files) {
    const sourceCanvas = await readImage(file);
    const blob = await new Promise(resolve => sourceCanvas.toBlob(resolve, 'image/png'));
    const originalUrl = blob ? URL.createObjectURL(blob) : sourceCanvas.toDataURL('image/png');
    const config = { ...DEFAULTS };
    const positionIndex = indexForPosition(imageState.sourceItems.length);
    const item = {
      id: nextId++,
      name: file.name,
      sourceCanvas,
      originalUrl,
      config,
      artworkCanvas: null,
      artworkUrl: '',
      x: DEFAULT_POSITIONS[positionIndex][0],
      y: DEFAULT_POSITIONS[positionIndex][1],
      scale: 1,
      rotation: 0,
      baseScale: 0
    };
    imageState.sourceItems.push(item);
    imageState.activeSourceId = item.id;
  }
  refreshCompatPointers();
  imageState.error = '图片已加载，请逐张调整参数后生成 ASCII。';
}

export function updateActiveConfig(key, value) {
  const item = activeSource();
  if (!item) return;
  item.config[key] = value;
  if (item.artworkCanvas) {
    clearGeneratedArtworks(true);
    imageState.error = '参数已修改，请重新生成当前图片 ASCII。';
  }
  refreshCompatPointers();
}

export function selectSourceItem(id) {
  const numeric = Number(id);
  if (!imageState.sourceItems.some(item => item.id === numeric)) return;
  imageState.activeSourceId = numeric;
  if (generatedItems().some(item => item.id === numeric)) imageState.activeArtworkId = numeric;
  refreshCompatPointers();
}

export function selectArtworkItem(id) {
  const numeric = Number(id);
  if (!generatedItems().some(item => item.id === numeric)) return;
  imageState.activeArtworkId = numeric;
  imageState.activeSourceId = numeric;
  refreshCompatPointers();
}

export async function convertImage() {
  const item = activeSource();
  if (!item) throw new Error('请先上传图片。');
  const artwork = renderAscii(item.sourceCanvas, item.config);
  const blob = await new Promise(resolve => artwork.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片导出失败，请降低参数后重试。');
  if (item.artworkUrl) URL.revokeObjectURL(item.artworkUrl);
  item.artworkCanvas = artwork;
  item.artworkUrl = URL.createObjectURL(blob);
  const ratio = Math.min((BOARD_AREA.width * 0.34) / artwork.width, (BOARD_AREA.height * 0.44) / artwork.height, 1);
  if (!item.baseScale) {
    item.scale = 1;
    item.rotation = 0;
  }
  item.baseScale = ratio;
  imageState.activeArtworkId = item.id;
  refreshCompatPointers();
  imageState.error = item.config.invert ? '反相 ASCII 字符画生成完成。' : 'ASCII 字符画生成完成。';
}

export function moveArtworkLayer(direction = 'up') {
  const id = imageState.activeArtworkId;
  const artItems = generatedItems();
  const index = artItems.findIndex(item => item.id === id);
  if (index < 0) return;
  const targetId = direction === 'up' ? artItems[Math.min(artItems.length - 1, index + 1)]?.id : artItems[Math.max(0, index - 1)]?.id;
  if (!targetId || targetId === id) return;
  const srcIndex = imageState.sourceItems.findIndex(item => item.id === id);
  const tgtIndex = imageState.sourceItems.findIndex(item => item.id === targetId);
  const [item] = imageState.sourceItems.splice(srcIndex, 1);
  imageState.sourceItems.splice(tgtIndex, 0, item);
}

export function removeArtworkItem() {
  const item = activeArtwork();
  if (!item) return;
  if (item.artworkUrl) URL.revokeObjectURL(item.artworkUrl);
  item.artworkUrl = '';
  item.artworkCanvas = null;
  imageState.activeArtworkId = generatedItems().at(-1)?.id || null;
  refreshCompatPointers();
}

export function updateArtworkLayout(id, field, rawValue) {
  const item = generatedItems().find(entry => entry.id === Number(id));
  if (!item) return;
  if (field === 'x') item.x = clamp(rawValue, 0, 100) / 100;
  if (field === 'y') item.y = clamp(rawValue, 0, 100) / 100;
  if (field === 'scale') item.scale = clamp(rawValue, 20, 220) / 100;
  if (field === 'rotation') item.rotation = clamp(rawValue, -180, 180);
}

export function setArtworkPosition(id, x, y) {
  const item = generatedItems().find(entry => entry.id === Number(id));
  if (!item) return;
  item.x = clamp(x, 0, 1);
  item.y = clamp(y, 0, 1);
}

export function getGeneratedBoardItems() {
  return generatedItems().map(item => ({ ...item, canvas: item.artworkCanvas }));
}

export function downloadActiveArtwork() {
  const item = activeArtwork();
  if (!item?.artworkUrl) return;
  const a = document.createElement('a');
  a.href = item.artworkUrl;
  a.download = `DCDC-透明字符画-${item.id}.png`;
  a.click();
}

export function refreshAsciiEditorDom() {
  const sourceWrap = document.querySelector('#ascii-source-list-wrap');
  const configWrap = document.querySelector('#ascii-config-wrap');
  const compareWrap = document.querySelector('#ascii-comparison-wrap');
  const generatedWrap = document.querySelector('#ascii-generated-list-wrap');
  const layoutWrap = document.querySelector('#ascii-layout-controls-wrap');
  const board = document.querySelector('#ascii-board');
  if (sourceWrap) sourceWrap.innerHTML = listSourcesMarkup();
  if (configWrap) configWrap.innerHTML = configMarkup();
  if (compareWrap) compareWrap.innerHTML = comparisonMarkup();
  if (generatedWrap) generatedWrap.innerHTML = generatedListMarkup();
  if (layoutWrap) layoutWrap.innerHTML = layoutControlsMarkup();
  if (board) board.innerHTML = stageMarkup();
  const convertBtn = document.querySelector('[data-action="convert-image"]');
  const badgeBtn = document.querySelector('[data-action="image-badge"]');
  const downloadBtn = document.querySelector('[data-action="download-art"]');
  if (convertBtn) convertBtn.disabled = imageState.busy || !imageState.activeSourceId;
  if (badgeBtn) badgeBtn.disabled = !generatedItems().length;
  if (downloadBtn) downloadBtn.disabled = !activeArtwork()?.artworkUrl;
  const status = document.querySelector('#image-status');
  if (status) status.textContent = imageState.error || '';
}

export function syncAsciiEditorDom() {
  refreshCompatPointers();
  const board = document.querySelector('#ascii-board');
  const sourceWrap = document.querySelector('#ascii-source-list-wrap');
  const generatedWrap = document.querySelector('#ascii-generated-list-wrap');
  const layoutWrap = document.querySelector('#ascii-layout-controls-wrap');
  const configWrap = document.querySelector('#ascii-config-wrap');
  const compareWrap = document.querySelector('#ascii-comparison-wrap');
  if (!board || !sourceWrap || !generatedWrap || !layoutWrap || !configWrap || !compareWrap) return;
  refreshAsciiEditorDom();
}

window.addEventListener('pagehide', () => {
  clearGeneratedArtworks(false);
  imageState.sourceItems.forEach(item => {
    if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    if (item.sourceCanvas) item.sourceCanvas.width = 1;
  });
});

export function selectImageFlow(flow) {
  imageState.flow = flow;
  imageState.error = flow === 'transparent' ? '进入透明图片排版模式。' : '进入 ASCII 图片生成模式。';
}
