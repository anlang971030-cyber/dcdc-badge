export const ARCHETYPES = [
  {
    id: 'architect',
    nameZh: '构筑者',
    nameEn: 'ARCHITECT',
    description: '用结构思维，把复杂问题搭成清晰答案。',
    center: { structure: 0.9, focus: 0.7, connection: 0.45, drive: 0.45 },
    image: './assets/personas/architect.png'
  },
  {
    id: 'explorer',
    nameZh: '探索者',
    nameEn: 'EXPLORER',
    description: '总能比别人先一步，看见新的路径。',
    center: { structure: 0.25, focus: 0.4, connection: 0.45, drive: 0.7 },
    image: './assets/personas/explorer.png'
  },
  {
    id: 'connector',
    nameZh: '连接者',
    nameEn: 'CONNECTOR',
    description: '擅长让人、信息与创意彼此接通。',
    center: { structure: 0.55, focus: 0.45, connection: 0.95, drive: 0.6 },
    image: './assets/personas/connector.png'
  },
  {
    id: 'analyst',
    nameZh: '洞察者',
    nameEn: 'ANALYST',
    description: '能在复杂线索里，迅速看到真正的关键。',
    center: { structure: 0.85, focus: 0.95, connection: 0.25, drive: 0.35 },
    image: './assets/personas/analyst.png'
  },
  {
    id: 'maker',
    nameZh: '创造者',
    nameEn: 'MAKER',
    description: '灵感不是空想，而是边做边把它变成现实。',
    center: { structure: 0.5, focus: 0.55, connection: 0.35, drive: 0.8 },
    image: './assets/personas/maker.png'
  },
  {
    id: 'catalyst',
    nameZh: '激发者',
    nameEn: 'CATALYST',
    description: '总能点亮团队气氛，把想法推向行动。',
    center: { structure: 0.35, focus: 0.35, connection: 0.75, drive: 0.95 },
    image: './assets/personas/catalyst.png'
  }
];

export const ARCHETYPE_BY_ID = Object.fromEntries(ARCHETYPES.map(item => [item.id, item]));
