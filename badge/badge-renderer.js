import { textLayout } from '../personality/persona-layouts.js';
import { createPersonaSelection, seedFor } from '../personality/persona-variants.js';
import { sanitizeInterests } from '../interests/interest-assets.js?v=20260905-4';
import { getPersonaComposition, PERSONA_AREA } from '../components/persona-composer.js?v=20260905-4';

export { seedFor };

const imageCache = new Map();
const GLASSES_PATHS = {
  square: './assets/accessories/glasses-square.svg',
  round: './assets/accessories/glasses-round.svg'
};

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`无法加载图片：${src}`));
      image.src = src;
    }));
  }
  return imageCache.get(src);
}

function randomFrom(seed) {
  let value = seed || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function polygon(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
}

function gradientFill(context, colors, opacity, x1, y1, x2, y2) {
  const gradient = context.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  context.globalAlpha = opacity;
  context.fillStyle = gradient;
  context.fill();
}

function drawPersonaBackground(context, visual) {
  const { palette } = visual.layout;
  const random = randomFrom(visual.seed ^ 0x9e3779b9);
  const driftX = (random() - 0.5) * 90;
  const driftY = (random() - 0.5) * 54;
  const opacity = visual.background.opacity;
  const shape = visual.background.mainShape;

  context.save();
  context.beginPath();
  context.rect(PERSONA_AREA.x, PERSONA_AREA.y, PERSONA_AREA.width, PERSONA_AREA.height);
  context.clip();
  context.translate(1485 + shape.x, 450 + shape.y);
  context.scale(shape.width, shape.height);
  context.translate(-1485, -450);

  if (visual.backgroundLayout === 0) {
    context.save();
    context.translate(1480 + driftX, 395 + driftY);
    context.rotate(-0.10);
    context.beginPath();
    context.rect(-360, -215, 720, 430);
    gradientFill(context, [palette[0], palette[1]], (0.10 + random() * 0.035) * opacity, -360, -215, 360, 215);
    context.restore();
    polygon(context, [[1290, 170], [1880, 110], [1960, 360], [1370, 430]]);
    gradientFill(context, [palette[2], palette[0]], (0.07 + random() * 0.035) * opacity, 1290, 170, 1960, 360);
    polygon(context, [[1160, 690], [1540, 410], [1850, 790]]);
    gradientFill(context, [palette[1], palette[2]], (0.06 + random() * 0.035) * opacity, 1160, 690, 1850, 790);
  } else if (visual.backgroundLayout === 1) {
    polygon(context, [[1120 + driftX, 190], [1690, 120 + driftY], [1880, 390], [1270, 480]]);
    gradientFill(context, [palette[1], palette[0]], (0.09 + random() * 0.035) * opacity, 1120, 190, 1880, 390);
    polygon(context, [[1390, 370], [1950, 270], [1850, 760], [1270, 715]]);
    gradientFill(context, [palette[2], palette[1]], (0.08 + random() * 0.04) * opacity, 1390, 370, 1850, 760);
    polygon(context, [[1040, 600], [1320, 420], [1450, 850]]);
    gradientFill(context, [palette[0], palette[2]], (0.06 + random() * 0.03) * opacity, 1040, 600, 1450, 850);
  } else {
    context.save();
    context.translate(1580 + driftX, 460 + driftY);
    context.rotate(0.08);
    context.beginPath();
    context.rect(-330, -275, 660, 550);
    gradientFill(context, [palette[2], palette[0]], (0.085 + random() * 0.04) * opacity, -330, -275, 330, 275);
    context.restore();
    polygon(context, [[1050, 240], [1390, 110], [1320, 570]]);
    gradientFill(context, [palette[1], palette[2]], (0.065 + random() * 0.035) * opacity, 1050, 240, 1390, 570);
    polygon(context, [[1660, 180], [1990, 360], [1730, 610]]);
    gradientFill(context, [palette[0], palette[1]], (0.07 + random() * 0.035) * opacity, 1660, 180, 1990, 610);
  }
  context.restore();
}

function drawAnchoredImage(context, image, anchor, targetWidth, targetHeight) {
  if (!image || !anchor) return;
  const width = targetWidth * anchor.width;
  const height = width * (image.naturalHeight / image.naturalWidth);
  const x = -targetWidth / 2 + anchor.x * targetWidth;
  const y = -targetHeight / 2 + anchor.y * targetHeight;
  context.save();
  context.translate(x, y);
  context.rotate((anchor.rotation || 0) * Math.PI / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

function drawSpacedText(context, text, x, y, spacing) {
  let cursor = x;
  for (const character of text) {
    context.fillText(character, cursor, y);
    cursor += context.measureText(character).width + spacing;
  }
}

function drawSoftAccents(context, visual) {
  const random = randomFrom(visual.seed ^ 0x85ebca6b);
  context.save();
  context.globalAlpha = 0.11;
  context.strokeStyle = visual.layout.palette[Math.floor(random() * visual.layout.palette.length)];
  context.lineWidth = 3;
  const x = 1080 + random() * 140;
  const y = 150 + random() * 100;
  const size = 26 + random() * 16;
  context.strokeRect(x, y, size, size);
  if (random() > 0.45) {
    context.beginPath();
    context.arc(1870 + random() * 45, 690 + random() * 60, 14 + random() * 18, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawInterestElements(context, interestImages, placements) {
  context.save();
  context.beginPath();
  context.rect(PERSONA_AREA.x, PERSONA_AREA.y, PERSONA_AREA.width, PERSONA_AREA.height);
  context.clip();
  context.globalAlpha = 0.92;
  placements.forEach((placement, index) => {
    const image = interestImages[index];
    if (!image) return;
    const width = placement.width;
    const height = width * (image.naturalHeight / image.naturalWidth);
    context.save();
    context.translate(placement.x, placement.y);
    context.rotate(placement.rotate * Math.PI / 180);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
  });
  context.restore();
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveVisualState(profile, personaId, preferences = {}, layoutOverride = null) {
  const selection = createPersonaSelection(profile, personaId, layoutOverride);
  const selectedGlasses = preferences.glasses || 'none';
  return {
    ...selection,
    backgroundLayout: Math.max(0, Math.min(2, selection.backgroundLayout)),
    background: {
      opacity: Math.max(0.4, Math.min(1.4, number(selection.layout.background.opacity, 1))),
      mainShape: {
        x: number(selection.layout.background.mainShape.x, 0),
        y: number(selection.layout.background.mainShape.y, 0),
        width: Math.max(0.6, Math.min(1.4, number(selection.layout.background.mainShape.width, 1))),
        height: Math.max(0.6, Math.min(1.4, number(selection.layout.background.mainShape.height, 1)))
      }
    },
    glasses: selectedGlasses,
    glassesAnchor: selection.layout.glassesAnchor,
    interests: sanitizeInterests(preferences.interests)
  };
}

export async function renderBadge({ profile, persona, preferences = {}, layoutOverride = null, scale = 1 }) {
  const canvas = document.createElement('canvas');
  canvas.width = 2000 * scale;
  canvas.height = 900 * scale;
  const context = canvas.getContext('2d');
  context.scale(scale, scale);

  const visual = resolveVisualState(profile, persona.id, preferences, layoutOverride);
  const composition = getPersonaComposition({ profile, personaId: persona.id, interests: visual.interests, layoutOverride });
  const placements = composition.placements.map(item => ({
    ...item,
    x: PERSONA_AREA.x + PERSONA_AREA.width * item.x / 100,
    y: PERSONA_AREA.y + PERSONA_AREA.height * item.y / 100,
    width: PERSONA_AREA.width * item.w / 100
  }));
  const [base, character, glasses, ...interestImages] = await Promise.all([
    loadImage('./assets/template-base.png'),
    loadImage(visual.image),
    loadImage(GLASSES_PATHS[visual.glasses]),
    ...placements.map(placement => loadImage(placement.path))
  ]);

  context.drawImage(base, 0, 0, 2000, 900);
  drawPersonaBackground(context, visual);
  const targetHeight = 790 * visual.scale;
  const targetWidth = targetHeight * (character.naturalWidth / character.naturalHeight);
  const centerX = 1580 + visual.xOffset;
  const centerY = 487 + visual.yOffset;
  context.save();
  context.beginPath();
  context.rect(PERSONA_AREA.x, PERSONA_AREA.y, PERSONA_AREA.width, PERSONA_AREA.height);
  context.clip();
  context.translate(centerX, centerY);
  context.rotate(visual.rotation * Math.PI / 180);
  context.drawImage(character, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  drawAnchoredImage(context, glasses, visual.glassesAnchor, targetWidth, targetHeight);
  context.restore();
  drawInterestElements(context, interestImages, placements);

  drawBadgeText(context, profile, persona, visual.layout.text, visual.seed);
  drawSoftAccents(context, visual);
  return canvas;
}

function drawBadgeText(context, profile, persona, text, seed) {
  const font = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  context.fillStyle = '#123D6A';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.font = `700 ${text.name.size}px ${font}`;
  context.fillText(profile.name, text.name.x, text.name.y, 760);
  context.font = `600 ${text.role.size}px ${font}`;
  context.fillText(profile.role, text.role.x, text.role.y, 760);
  context.font = `500 ${text.meta.size}px ${font}`;
  context.fillText(`${profile.group} · ${profile.specialty}`, text.meta.x, text.meta.y, 790);
  if (persona) {
  context.fillStyle = '#157F91';
  context.font = `700 ${text.personaZh.size}px ${font}`;
  context.fillText(persona.nameZh, text.personaZh.x, text.personaZh.y);
  context.font = `700 ${text.personaEn.size}px Arial, sans-serif`;
  drawSpacedText(context, persona.nameEn, text.personaEn.x, text.personaEn.y, 3.4);
  }
  context.fillStyle = '#123D6A';
  context.globalAlpha = 0.62;
  context.font = `500 ${text.serial.size}px Arial, sans-serif`;
  drawSpacedText(context, `DCDC DIGITAL ID · ${String(seed).padStart(10, '0')}`, text.serial.x, text.serial.y, 3.2);
  context.globalAlpha = 1;
}

export async function renderImageBadge({ profile, artwork, boardItems = [] }) {
  const canvas = document.createElement('canvas');
  canvas.width = 2000; canvas.height = 900;
  const context = canvas.getContext('2d');
  context.drawImage(await loadImage('./assets/template-base.png'), 0, 0, 2000, 900);
  const area = { x: 990, y: 80, width: 960, height: 770 };
  if (boardItems.length) {
    boardItems.forEach(item => {
      const source = item.canvas || artwork;
      if (!source) return;
      const ratio = Math.min(area.width / source.width, area.height / source.height) * (item.scale || 1);
      const w = source.width * ratio, h = source.height * ratio;
      context.drawImage(source, area.x + area.width * (item.x || .5)-w/2, area.y + area.height * (item.y || .5)-h/2, w, h);
    });
  } else if (artwork) {
    const ratio = Math.min(area.width / artwork.width, area.height / artwork.height);
    const w = artwork.width * ratio, h = artwork.height * ratio;
    context.drawImage(artwork, area.x + (area.width-w)/2, area.y + (area.height-h)/2, w, h);
  }
  drawBadgeText(context, profile, null, textLayout(), seedFor(profile, 'image'));
  return canvas;
}
