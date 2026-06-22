import { getTileTypeCounts } from '../config/TileTypeConfig';
import { BoardState } from './BoardState';
import { LinkPathFinder } from './LinkPathFinder';
import { SeededRandom } from './SeededRandom';
import { TileAssignmentOptimizer } from './TileAssignmentOptimizer';
import type { SkeletonPair } from './TileAssignmentOptimizer';
import type { BoardTile, DifficultyConfig, DifficultyId, GeneratedBoard, SolutionStep, TileData } from './GameTypes';

type RawSkeletonPair = readonly [readonly [number, number], readonly [number, number]];

const FIXED_SKELETONS: Readonly<Record<DifficultyId, readonly RawSkeletonPair[]>> = {
  normal: [[[0,0],[9,0]],[[0,1],[8,0]],[[0,2],[9,1]],[[0,3],[7,0]],[[0,4],[8,1]],[[0,5],[9,2]],[[0,6],[6,0]],[[0,7],[7,1]],[[1,0],[9,3]],[[1,1],[9,4]],[[2,0],[9,5]],[[1,2],[9,6]],[[2,1],[9,7]],[[5,0],[8,7]],[[4,0],[7,7]],[[3,0],[8,6]],[[1,7],[8,5]],[[1,6],[8,4]],[[2,7],[8,3]],[[1,5],[8,2]],[[1,4],[6,7]],[[1,3],[7,6]],[[5,7],[6,1]],[[4,7],[7,2]],[[3,7],[5,1]],[[4,1],[6,6]],[[3,1],[7,5]],[[2,6],[7,4]],[[2,5],[7,3]],[[2,2],[3,6]],[[2,3],[4,6]],[[2,4],[6,2]],[[3,2],[5,6]],[[3,5],[4,2]],[[3,4],[5,2]],[[3,3],[6,5]],[[4,5],[6,4]],[[4,3],[5,5]],[[4,4],[6,3]],[[5,3],[5,4]]],
  medium: [[[0,0],[11,0]],[[0,1],[10,0]],[[0,2],[11,1]],[[0,3],[9,0]],[[0,4],[10,1]],[[0,5],[11,2]],[[0,6],[8,0]],[[0,7],[9,1]],[[0,8],[10,2]],[[0,9],[11,3]],[[1,0],[11,4]],[[1,1],[11,5]],[[2,0],[11,6]],[[1,2],[11,7]],[[2,1],[11,8]],[[3,0],[11,9]],[[1,9],[4,0]],[[1,8],[5,0]],[[2,9],[6,0]],[[1,7],[7,0]],[[1,6],[10,9]],[[1,5],[9,9]],[[1,4],[10,8]],[[1,3],[8,9]],[[2,2],[10,3]],[[3,1],[10,4]],[[2,3],[10,5]],[[3,2],[10,6]],[[4,1],[10,7]],[[2,8],[5,1]],[[3,9],[6,1]],[[2,7],[7,1]],[[3,8],[8,1]],[[2,4],[9,2]],[[2,5],[8,2]],[[2,6],[9,3]],[[7,2],[9,8]],[[6,2],[7,9]],[[5,2],[8,8]],[[4,2],[9,7]],[[4,9],[9,6]],[[3,3],[5,9]],[[3,4],[6,9]],[[3,7],[9,5]],[[4,8],[9,4]],[[3,5],[8,3]],[[3,6],[7,3]],[[4,3],[5,8]],[[4,4],[6,8]],[[5,3],[7,8]],[[4,7],[6,3]],[[4,5],[8,4]],[[4,6],[7,4]],[[6,4],[8,7]],[[5,4],[7,7]],[[5,7],[8,6]],[[5,6],[8,5]],[[5,5],[7,6]],[[6,5],[6,7]],[[6,6],[7,5]]],
  hard: [[[0,0],[15,0]],[[0,1],[14,0]],[[0,2],[15,1]],[[0,3],[13,0]],[[0,4],[14,1]],[[0,5],[15,2]],[[0,6],[12,0]],[[0,7],[13,1]],[[0,8],[14,2]],[[0,9],[15,3]],[[0,10],[11,0]],[[0,11],[12,1]],[[1,0],[15,4]],[[1,1],[15,5]],[[2,0],[15,6]],[[1,2],[15,7]],[[2,1],[15,8]],[[3,0],[15,9]],[[1,3],[15,10]],[[2,2],[15,11]],[[10,0],[14,11]],[[9,0],[13,11]],[[8,0],[14,10]],[[7,0],[12,11]],[[6,0],[13,10]],[[5,0],[14,9]],[[4,0],[11,11]],[[1,11],[14,8]],[[1,10],[14,7]],[[2,11],[14,6]],[[1,9],[14,5]],[[2,10],[14,4]],[[3,11],[14,3]],[[1,4],[13,2]],[[1,5],[11,1]],[[1,6],[12,2]],[[1,7],[13,3]],[[1,8],[10,1]],[[3,1],[13,4]],[[2,3],[13,5]],[[3,2],[13,6]],[[4,1],[13,7]],[[2,4],[13,8]],[[3,3],[13,9]],[[2,5],[11,2]],[[2,6],[12,3]],[[2,7],[9,1]],[[2,8],[10,2]],[[2,9],[11,3]],[[8,1],[12,10]],[[7,1],[10,11]],[[6,1],[11,10]],[[5,1],[12,9]],[[3,10],[12,8]],[[4,11],[12,7]],[[3,9],[12,6]],[[4,10],[12,5]],[[5,11],[12,4]],[[4,2],[6,11]],[[3,4],[7,11]],[[4,3],[8,11]],[[5,2],[9,11]],[[3,5],[9,2]],[[3,6],[10,3]],[[3,7],[11,4]],[[3,8],[8,2]],[[7,2],[10,10]],[[6,2],[11,9]],[[4,4],[11,5]],[[5,3],[11,6]],[[4,5],[11,7]],[[5,4],[11,8]],[[4,6],[9,3]],[[4,7],[10,4]],[[4,8],[8,3]],[[4,9],[9,4]],[[7,3],[9,10]],[[6,3],[10,9]],[[5,10],[6,4]],[[5,9],[7,4]],[[6,10],[8,4]],[[5,5],[7,10]],[[5,6],[8,10]],[[5,7],[10,5]],[[5,8],[9,5]],[[6,5],[10,6]],[[6,6],[10,7]],[[7,5],[10,8]],[[6,9],[8,5]],[[6,7],[9,6]],[[6,8],[8,6]],[[7,6],[9,9]],[[7,9],[9,8]],[[7,7],[8,9]],[[7,8],[9,7]],[[8,7],[8,8]]],
};

export class BoardGenerator {
  private readonly pathFinder = new LinkPathFinder();
  private readonly assignmentOptimizer = new TileAssignmentOptimizer();

  public generate(config: DifficultyConfig, seed: number = Date.now()): GeneratedBoard {
    this.validateConfig(config);
    const startedAt = Date.now();
    const skeletonStartedAt = Date.now();
    const skeleton = this.createFixedSkeleton(config);
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

  private createFixedSkeleton(config: DifficultyConfig): readonly SkeletonPair[] {
    const rawSkeleton = FIXED_SKELETONS[config.id];
    const pairs = rawSkeleton.map(([first, second]) => ({
      first: { row: first[0], column: first[1] },
      second: { row: second[0], column: second[1] },
    }));

    if (pairs.length !== config.tileCount / 2) {
      throw new Error(`Skeleton pair count ${pairs.length} does not match tile count ${config.tileCount}.`);
    }

    return pairs;
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
    if (config.tileCount % 2 !== 0) {
      throw new Error(`Tile count must be even for difficulty: ${config.id}`);
    }

    if (config.rows * config.columns !== config.tileCount) {
      throw new Error(`Board size does not match tile count for difficulty: ${config.id}`);
    }

    const counts = getTileTypeCounts(config.id);
    let totalCount = 0;

    for (const [tileType, count] of Object.entries(counts)) {
      if (count <= 0 || count % 2 !== 0) {
        throw new Error(`Tile type ${tileType} must have a positive even count.`);
      }

      totalCount += count;
    }

    if (totalCount !== config.tileCount) {
      throw new Error(`Tile type total ${totalCount} does not match tile count ${config.tileCount}.`);
    }
  }
}
