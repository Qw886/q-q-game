import type { BoardState } from './BoardState';

export type DifficultyId = 'normal' | 'medium' | 'hard';

export interface DifficultyConfig {
  readonly id: DifficultyId;
  readonly name: string;
  readonly rows: number;
  readonly columns: number;
  readonly tileCount: number;
  readonly roundTime: number;
  readonly scoreMultiplier: number;
}

export interface TileData {
  readonly id: number;
  readonly label: string;
  readonly type: string;
  readonly row: number;
  readonly column: number;
}

export interface GridPoint {
  readonly row: number;
  readonly column: number;
}

export interface BoardTile {
  readonly position: GridPoint;
  readonly type: string;
}

export interface PathResult {
  readonly connected: boolean;
  readonly turns: number;
  readonly points: readonly GridPoint[];
  readonly failureReason?: string;
}

export type GameEndReason = 'win' | 'timeout' | 'deadlock';

export interface GameSnapshot {
  readonly modeName: string;
  readonly remainingTiles: number;
  readonly score: number;
  readonly remainingSeconds: number;
  readonly status: GameStatus;
}

export type GameStatus = 'running' | 'won' | 'lost';

export interface SolutionStep {
  readonly first: GridPoint;
  readonly second: GridPoint;
  readonly tileType: string;
}

export interface LegalMove {
  readonly first: GridPoint;
  readonly second: GridPoint;
  readonly tileType: string;
  readonly path: PathResult;
}

export interface GeneratedBoard {
  readonly board: BoardState;
  readonly seed: number;
  readonly tiles: readonly TileData[];
  readonly solution: readonly SolutionStep[];
  readonly generationAttempts: number;
  readonly validationPassed: boolean;
  readonly generationStrategy: 'BACKTRACKING' | 'FALLBACK' | 'FIXED' | 'LAYERED';
  readonly searchNodes: number;
  readonly backtrackCount: number;
  readonly restartCount: number;
  readonly difficultyMetrics: BoardDifficultyMetrics;
  readonly difficultySelectionAttempts: number;
  readonly generationElapsedMilliseconds: number;
  readonly skeletonElapsedMilliseconds: number;
  readonly assignmentOptimizationElapsedMilliseconds: number;
  readonly optimizationIterations: number;
}

export interface BoardDifficultyMetrics {
  readonly totalLegalMoves: number;
  readonly zeroTurnMoves: number;
  readonly oneTurnMoves: number;
  readonly twoTurnMoves: number;
  readonly adjacentMatchingMoves: number;
  readonly edgeLegalMoves: number;
  readonly firstTenStepsAverageMoves: number;
  readonly score: number;
  readonly accepted: boolean;
  readonly rejectionReasons: readonly string[];
}

export type TileClickResult =
  | {
      readonly kind: 'ignored';
      readonly reason: string;
    }
  | {
      readonly kind: 'selected';
      readonly point: GridPoint;
    }
  | {
      readonly kind: 'deselected';
      readonly point: GridPoint;
    }
  | {
      readonly kind: 'typeMismatch';
      readonly previous: GridPoint;
      readonly selected: GridPoint;
    }
  | {
      readonly kind: 'blocked';
      readonly previous: GridPoint;
      readonly selected: GridPoint;
      readonly reason: string;
    }
  | {
      readonly kind: 'connected';
      readonly first: GridPoint;
      readonly second: GridPoint;
      readonly path: PathResult;
    };
