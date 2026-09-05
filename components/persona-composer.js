import { MAX_INTERESTS, resolveInterestAssetPath, sanitizeInterests } from '../interests/interest-assets.js?v=20260905-4';
import { createPersonaSelection, hash32 } from '../personality/persona-variants.js';
import { INTEREST_SLOT_NAMES } from '../personality/persona-layouts.js';

export const PERSONA_AREA = { x: 970, y: 46, width: 1030, height: 854 };

function unit(seed, salt) { return hash32(`${seed}|${salt}`) / 4294967296; }
function signed(seed, salt) { return unit(seed, salt) * 2 - 1; }

export function getInterestAssetPath({ profile, personaId, interestId, slotName }) {
  return resolveInterestAssetPath(personaId, interestId);
}

export function getPersonaComposition({ profile, personaId, interests = [], layoutOverride = null }) {
  const selection = createPersonaSelection(profile, personaId, layoutOverride);
  const placements = sanitizeInterests(interests).slice(0, MAX_INTERESTS).map((interestId, index) => {
    const slotName = INTEREST_SLOT_NAMES[index];
    const slot = selection.layout.interestSlots[slotName];
    const seed = hash32([profile.name, profile.role, profile.group, personaId, interestId, slotName].join('|'));
    return {
      interestId,
      slotName,
      path: getInterestAssetPath({ profile, personaId, interestId, slotName }),
      x: slot.x + signed(seed, 'x') * (6 / PERSONA_AREA.width) * 100,
      y: slot.y + signed(seed, 'y') * (6 / PERSONA_AREA.height) * 100,
      w: slot.w * (0.96 + unit(seed, 'scale') * 0.08),
      rotate: (slot.rotate || 0) + signed(seed, 'rotate') * 4
    };
  });
  return { selection, placements };
}

export function renderPersonaComposer({ profile, persona, interests = [] }) {
  const { selection, placements } = getPersonaComposition({ profile, personaId: persona.id, interests });
  const accents = placements.map(item => `<span class="persona-interest" aria-hidden="true" style="left:${item.x}%;top:${item.y}%;width:${item.w}%;transform:translate(-50%,-50%) rotate(${item.rotate}deg)"><img src="${item.path}" alt=""></span>`).join('');
  return `<div class="persona-stage persona-composer"><span class="persona-glow" aria-hidden="true"></span><img class="persona-character" src="${selection.image}" alt="${persona.nameZh} ${persona.nameEn} 人格角色">${accents}</div>`;
}
