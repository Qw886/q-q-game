import type { DifficultyConfig, DifficultyId } from '../core/GameTypes';

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: 'normal',
    name: '\u666e\u901a',
    rows: 10,
    columns: 8,
    tileCount: 80,
    roundTime: 20,
  },
  {
    id: 'medium',
    name: '\u4e2d\u7b49',
    rows: 12,
    columns: 10,
    tileCount: 120,
    roundTime: 14,
  },
  {
    id: 'hard',
    name: '\u56f0\u96be',
    rows: 16,
    columns: 12,
    tileCount: 192,
    roundTime: 9,
  },
];

export function getDifficultyConfig(id: DifficultyId): DifficultyConfig {
  const config = DIFFICULTIES.find((item) => item.id === id);

  if (!config) {
    throw new Error(`Unknown difficulty: ${id}`);
  }

  return config;
}

export const NORMAL_DIFFICULTY = getDifficultyConfig('normal');
