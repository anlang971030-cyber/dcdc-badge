export const PERSONA_LAYOUTS = {
  architect: layout(['#7897C7', '#A7D9DC', '#B8ADD2'], { x: 0.555, y: 0.17, width: 0.16, rotation: 16 }, {
    slot1: slot(25.8, 22.7, 19.1),
    slot2: slot(82, 15.4, 20.2, 12),
    slot3: slot(84, 68, 19.5),
    slot4: slot(28.2, 64.5, 15.4)
  }, { scale: 1.094, xOffset: -80, yOffset: 0, rotation: 0.05 }),
  explorer: layout(['#70B7A8', '#6EAAB0', '#A9DFE0'], { x: 0.57, y: 0.173, width: 0.159, rotation: -3.4 }, {
    slot1: slot(21.1, 15.9, 19.7, 5.5),
    slot2: slot(83, 22, 19.1),
    slot3: slot(33.4, 57.2, 18.5),
    slot4: slot(84, 55, 15.8)
  }, { scale: 1.069, xOffset: -45, yOffset: -4, rotation: 0.05 }),
  connector: layout(['#70AECA', '#79BCAE', '#A9CAE1'], { x: 0.515, y: 0.199, width: 0.14, rotation: -16.5 }, {
    slot1: slot(16.5, 28.2, 19.3),
    slot2: slot(84, 28.8, 22, 9.8),
    slot3: slot(26.3, 71.4, 20.4),
    slot4: slot(82, 74, 17.4)
  }, { scale: 1.2, xOffset: -98, yOffset: 0, rotation: 0 }),
  analyst: layout(['#8F83B7', '#8398B2', '#C4B6D8'], { x: 0.555, y: 0.176, width: 0.15, rotation: 2 }, {
    slot1: slot(18, 18, 24),
    slot2: slot(82, 18, 20.6, -8),
    slot3: slot(82, 63.7, 21.1, 12),
    slot4: slot(25.5, 58.3, 18.5, -12)
  }, { scale: 1.078, xOffset: -105, yOffset: 0, rotation: 0 }),
  maker: layout(['#84AA7C', '#B0C77E', '#93A593'], { x: 0.49, y: 0.185, width: 0.15, rotation: -19.6 }, {
    slot1: slot(84, 20, 20.6, 3.9),
    slot2: slot(18, 18, 22.4),
    slot3: slot(84, 68.1, 20.3),
    slot4: slot(24.1, 63.7, 15.9, 12)
  }, { scale: 1.052, xOffset: -45, yOffset: 0, rotation: 0 }),
  catalyst: layout(['#D7BE72', '#B7C97D', '#77B9B4'], { x: 0.475, y: 0.204, width: 0.15, rotation: -19.2 }, {
    slot1: slot(17, 16, 20.2, -12),
    slot2: slot(83, 18, 19.1, 11),
    slot3: slot(84.8, 77.1, 17.8, 2.7),
    slot4: slot(22.5, 63.7, 16, 6)
  }, { scale: 1.092, xOffset: -75, yOffset: 0, rotation: 0 })
};

function slot(x, y, w, rotate = 0, anchor = 'center', zIndex = 20) {
  return { x, y, w, rotate, anchor, zIndex };
}

function layout(palette, glassesAnchor, interestSlots, persona) {
  return {
    persona,
    palette,
    glassesAnchor,
    background: { layout: null, opacity: 1, mainShape: { x: 0, y: 0, width: 1, height: 1 } },
    text: textLayout(),
    interestSlots
  };
}

function textLayout() {
  return {
    name: { x: 102, y: 402, size: 144 },
    role: { x: 105, y: 620, size: 55 },
    meta: { x: 105, y: 531, size: 86 },
    personaZh: { x: 105, y: 735, size: 47 },
    personaEn: { x: 105, y: 778, size: 30 },
    serial: { x: 105, y: 838, size: 15 }
  };
}

export const INTEREST_SLOT_NAMES = ['slot1', 'slot2', 'slot3', 'slot4'];

export const VISUAL_OVERRIDE_KEY = 'dcdc-visual-overrides-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, override = {}) {
  return {
    ...clone(base),
    ...override,
    persona: clone(base.persona),
    glassesAnchor: clone(base.glassesAnchor),
    background: {
      ...base.background,
      ...override.background,
      mainShape: { ...base.background.mainShape, ...override.background?.mainShape }
    },
    // 左侧文字布局已定稿：所有人格统一使用源码参数，不接受本地调试覆盖。
    text: clone(base.text),
    interestSlots: Object.fromEntries(INTEREST_SLOT_NAMES.map(name => [
      name,
      { ...base.interestSlots[name], ...override.interestSlots?.[name] }
    ]))
  };
}

function storedOverrides() {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(VISUAL_OVERRIDE_KEY) || '{}'); }
  catch { return {}; }
}

export function getPersonaLayout(personaId, override = null) {
  const base = PERSONA_LAYOUTS[personaId];
  if (!base) throw new Error(`缺少人格布局配置：${personaId}`);
  return merge(base, override || storedOverrides()[personaId]);
}

export function savePersonaLayoutOverride(personaId, config) {
  const all = storedOverrides();
  all[personaId] = merge(PERSONA_LAYOUTS[personaId], config);
  localStorage.setItem(VISUAL_OVERRIDE_KEY, JSON.stringify(all));
  return all[personaId];
}

export function clearPersonaLayoutOverride(personaId) {
  const all = storedOverrides();
  delete all[personaId];
  localStorage.setItem(VISUAL_OVERRIDE_KEY, JSON.stringify(all));
  return getPersonaLayout(personaId);
}
