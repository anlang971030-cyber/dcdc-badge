import { ARCHETYPES } from './archetypes.js';

export const DIMENSIONS = ['structure', 'focus', 'connection', 'drive'];
export const INITIAL_SCORES = { structure: 0.5, focus: 0.5, connection: 0.5, drive: 0.5 };

// Q3-B 与 Q6-B 的连接度由原始 0.30 / 0.15 最小校正为 0.22 / 0.08。
// 原始权重枚举 64 种答案时无法得到 EXPLORER；校正后六类均可成为主人格。
export const SCORE_EFFECTS = {
  q1: { A: { structure: 0.25, focus: 0.1 }, B: { structure: -0.2, drive: 0.15 } },
  q2: { A: { focus: 0.25, structure: 0.05 }, B: { focus: -0.15, drive: 0.1 } },
  q3: { A: { focus: 0.1, structure: 0.1, connection: -0.15 }, B: { connection: 0.22 } },
  q4: { A: { structure: 0.2, drive: -0.1 }, B: { drive: 0.3, structure: -0.1 } },
  q5: { A: { focus: 0.2, structure: 0.15 }, B: { drive: 0.25, focus: -0.05 } },
  q6: { A: { structure: 0.2, focus: 0.1 }, B: { drive: 0.2, connection: 0.08 } }
};

const clamp = value => Math.max(0, Math.min(1, value));

export function calculateScores(answers) {
  const scores = { ...INITIAL_SCORES };
  Object.entries(answers).forEach(([questionId, answerId]) => {
    const effects = SCORE_EFFECTS[questionId]?.[answerId] || {};
    Object.entries(effects).forEach(([dimension, change]) => {
      scores[dimension] += change;
    });
  });
  DIMENSIONS.forEach(dimension => { scores[dimension] = clamp(scores[dimension]); });
  return scores;
}

export function rankArchetypes(scores) {
  return ARCHETYPES.map(archetype => {
    const squaredDistance = DIMENSIONS.reduce((sum, dimension) => {
      const delta = scores[dimension] - archetype.center[dimension];
      return sum + delta * delta;
    }, 0);
    return { archetype, distance: Math.sqrt(squaredDistance) };
  }).sort((a, b) => a.distance - b.distance);
}

export function scorePersonality(answers) {
  const scores = calculateScores(answers);
  const ranking = rankArchetypes(scores);
  return { scores, primary: ranking[0].archetype, secondary: ranking[1].archetype, ranking };
}
