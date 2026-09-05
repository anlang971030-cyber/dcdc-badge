import { getPersonaLayout } from './persona-layouts.js';

export const PERSONA_VARIANTS = {
  architect: { variants: ['./assets/personas/architect.png'] },
  explorer: { variants: ['./assets/personas/explorer.png'] },
  connector: { variants: ['./assets/personas/connector.png'] },
  analyst: { variants: ['./assets/personas/analyst.png'] },
  maker: { variants: ['./assets/personas/maker.png'] },
  catalyst: { variants: ['./assets/personas/catalyst.png'] }
};

export function hash32(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

export function unit(seed, salt) {
  return hash32(`${seed}|${salt}`) / 4294967296;
}

export function seedFor(profile, personaId) {
  return hash32([profile.name, profile.role, profile.group, personaId].join('|'));
}

export function createPersonaSelection(profile, personaId, layoutOverride = null) {
  const variants = PERSONA_VARIANTS[personaId]?.variants;
  const layout = getPersonaLayout(personaId, layoutOverride);
  if (!variants || !layout) throw new Error(`缺少人格视觉配置：${personaId}`);
  const seed = seedFor(profile, personaId);
  return {
    seed,
    image: variants[Math.floor(unit(seed, 'variant') * variants.length)],
    backgroundLayout: Number.isInteger(layout.background.layout)
      ? layout.background.layout
      : Math.floor(unit(seed, 'background-layout') * 3),
    scale: layout.persona.scale,
    xOffset: layout.persona.xOffset,
    yOffset: layout.persona.yOffset,
    rotation: layout.persona.rotation,
    layout
  };
}
