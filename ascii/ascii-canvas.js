export const DEFAULTS = Object.freeze({
  columns: 120,
  fontSize: 10,
  lineHeight: 9,
  alphaThreshold: 230,
  preset: 'CUSTOM',
  customText: 'DCDC数字创新设计研究中心\nDIGITAL CREATIVE DESIGN\nclass BadgeMaker {}',
  colorMode: 'ORIGINAL',
  customColor: '#2E6CF6',
  invert: false
});

export const COPY = Object.freeze({
  title: '上传图片，生成透明 ASCII 人像',
  hint: '支持自定义中文 / 英文 / 代码字符。可直接上传图片生成 ASCII。字符大小控制的是像素采样块大小：越大，采样点越少，颗粒感越强。支持通过复选框切换反相效果。',
  badgeLabel: '图片定制 ASCII 标识牌'
});

const presets = {
  CLASSIC: '@%#*+=-:.',
  DENSE: '@$B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,"^`.',
  BLOCK: '█▓▒░'
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || a));

export function buildPool(preset, text = '') {
  const custom = Array.from(text).filter(c => !/\s/u.test(c));
  return preset === 'CUSTOM' && custom.length ? custom : Array.from(presets[preset] || presets.CLASSIC);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export async function readImage(file) {
  if (!file) throw new Error('请选择图片');
  if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20 MB。');

  const url = URL.createObjectURL(file);
  const img = new Image();

  try {
    img.src = url;
    await img.decode();

    const pixels = img.naturalWidth * img.naturalHeight;
    if (pixels > 40_000_000) throw new Error('图片像素过大，请控制在 4000 万像素以内。');

    const ratio = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = canvas(img.naturalWidth * ratio, img.naturalHeight * ratio);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function cropTransparent(img, padding = 8) {
  const ctx = img.getContext('2d');
  const data = ctx.getImageData(0, 0, img.width, img.height).data;

  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) return img;

  const sx = Math.max(0, minX - padding);
  const sy = Math.max(0, minY - padding);
  const sw = Math.min(img.width - sx, maxX - minX + 1 + padding * 2);
  const sh = Math.min(img.height - sy, maxY - minY + 1 + padding * 2);

  const out = canvas(sw, sh);
  out.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function parseColor(mode, rgb, customColor) {
  if (mode === 'BLACK') return [30, 30, 30];
  if (mode === 'BLUE') return [46, 108, 246];
  if (mode === 'CUSTOM') {
    const hex = /^#[0-9a-f]{6}$/i.test(customColor) ? customColor : '#2E6CF6';
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }
  return rgb;
}

export function renderAscii(source, options = {}) {
  if (!source?.width || !source?.height) throw new Error('没有可处理的图片。');

  const c = { ...DEFAULTS, ...options };
  const blockSize = clamp(c.fontSize, 6, 32);
  const density = clamp(c.columns, 40, 260);
  const lineHeight = clamp(c.lineHeight, 6, 40);
  const threshold = clamp(c.alphaThreshold, 120, 255);

  // 核心逻辑：fontSize 控制采样块大小，而不是整体输出尺寸。
  const columns = Math.max(8, Math.round(density * 10 / blockSize));
  const cellW = source.width / columns;
  const rows = Math.max(1, Math.round(source.height / Math.max(cellW * (lineHeight / blockSize), 1)));
  const cellH = source.height / rows;

  const sample = canvas(columns, rows);
  const sc = sample.getContext('2d', { willReadFrequently: true });
  sc.drawImage(source, 0, 0, columns, rows);
  const data = sc.getImageData(0, 0, columns, rows).data;

  // 输出画布始终跟随源图尺寸，不因字符大小变化而整体变大。
  const out = canvas(source.width, source.height);
  const ctx = out.getContext('2d');
  ctx.clearRect(0, 0, out.width, out.height);

  const fontSize = Math.max(6, Math.min(cellH * 0.92, cellW * 1.55));
  ctx.font = `700 ${fontSize}px "Microsoft YaHei", "Microsoft YaHei UI", "Noto Sans CJK SC", "PingFang SC", "SimHei", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const tokens = buildPool(c.preset, c.customText);
  let cursor = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const i = (y * columns + x) * 4;
      const rgb = [data[i], data[i + 1], data[i + 2]];
      const alpha = data[i + 3];
      if (alpha < 20) continue;

      const gray = Math.round(0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
      const mappedGray = c.invert ? 255 - gray : gray;
      if (mappedGray >= threshold) continue;

      const token = c.preset === 'CUSTOM'
        ? tokens[cursor++ % tokens.length]
        : tokens[Math.floor(mappedGray * (tokens.length - 1) / 255)];

      const color = parseColor(c.colorMode, rgb, c.customColor);
      const a = Math.max(40, Math.min(255, alpha * (threshold - mappedGray) / threshold));
      ctx.fillStyle = `rgba(${color.join(',')},${a / 255})`;

      const px = x * cellW + cellW / 2;
      const py = y * cellH + cellH / 2 + (lineHeight - blockSize) * 0.1;
      ctx.fillText(token, px, py);
    }
  }

  return cropTransparent(out, 6);
}
