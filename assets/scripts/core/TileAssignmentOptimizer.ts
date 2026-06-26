import { getBoardDifficultyConfig } from '../config/BoardDifficultyConfig';
import { getTileTypeCounts } from '../config/TileTypeConfig';
import { BoardDifficultyEvaluator } from './BoardDifficultyEvaluator';
import { BoardState } from './BoardState';
import { LinkPathFinder } from './LinkPathFinder';
import { SeededRandom } from './SeededRandom';
import type { BoardDifficultyMetrics, BoardTile, DifficultyConfig, GridPoint, SolutionStep } from './GameTypes';

const CONFLICT_TILE_TYPE = '__conflict__';

export interface SkeletonPair {
  readonly first: GridPoint;
  readonly second: GridPoint;
}

export interface TileAssignmentOptimizationResult {
  readonly tileTypes: readonly string[];
  readonly solution: readonly SolutionStep[];
  readonly board: BoardState;
  readonly difficultyMetrics: BoardDifficultyMetrics;
  readonly optimizationScore: number;
  readonly optimizationIterations: number;
  readonly conflictBuildMilliseconds: number;
  readonly elapsedMilliseconds: number;
}

export class TileAssignmentOptimizer {
  private readonly evaluator = new BoardDifficultyEvaluator();
  private readonly pathFinder = new LinkPathFinder();

  public optimize(
    config: DifficultyConfig,
    skeletonPairs: readonly SkeletonPair[],
    random: SeededRandom,
  ): TileAssignmentOptimizationResult {
    const startedAt = Date.now();
    const conflictStartedAt = Date.now();
    const conflictGraph = this.buildConflictGraph(config, skeletonPairs);
    const conflictBuildMilliseconds = Date.now() - conflictStartedAt;
    const maxAttempts = this.getMaxAssignmentAttempts(config);
    let best: TileAssignmentOptimizationResult | null = null;

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      const tileTypes = this.createConflictAwareAssignment(config, skeletonPairs, conflictGraph, random);
      const candidate = this.createResult(config, skeletonPairs, tileTypes, attemptIndex + 1, startedAt);

      if (!best || candidate.optimizationScore < best.optimizationScore) {
        best = candidate;
      }

      // accepted 只代表开局密度和相邻数量合格；边缘连续剥离由 BoardGenerator 统一验收。
      // 这里继续跑完有限次数，给同侧外围冲突更多机会被更好的类型分配压低。
    }

    if (!best) {
      throw new Error(`Failed to assign tile types for difficulty: ${config.id}`);
    }

    return {
      ...best,
      conflictBuildMilliseconds,
      elapsedMilliseconds: Date.now() - startedAt,
    };
  }

  private buildConflictGraph(config: DifficultyConfig, skeletonPairs: readonly SkeletonPair[]): ConflictGraph {
    const board = new BoardState(
      config.rows,
      config.columns,
      skeletonPairs.flatMap((pair) => [
        { position: pair.first, type: CONFLICT_TILE_TYPE },
        { position: pair.second, type: CONFLICT_TILE_TYPE },
      ]),
    );
    const graph: number[][] = Array.from({ length: skeletonPairs.length }, () => Array(skeletonPairs.length).fill(0));

    for (let firstIndex = 0; firstIndex < skeletonPairs.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < skeletonPairs.length; secondIndex += 1) {
        const weight = this.getPairConflictWeight(config, board, skeletonPairs[firstIndex], skeletonPairs[secondIndex]);

        if (weight > 0) {
          graph[firstIndex][secondIndex] = weight;
          graph[secondIndex][firstIndex] = weight;
        }
      }
    }

    return {
      weights: graph,
      degrees: graph.map((row) => row.reduce((sum, weight) => sum + weight, 0)),
    };
  }

  private getPairConflictWeight(config: DifficultyConfig, board: BoardState, first: SkeletonPair, second: SkeletonPair): number {
    const firstPoints = [first.first, first.second];
    const secondPoints = [second.first, second.second];
    let weight = 0;

    for (const firstPoint of firstPoints) {
      for (const secondPoint of secondPoints) {
        const path = this.pathFinder.findPath(board, firstPoint, secondPoint);

        if (!path.connected) {
          continue;
        }

        const sharedNearSides = this.getSharedNearSides(config, firstPoint, secondPoint);
        const usesSharedOutsideChannel = sharedNearSides.some((side) => this.pathUsesSideChannel(path.points, config, side));

        if (usesSharedOutsideChannel) {
          weight += 120;
        } else if (sharedNearSides.length > 0 && path.turns === 2) {
          weight += 60;
        } else if (this.isAdjacent(firstPoint, secondPoint)) {
          weight += 28;
        } else if (path.turns === 0) {
          weight += 18;
        } else if (path.turns === 1) {
          weight += 8;
        } else {
          weight += 4;
        }
      }
    }

    return weight;
  }

  private createConflictAwareAssignment(
    config: DifficultyConfig,
    skeletonPairs: readonly SkeletonPair[],
    conflictGraph: ConflictGraph,
    random: SeededRandom,
  ): string[] {
    const remainingCounts = this.createPairTypeCounts(config);
    const assignedTypes: Array<string | null> = Array(skeletonPairs.length).fill(null);
    const typeSideCounts = new Map<string, Map<EdgeSide, number>>();
    const shuffledIndexes = random.shuffle(Array.from({ length: skeletonPairs.length }, (_, index) => index));
    const order = shuffledIndexes.sort((first, second) => {
      const degreeDelta = conflictGraph.degrees[second] - conflictGraph.degrees[first];
      return degreeDelta !== 0 ? degreeDelta : first - second;
    });

    for (const pairIndex of order) {
      const selectedType = this.selectBestTypeForPair(
        config,
        pairIndex,
        skeletonPairs,
        conflictGraph,
        assignedTypes,
        remainingCounts,
        typeSideCounts,
        random,
      );
      assignedTypes[pairIndex] = selectedType;
      remainingCounts.set(selectedType, (remainingCounts.get(selectedType) ?? 0) - 1);
      this.addTypeSideCounts(typeSideCounts, selectedType, this.getPairSideCounts(config, skeletonPairs[pairIndex]));
    }

    return assignedTypes.map((tileType) => {
      if (!tileType) {
        throw new Error('Tile assignment did not fill every skeleton pair.');
      }

      return tileType;
    });
  }

  private selectBestTypeForPair(
    config: DifficultyConfig,
    pairIndex: number,
    skeletonPairs: readonly SkeletonPair[],
    conflictGraph: ConflictGraph,
    assignedTypes: readonly (string | null)[],
    remainingCounts: ReadonlyMap<string, number>,
    typeSideCounts: ReadonlyMap<string, ReadonlyMap<EdgeSide, number>>,
    random: SeededRandom,
  ): string {
    const pairSideCounts = this.getPairSideCounts(config, skeletonPairs[pairIndex]);
    const candidates = random.shuffle([...remainingCounts.entries()].filter(([, count]) => count > 0).map(([tileType]) => tileType));
    let bestType = candidates[0];
    let bestScore = Infinity;

    for (const tileType of candidates) {
      let score = 0;

      for (let assignedIndex = 0; assignedIndex < assignedTypes.length; assignedIndex += 1) {
        if (assignedTypes[assignedIndex] === tileType) {
          score += conflictGraph.weights[pairIndex][assignedIndex] * 100;
        }
      }

      for (const [side, count] of pairSideCounts) {
        score += (typeSideCounts.get(tileType)?.get(side) ?? 0) * count * this.getSideConcentrationWeight(config);
      }

      if (score < bestScore) {
        bestScore = score;
        bestType = tileType;
      }
    }

    return bestType;
  }

  private createPairTypeCounts(config: DifficultyConfig): Map<string, number> {
    const pairCounts = new Map<string, number>();

    for (const [tileType, count] of Object.entries(getTileTypeCounts(config.id))) {
      pairCounts.set(tileType, count / 2);
    }

    return pairCounts;
  }

  private createResult(
    config: DifficultyConfig,
    skeletonPairs: readonly SkeletonPair[],
    tileTypes: readonly string[],
    optimizationIterations: number,
    startedAt: number,
  ): TileAssignmentOptimizationResult {
    const boardTiles: BoardTile[] = [];
    const solution: SolutionStep[] = [];

    if (tileTypes.length !== skeletonPairs.length) {
      throw new Error(`Tile pair count ${tileTypes.length} does not match skeleton pair count ${skeletonPairs.length}.`);
    }

    for (let index = 0; index < skeletonPairs.length; index += 1) {
      const pair = skeletonPairs[index];
      const tileType = tileTypes[index];
      boardTiles.push(
        { position: pair.first, type: tileType },
        { position: pair.second, type: tileType },
      );
      solution.push({
        first: pair.first,
        second: pair.second,
        tileType,
      });
    }

    const board = new BoardState(config.rows, config.columns, boardTiles);
    const difficultyMetrics = this.evaluator.evaluate(board, solution, config);

    return {
      tileTypes: [...tileTypes],
      solution,
      board,
      difficultyMetrics,
      optimizationScore: this.calculateOptimizationScore(difficultyMetrics, config),
      optimizationIterations,
      conflictBuildMilliseconds: 0,
      elapsedMilliseconds: Date.now() - startedAt,
    };
  }

  private calculateOptimizationScore(metrics: BoardDifficultyMetrics, config: DifficultyConfig): number {
    const difficultyConfig = getBoardDifficultyConfig(config.id);
    const openingMoveDensity = metrics.totalLegalMoves / (config.tileCount / 2);
    const densityOverflow = Math.max(0, openingMoveDensity - difficultyConfig.maxOpeningMoveDensity);
    const densityUnderflow = Math.max(0, difficultyConfig.minOpeningMoveDensity - openingMoveDensity);
    const adjacentOverflow = Math.max(0, metrics.adjacentMatchingMoves - difficultyConfig.maxAdjacentMatchingMoves);

    return metrics.score
      + densityOverflow * 120000
      + densityUnderflow * 6000
      + adjacentOverflow * 12000
      + metrics.edgeLegalMoves * difficultyConfig.edgeMoveWeight * 12
      + metrics.rejectionReasons.length * 4000;
  }

  private getMaxAssignmentAttempts(config: DifficultyConfig): number {
    switch (config.id) {
      case 'hard':
        return 6;
      case 'medium':
        return 5;
      case 'normal':
      default:
        return 4;
    }
  }

  private addTypeSideCounts(
    typeSideCounts: Map<string, Map<EdgeSide, number>>,
    tileType: string,
    countsToAdd: ReadonlyMap<EdgeSide, number>,
  ): void {
    const sideCounts = typeSideCounts.get(tileType) ?? new Map<EdgeSide, number>();

    for (const [side, count] of countsToAdd) {
      sideCounts.set(side, (sideCounts.get(side) ?? 0) + count);
    }

    typeSideCounts.set(tileType, sideCounts);
  }

  private getPairSideCounts(config: DifficultyConfig, pair: SkeletonPair): Map<EdgeSide, number> {
    const counts = new Map<EdgeSide, number>();

    for (const point of [pair.first, pair.second]) {
      for (const side of this.getPointSides(config, point)) {
        counts.set(side, (counts.get(side) ?? 0) + 1);
      }
    }

    return counts;
  }

  private getPointSides(config: DifficultyConfig, point: GridPoint): EdgeSide[] {
    const sides: EdgeSide[] = [];

    if (point.column <= 1) {
      sides.push('left');
    }

    if (point.column >= config.columns - 2) {
      sides.push('right');
    }

    if (point.row <= 1) {
      sides.push('top');
    }

    if (point.row >= config.rows - 2) {
      sides.push('bottom');
    }

    return sides;
  }

  private getSideConcentrationWeight(config: Pick<DifficultyConfig, 'id'>): number {
    switch (config.id) {
      case 'hard':
        return 2400;
      case 'medium':
        return 1700;
      case 'normal':
      default:
        return 950;
    }
  }

  private isAdjacent(first: GridPoint, second: GridPoint): boolean {
    return Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;
  }

  private getSharedNearSides(config: DifficultyConfig, first: GridPoint, second: GridPoint): EdgeSide[] {
    const firstSides = new Set(this.getPointSides(config, first));

    return this.getPointSides(config, second).filter((side) => firstSides.has(side));
  }

  private pathUsesSideChannel(points: readonly GridPoint[], config: DifficultyConfig, side: EdgeSide): boolean {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];

      switch (side) {
        case 'left':
          if (previous.column < 0 && current.column < 0) {
            return true;
          }
          break;
        case 'right':
          if (previous.column >= config.columns && current.column >= config.columns) {
            return true;
          }
          break;
        case 'top':
          if (previous.row < 0 && current.row < 0) {
            return true;
          }
          break;
        case 'bottom':
          if (previous.row >= config.rows && current.row >= config.rows) {
            return true;
          }
          break;
      }
    }

    return false;
  }
}

interface ConflictGraph {
  readonly weights: readonly (readonly number[])[];
  readonly degrees: readonly number[];
}

type EdgeSide = 'left' | 'right' | 'top' | 'bottom';
