import type { DifficultyId } from '../core/GameTypes';

export const NORMAL_TILE_TYPES = [
  'WAN_1',
  'WAN_2',
  'WAN_3',
  'WAN_4',
  'WAN_5',
  'DOT_1',
  'DOT_2',
  'DOT_3',
  'DOT_4',
  'DOT_5',
  'BAM_1',
  'BAM_2',
  'BAM_3',
  'BAM_4',
  'BAM_5',
  'EAST',
  'SOUTH',
  'WEST',
  'NORTH',
  'RED',
] as const;

export type ConfiguredTileType = typeof NORMAL_TILE_TYPES[number];

export const TILE_TYPE_COUNTS_BY_DIFFICULTY: Readonly<Record<DifficultyId, Readonly<Record<string, number>>>> = {
  normal: createUniformTileCounts(4),
  medium: createUniformTileCounts(6),
  hard: {
    WAN_1: 10,
    WAN_2: 10,
    WAN_3: 10,
    WAN_4: 10,
    WAN_5: 10,
    DOT_1: 10,
    DOT_2: 10,
    DOT_3: 10,
    DOT_4: 10,
    DOT_5: 10,
    BAM_1: 10,
    BAM_2: 10,
    BAM_3: 10,
    BAM_4: 10,
    BAM_5: 10,
    RED: 10,
    EAST: 8,
    SOUTH: 8,
    WEST: 8,
    NORTH: 8,
  },
};

export function getTileTypeCounts(difficultyId: DifficultyId): Readonly<Record<string, number>> {
  return TILE_TYPE_COUNTS_BY_DIFFICULTY[difficultyId];
}

function createUniformTileCounts(count: number): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};

  for (const tileType of NORMAL_TILE_TYPES) {
    result[tileType] = count;
  }

  return result;
}
