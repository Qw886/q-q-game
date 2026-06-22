import type { DifficultyId } from '../core/GameTypes';

export interface BoardDifficultyConfig {
  readonly minOpeningMoves: number;
  readonly maxOpeningMoves: number;
  readonly maxFallbackOpeningMoves: number;
  readonly targetOpeningMoves: number;
  readonly targetZeroTurnMoves: number;
  readonly targetOneTurnMoves: number;
  readonly targetTwoTurnMoves: number;
  readonly maxAdjacentMatchingMoves: number;
  readonly minZeroTurnMoves: number;
  readonly maxZeroTurnMoves: number;
  readonly minOneTurnMoves: number;
  readonly maxOneTurnMoves: number;
  readonly minTwoTurnMoves: number;
  readonly maxTwoTurnMoves: number;
  readonly maxSingleTurnTypeRatio: number;
  readonly maxFirstTenAverageMoves: number;
  readonly maxDifficultySelectionAttempts: number;
  readonly maxTileAssignmentAttemptsPerSkeleton: number;
  readonly maxSingleSeedDebugMilliseconds: number;
  readonly maxOptimizationIterations: number;
  readonly maxOptimizationMilliseconds: number;
  readonly randomWorseAssignmentAcceptRate: number;
  readonly openingMoveWeight: number;
  readonly outOfRangeMoveWeight: number;
  readonly adjacentMoveWeight: number;
  readonly turnDistributionWeight: number;
  readonly missingEasyMoveWeight: number;
  readonly singleTurnTypeRatioWeight: number;
  readonly missingTwoTurnWeight: number;
  readonly firstTenAverageWeight: number;
  readonly edgeMoveWeight: number;
}

const COMMON_WEIGHTS = {
  maxFallbackOpeningMoves: 18,
  maxFirstTenAverageMoves: 16,
  maxDifficultySelectionAttempts: 1,
  maxTileAssignmentAttemptsPerSkeleton: 1,
  maxSingleSeedDebugMilliseconds: 2000,
  randomWorseAssignmentAcceptRate: 0.025,
  openingMoveWeight: 8,
  outOfRangeMoveWeight: 18,
  adjacentMoveWeight: 16,
  turnDistributionWeight: 18,
  missingEasyMoveWeight: 55,
  singleTurnTypeRatioWeight: 70,
  missingTwoTurnWeight: 40,
  firstTenAverageWeight: 6,
  edgeMoveWeight: 1,
} as const;

export const BOARD_DIFFICULTY_CONFIGS: Readonly<Record<DifficultyId, BoardDifficultyConfig>> = {
  normal: {
    ...COMMON_WEIGHTS,
    minOpeningMoves: 6,
    maxOpeningMoves: 10,
    targetOpeningMoves: 8,
    targetZeroTurnMoves: 2,
    targetOneTurnMoves: 0,
    targetTwoTurnMoves: 4,
    maxAdjacentMatchingMoves: 2,
    minZeroTurnMoves: 1,
    maxZeroTurnMoves: 3,
    minOneTurnMoves: 0,
    maxOneTurnMoves: 4,
    minTwoTurnMoves: 2,
    maxTwoTurnMoves: 7,
    maxSingleTurnTypeRatio: 0.8,
    maxOptimizationIterations: 220,
    maxOptimizationMilliseconds: 700,
  },
  medium: {
    ...COMMON_WEIGHTS,
    minOpeningMoves: 5,
    maxOpeningMoves: 8,
    targetOpeningMoves: 6,
    targetZeroTurnMoves: 1,
    targetOneTurnMoves: 0,
    targetTwoTurnMoves: 5,
    maxAdjacentMatchingMoves: 1,
    minZeroTurnMoves: 1,
    maxZeroTurnMoves: 2,
    minOneTurnMoves: 0,
    maxOneTurnMoves: 3,
    minTwoTurnMoves: 3,
    maxTwoTurnMoves: 7,
    maxSingleTurnTypeRatio: 0.85,
    maxOptimizationIterations: 260,
    maxOptimizationMilliseconds: 900,
  },
  hard: {
    ...COMMON_WEIGHTS,
    minOpeningMoves: 3,
    maxOpeningMoves: 6,
    targetOpeningMoves: 4,
    targetZeroTurnMoves: 1,
    targetOneTurnMoves: 0,
    targetTwoTurnMoves: 4,
    maxAdjacentMatchingMoves: 1,
    minZeroTurnMoves: 0,
    maxZeroTurnMoves: 1,
    minOneTurnMoves: 0,
    maxOneTurnMoves: 2,
    minTwoTurnMoves: 3,
    maxTwoTurnMoves: 7,
    maxSingleTurnTypeRatio: 1,
    maxOptimizationIterations: 320,
    maxOptimizationMilliseconds: 1200,
  },
};

export const NORMAL_BOARD_DIFFICULTY_CONFIG = BOARD_DIFFICULTY_CONFIGS.normal;

export function getBoardDifficultyConfig(difficultyId: DifficultyId): BoardDifficultyConfig {
  return BOARD_DIFFICULTY_CONFIGS[difficultyId];
}
