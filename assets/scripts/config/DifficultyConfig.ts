import { DifficultyConfig, DifficultyId } from '../core/GameTypes';

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: 'normal',
    name: '普通',
    rows: 10,
    columns: 8,
    tileCount: 80,
    roundTime: 20,
  },
  {
    id: 'medium',
    name: '中等',
    rows: 12,
    columns: 10,
    tileCount: 120,
    roundTime: 14,
  },
  {
    id: 'hard',
    name: '困难',
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

