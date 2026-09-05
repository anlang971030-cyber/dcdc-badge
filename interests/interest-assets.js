export const MAX_INTERESTS = 4;
export const RECOMMENDED_INTERESTS = 3;
export const INTEREST_PERSONA_IDS = ['architect', 'explorer', 'connector', 'analyst', 'maker', 'catalyst'];

export const INTEREST_ASSETS = [
  asset('reading', '阅读'),
  asset('fitness', '健身'),
  asset('pet', '宠物'),
  asset('music', '音乐'),
  asset('drink', '咖啡 / 奶茶'),
  asset('travel', '旅行'),
  asset('plant', '植物'),
  asset('photography', '摄影'),
  asset('gaming', '游戏'),
  asset('coding', '编程'),
  asset('craft', '手工')
];

function asset(id, name) {
  return {
    id,
    name,
    personaPaths: Object.fromEntries(INTEREST_PERSONA_IDS.map(personaId => [
      personaId,
      `./assets/interests/personas/${personaId}/${id}.png`
    ]))
  };
}

export const INTEREST_BY_ID = Object.fromEntries(INTEREST_ASSETS.map(item => [item.id, item]));

export function resolveInterestAssetPath(personaId, interestId) {
  return INTEREST_BY_ID[interestId]?.personaPaths?.[personaId] || '';
}

export function sanitizeInterests(ids = []) {
  const unique = [];
  for (const id of ids) {
    if (!INTEREST_BY_ID[id] || unique.includes(id)) continue;
    unique.push(id);
    if (unique.length === MAX_INTERESTS) break;
  }
  return unique;
}

export function toggleInterestSelection(current = [], interestId) {
  const next = sanitizeInterests(current);
  const index = next.indexOf(interestId);
  if (index >= 0) {
    next.splice(index, 1);
    return next;
  }
  if (!INTEREST_BY_ID[interestId] || next.length >= MAX_INTERESTS) return next;
  return [...next, interestId];
}
