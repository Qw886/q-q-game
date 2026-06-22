export const SCORE_CONFIG = {
  pairBaseScore: 100,
  remainingSecondBonus: 10,
} as const;

export function calculatePairScore(remainingSeconds: number, scoreMultiplier: number): number {
  const baseScore = SCORE_CONFIG.pairBaseScore + remainingSeconds * SCORE_CONFIG.remainingSecondBonus;

  return Math.round(baseScore * scoreMultiplier);
}
