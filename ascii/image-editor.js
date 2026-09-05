import { DEFAULTS, COPY, readImage, renderAscii, cropTransparent } from './ascii-canvas.js';

export const imageState = {
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
  cvReady: false,
  subjectConfirmed: false
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp01 = value => Math.max(0, Math.min(1, value));
let cvPromise = null;

function selectionStyle(selection) {
  if (!selection || selection.w <= 0 || selection.h <= 0) return 'display:none;';
  return `display:block;left:${selection.x * 100}%;top:${selection.y * 100}%;width:${selection.w * 100}%;height:${selection.h * 100}%;`;
}

export function editorMarkup() {
  const s = imageState;
  const c = s.config;
  const select = (id, label, items) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-config="${id}">${items.map(([v, t]) => `<option value="${v}" ${c[id] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;

  const stage = s.originalUrl ? `
    <div class="field">
      <label>主体框选</label>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;"><input id="use-selection" type="checkbox" ${s.useSelection ? 'checked' : ''}> 启用框选主体提取</label>
        <button class="btn btn-ghost" type="button" data-action="clear-selection">清除框选</button>
      </div>
      <small>启用后，请在下方原图上拖拽绘制主体范围。首次执行主体提取时会自动加载 OpenCV.js。</small>
      <div id="selection-stage" style="position:relative;display:inline-block;max-width:min(100%,520px);border-radius:22px;overflow:hidden;cursor:crosshair;background:linear-gradient(135deg,#f6f8fb,#eef4ff);box-shadow:inset 0 0 0 1px rgba(18,61,106,.08);margin-top:10px;touch-action:none;user-select:none;">
        <img src="${s.originalUrl}" alt="待处理原图" style="display:block;max-width:100%;height:auto;vertical-align:top;pointer-events:none;">
        <div id="selection-box" style="position:absolute;border:2px solid rgba(46,108,246,.95);background:rgba(46,108,246,.12);box-shadow:0 0 0 9999px rgba(18,37,66,.12);border-radius:14px;${selectionStyle(s.selection)}"></div>
      </div>
      <div class="subject-preview" style="margin-top:14px;">
        <label>主体快速预览</label>
        ${s.previewUrl ? `<img src="${s.previewUrl}" alt="主体预览" style="max-width:240px;max-height:240px;object-fit:contain;border-radius:18px;background:#f6f8fb;">` : '<small>框选完成后显示预览（不会运行AI/GrabCut，避免卡顿）。</small>'}
      </div>
    </div>` : '';

  return `<section class="screen"><p class="eyebrow">IMAGE TO CHARACTERS</p><h2>${COPY.title}</h2><p class="lead">${COPY.hint}</p><div class="stack"><div class="field"><label for="image-file">上传图片</label><input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"><small>不超过 20 MB / 4000 万像素；处理时最长边缩至 1600 px，GIF 使用静态帧。</small></div>${stage}${select('preset','字符预设',[['CUSTOM','自定义中文 / 英文 / 代码'],['CLASSIC','经典'],['DENSE','密集'],['BLOCK','方块']])}<div class="field"><label for="customText">自定义字符（空白会忽略）</label><textarea id="customText" data-config="customText" maxlength="4000" rows="3">${esc(c.customText)}</textarea></div>${select('colorMode','颜色',[['ORIGINAL','原图颜色'],['BLACK','黑色'],['BLUE','蓝色'],['CUSTOM','自定义颜色']])}<div class="field"><label for="customColor">自定义颜色值</label><input type="color" id="customColor" data-config="customColor" value="${c.customColor}"></div><details><summary>高级设置</summary><div class="advanced-grid">${[['columns','列数',40,260],['fontSize','字符大小（像素块）',6,32],['lineHeight','行高',6,40],['alphaThreshold','透明阈值',120,255]].map(([id,t,min,max])=>`<div class="field"><label for="${id}">${t}</label><input type="number" id="${id}" data-config="${id}" min="${min}" max="${max}" value="${c[id]}"></div>`).join('')}</div></details><label><input id="split-view" type="checkbox" ${s.split ? 'checked' : ''}> 原图 / 字符画并排对比</label></div><p class="error" role="status" id="image-status">${esc(s.error)}</p><div class="image-comparison ${s.split ? 'split' : ''}" id="image-comparison">${s.originalUrl && s.split ? `<figure><img src="${s.originalUrl}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${s.url ? `<figure class="checker"><img src="${s.url}" alt="字符画"><figcaption>透明字符画</figcaption></figure>` : ''}</div><div class="actions"><button class="btn btn-primary" data-action="convert-image" ${s.busy ? 'disabled' : ''}>${s.busy ? '正在处理…' : (s.subject ? '第二步：生成 ASCII 字符画' : '第一步：确认主体 / 生成透明PNG')}</button><button class="btn btn-primary" data-action="image-badge" ${!s.artwork || s.busy ? 'disabled' : ''}>生成我的标识牌 →</button><button class="btn btn-ghost" data-action="download-art" ${!s.url || s.busy ? 'disabled' : ''}>下载透明字符画 PNG</button><button class="btn btn-ghost" data-action="choose-mode">返回制作方式</button></div></section>`;
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

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
  s.previewSubject = canvas;
  s.previewUrl = URL.createObjectURL(blob);
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

export async function convertImage() {
  const s = imageState;
  if (!s.source) throw new Error('请先上传图片。');

  let working = s.subject || s.source;

  // 两阶段流程：第一步只生成主体PNG，第二步再ASCII化，避免长链计算导致卡死。
  if (s.useSelection && !s.subject) {
    if (!s.selection) throw new Error('请先在原图上拖拽框选主体区域。');
    working = await extractSelectedSubject(s.source, s.selection);
    s.subject = working;
    const subjectBlob = await new Promise(resolve => working.toBlob(resolve, 'image/png'));
    s.subjectUrl = subjectBlob ? URL.createObjectURL(subjectBlob) : '';
    s.error = '主体PNG已生成，请再次点击按钮生成ASCII。';
    return;
  }

  const artwork = renderAscii(working, s.config);
  const blob = await new Promise(resolve => artwork.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片导出失败，请降低参数后重试。');

  releaseArtwork();
  if (s.useSelection && working) {
    s.subject = working;
    const subjectBlob = await new Promise(resolve => working.toBlob(resolve, 'image/png'));
    s.subjectUrl = subjectBlob ? URL.createObjectURL(subjectBlob) : '';
  }
  s.artwork = artwork;
  s.url = URL.createObjectURL(blob);
  s.error = s.useSelection ? '主体提取与字符画生成完成。' : '字符画生成完成。';
}

export async function handleImageFile(file) {
  const s = imageState;
  const source = await readImage(file);
  if (s.source) s.source.width = 1;
  if (s.originalUrl) URL.revokeObjectURL(s.originalUrl);
  releaseArtwork();
  clearSelection();
  s.source = source;
  const blob = await new Promise(resolve => source.toBlob(resolve, 'image/png'));
  s.originalUrl = URL.createObjectURL(blob);
  s.error = s.useSelection ? '图片已加载，请在原图上拖拽框选主体后点击“应用效果”。' : '图片已加载，请点击“应用效果”。';
  if (!s.useSelection) await convertImage();
}

async function extractSelectedSubject(source, selection) {
  const x = Math.floor(selection.x * source.width);
  const y = Math.floor(selection.y * source.height);
  const w = Math.max(1, Math.floor(selection.w * source.width));
  const h = Math.max(1, Math.floor(selection.h * source.height));
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
  return cropTransparent(out, 8);
}

async function ensureOpenCvReady() {
  if (window.cv?.Mat) return window.cv;
  if (!cvPromise) {
    cvPromise = new Promise((resolve, reject) => {
      const finish = () => {
        if (window.cv?.Mat) {
          imageState.cvReady = true;
          resolve(window.cv);
          return true;
        }
        return false;
      };

      if (finish()) return;

      const existing = document.querySelector('script[data-opencv="1"]');
      const timeout = window.setTimeout(() => reject(new Error('OpenCV.js 加载超时，请刷新后重试。')), 30000);

      const bindReady = () => {
        const previous = window.Module || {};
        window.Module = {
          ...previous,
          onRuntimeInitialized() {
            try { previous.onRuntimeInitialized?.(); } catch {}
            clearTimeout(timeout);
            finish() || reject(new Error('OpenCV.js 初始化失败。'));
          }
        };
      };

      if (existing) {
        bindReady();
        existing.addEventListener('error', () => reject(new Error('OpenCV.js 加载失败。')), { once: true });
        return;
      }

      bindReady();
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.x/opencv.js';
      script.async = true;
      script.defer = true;
      script.dataset.opencv = '1';
      script.onerror = () => reject(new Error('OpenCV.js 加载失败，请检查网络。'));
      document.head.appendChild(script);
    });
  }
  return cvPromise;
}

window.addEventListener('pagehide', () => {
  releaseArtwork();
  if (imageState.originalUrl) URL.revokeObjectURL(imageState.originalUrl);
});
