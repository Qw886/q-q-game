import { NORMAL_TILE_TYPES } from '../config/TileTypeConfig';
import { BoardState } from './BoardState';
import { LinkPathFinder } from './LinkPathFinder';
import { SeededRandom } from './SeededRandom';
import { TileAssignmentOptimizer } from './TileAssignmentOptimizer';
import type { SkeletonPair } from './TileAssignmentOptimizer';
import type {
  BoardTile,
  DifficultyConfig,
  GeneratedBoard,
  SolutionStep,
  TileData,
} from './GameTypes';

export const BOARD_GENERATION_CONFIG = {
  tileTypeCount: 20,
  copiesPerType: 4,
  pairsPerType: 2,
} as const;

const FIXED_SOLVABLE_SKELETON: readonly SkeletonPair[] = [
  { first: { row: 1, column: 7 }, second: { row: 9, column: 7 } },
  { first: { row: 8, column: 7 }, second: { row: 9, column: 6 } },
  { first: { row: 8, column: 6 }, second: { row: 9, column: 5 } },
  { first: { row: 7, column: 6 }, second: { row: 8, column: 5 } },
  { first: { row: 6, column: 6 }, second: { row: 7, column: 5 } },
  { first: { row: 5, column: 6 }, second: { row: 8, column: 4 } },
  { first: { row: 4, column: 6 }, second: { row: 7, column: 4 } },
  { first: { row: 3, column: 6 }, second: { row: 4, column: 5 } },
  { first: { row: 6, column: 4 }, second: { row: 8, column: 3 } },
  { first: { row: 7, column: 3 }, second: { row: 8, column: 2 } },
  { first: { row: 2, column: 6 }, second: { row: 5, column: 5 } },
  { first: { row: 5, column: 4 }, second: { row: 6, column: 3 } },
  { first: { row: 5, column: 3 }, second: { row: 7, column: 2 } },
  { first: { row: 4, column: 3 }, second: { row: 7, column: 1 } },
  { first: { row: 3, column: 3 }, second: { row: 4, column: 4 } },
  { first: { row: 3, column: 4 }, second: { row: 6, column: 5 } },
  { first: { row: 2, column: 4 }, second: { row: 5, column: 2 } },
  { first: { row: 1, column: 6 }, second: { row: 3, column: 5 } },
  { first: { row: 6, column: 2 }, second: { row: 8, column: 1 } },
  { first: { row: 2, column: 5 }, second: { row: 6, column: 1 } },
  { first: { row: 1, column: 5 }, second: { row: 5, column: 1 } },
  { first: { row: 1, column: 4 }, second: { row: 4, column: 2 } },
  { first: { row: 2, column: 3 }, second: { row: 4, column: 1 } },
  { first: { row: 1, column: 3 }, second: { row: 3, column: 2 } },
  { first: { row: 2, column: 2 }, second: { row: 3, column: 1 } },
  { first: { row: 1, column: 2 }, second: { row: 2, column: 1 } },
  { first: { row: 0, column: 4 }, second: { row: 2, column: 0 } },
  { first: { row: 4, column: 7 }, second: { row: 9, column: 1 } },
  { first: { row: 0, column: 5 }, second: { row: 5, column: 7 } },
  { first: { row: 5, column: 0 }, second: { row: 9, column: 4 } },
  { first: { row: 0, column: 3 }, second: { row: 3, column: 7 } },
  { first: { row: 0, column: 6 }, second: { row: 7, column: 7 } },
  { first: { row: 0, column: 2 }, second: { row: 7, column: 0 } },
  { first: { row: 4, column: 0 }, second: { row: 9, column: 3 } },
  { first: { row: 1, column: 1 }, second: { row: 6, column: 7 } },
  { first: { row: 3, column: 0 }, second: { row: 9, column: 2 } },
  { first: { row: 0, column: 1 }, second: { row: 1, column: 0 } },
  { first: { row: 2, column: 7 }, second: { row: 9, column: 0 } },
  { first: { row: 0, column: 7 }, second: { row: 8, column: 0 } },
  { first: { row: 0, column: 0 }, second: { row: 6, column: 0 } },
];

export class BoardGenerator {
  private readonly pathFinder = new LinkPathFinder();
  private readonly assignmentOptimizer = new TileAssignmentOptimizer();

  public generate(config: DifficultyConfig, seed: number = Date.now()): GeneratedBoard {
    this.validateConfig(config);
    const startedAt = Date.now();
    const skeletonStartedAt = Date.now();
    const skeleton = this.createFixedSkeleton();
    const skeletonElapsedMilliseconds = Date.now() - skeletonStartedAt;
    const random = new SeededRandom(seed >>> 0);
    const optimized = this.assignmentOptimizer.optimize(config, skeleton, random);
    const validationPassed = this.validateSolution(optimized.board, optimized.solution);

    return {
      board: optimized.board,
      seed: seed >>> 0,
      tiles: this.toTileData(config, optimized.board.getAllTiles()),
      solution: optimized.solution,
      generationAttempts: 1,
      validationPassed,
      generationStrategy: 'FIXED',
      searchNodes: 0,
      backtrackCount: 0,
      restartCount: 0,
      difficultyMetrics: optimized.difficultyMetrics,
      difficultySelectionAttempts: 1,
      generationElapsedMilliseconds: Date.now() - startedAt,
      skeletonElapsedMilliseconds,
      assignmentOptimizationElapsedMilliseconds: optimized.elapsedMilliseconds,
      optimizationIterations: optimized.optimizationIterations,
    };
  }

  public validateSolution(board: BoardState, solution: readonly SolutionStep[]): boolean {
    const clone = board.clone();

    for (const step of solution) {
      const firstType = clone.getTileType(step.first);
      const secondType = clone.getTileType(step.second);

      if (firstType !== step.tileType || secondType !== step.tileType) {
        return false;
      }

      const path = this.pathFinder.findPath(clone, step.first, step.second);

      if (!path.connected) {
        return false;
      }

      clone.removeTiles(step.first, step.second);
    }

    return clone.getRemainingCount() === 0;
  }

  private createFixedSkeleton(): readonly SkeletonPair[] {
    return FIXED_SOLVABLE_SKELETON;
  }

  private toTileData(config: DifficultyConfig, tiles: readonly BoardTile[]): TileData[] {
    return tiles
      .map((tile) => ({
        id: tile.position.row * config.columns + tile.position.column,
        label: tile.type,
        type: tile.type,
        row: tile.position.row,
        column: tile.position.column,
      }))
      .sort((first, second) => first.id - second.id);
  }

  private validateConfig(config: DifficultyConfig): void {
    const expectedCount = BOARD_GENERATION_CONFIG.tileTypeCount * BOARD_GENERATION_CONFIG.copiesPerType;

    if (config.tileCount !== expectedCount || config.rows * config.columns !== expectedCount) {
      throw new Error('Stage 4 generator currently supports the normal 80-tile board only.');
    }

    if (NORMAL_TILE_TYPES.length !== BOARD_GENERATION_CONFIG.tileTypeCount) {
      throw new Error('Normal tile type count does not match board generation config.');
    }
  }
}
