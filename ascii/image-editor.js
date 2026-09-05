import { DEFAULTS, COPY, readImage, renderAscii } from './ascii-canvas.js';

export const imageState = {
  config: { ...DEFAULTS },
  source: null,
  artwork: null,
  url: '',
  originalUrl: '',
  error: '',
  busy: false,
  split: false,
  revision: 0,
  flow: 'ascii'
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function editorMarkup() {
  const s = imageState;
  const c = s.config;
  const select = (id, label, items) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-config="${id}">${items.map(([v, t]) => `<option value="${v}" ${c[id] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;

  return `<section class="screen"><p class="eyebrow">IMAGE TO CHARACTERS</p><h2>${COPY.title}</h2><p class="lead">${COPY.hint}</p><div class="stack"><div class="field"><label for="image-file">上传图片</label><input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"><small>不超过 20 MB / 4000 万像素；处理时最长边缩至 1600 px，GIF 使用静态帧。</small>${s.originalUrl ? `<div class="upload-preview"><img src="${s.originalUrl}" alt="已上传图片预览"><span>已上传图片</span></div>` : ''}</div>${select('preset','字符预设',[[ 'CUSTOM','自定义中文 / 英文 / 代码' ],[ 'CLASSIC','经典' ],[ 'DENSE','密集' ],[ 'BLOCK','方块' ]])}<div class="field"><label for="customText">自定义字符（空白会忽略）</label><textarea id="customText" data-config="customText" maxlength="4000" rows="3">${esc(c.customText)}</textarea></div>${select('colorMode','颜色',[[ 'ORIGINAL','原图颜色' ],[ 'BLACK','黑色' ],[ 'BLUE','蓝色' ],[ 'CUSTOM','自定义颜色' ]])}<div class="field"><label for="customColor">自定义颜色值</label><input type="color" id="customColor" data-config="customColor" value="${c.customColor}"></div><div class="field checkbox-field"><label class="check-label"><input id="invert" type="checkbox" data-config="invert" ${c.invert ? 'checked' : ''}><span>生成反相 ASCII</span></label><small>勾选后会在生成时对灰度映射进行反相，可随时切换后重新生成。</small></div><details open><summary>高级设置</summary><div class="advanced-grid">${[['columns','列数',40,260],['fontSize','字符大小（像素块）',6,32],['lineHeight','行高',6,40],['alphaThreshold','透明阈值',120,255]].map(([id,t,min,max])=>`<div class="field"><label for="${id}">${t}</label><input type="number" id="${id}" data-config="${id}" min="${min}" max="${max}" value="${c[id]}"></div>`).join('')}</div></details><label><input id="split-view" type="checkbox" ${s.split ? 'checked' : ''}> 原图 / 字符画并排对比</label></div><p class="error" role="status" id="image-status">${esc(s.error)}</p><div class="image-comparison ${s.split ? 'split' : ''}" id="image-comparison">${s.originalUrl && s.split ? `<figure><img src="${s.originalUrl}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${s.url ? `<figure class="checker"><img src="${s.url}" alt="字符画"><figcaption>透明字符画</figcaption></figure>` : ''}</div><div class="actions"><button class="btn btn-primary" data-action="convert-image" ${s.busy ? 'disabled' : ''}>${s.busy ? '正在处理…' : '生成 ASCII 字符画'}</button><button class="btn btn-primary" data-action="image-badge" ${!s.artwork || s.busy ? 'disabled' : ''}>生成我的标识牌 →</button><button class="btn btn-ghost" data-action="download-art" ${!s.url || s.busy ? 'disabled' : ''}>下载透明字符画 PNG</button><button class="btn btn-ghost" data-action="choose-mode">返回制作方式</button></div></section>`;
}

export function releaseArtwork() {
  const s = imageState;
  if (s.url) URL.revokeObjectURL(s.url);
  s.url = '';
  if (s.artwork) s.artwork.width = 1;
  s.artwork = null;
}

export async function convertImage() {
  const s = imageState;
  if (!s.source) throw new Error('请先上传图片。');

  const artwork = renderAscii(s.source, s.config);
  const blob = await new Promise(resolve => artwork.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片导出失败，请降低参数后重试。');

  releaseArtwork();
  s.artwork = artwork;
  s.url = URL.createObjectURL(blob);
  s.error = s.config.invert ? '反相 ASCII 字符画生成完成。' : 'ASCII 字符画生成完成。';
}

export async function handleImageFile(file) {
  const s = imageState;
  const source = await readImage(file);
  if (s.source) s.source.width = 1;
  if (s.originalUrl) URL.revokeObjectURL(s.originalUrl);
  releaseArtwork();
  s.source = source;
  const blob = await new Promise(resolve => source.toBlob(resolve, 'image/png'));
  s.originalUrl = URL.createObjectURL(blob);
  s.error = '图片已加载，请点击“生成 ASCII”。';
}

window.addEventListener('pagehide', () => {
  releaseArtwork();
  if (imageState.originalUrl) URL.revokeObjectURL(imageState.originalUrl);
});

// compatibility exports for image workflow controller
export function selectImageFlow(flow) {
  imageState.flow = flow;
  imageState.error = flow === 'transparent' ? '进入透明图片排版模式。' : '进入 ASCII 图片生成模式。';
}
