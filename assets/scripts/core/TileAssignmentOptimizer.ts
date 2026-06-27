import { getBoardDifficultyConfig } from '../config/BoardDifficultyConfig';
import { getTileTypeCounts } from '../config/TileTypeConfig';
import { BoardDifficultyEvaluator } from './BoardDifficultyEvaluator';
import { BoardState } from './BoardState';
import { LinkPathFinder } from './LinkPathFinder';
import { SeededRandom } from './SeededRandom';
import type { BoardDifficultyMetrics, BoardTile, DifficultyConfig, GridPoint, SolutionStep } from './GameTypes';

const CONFLICT_TILE_TYPE = '__conflict__';
const EDGE_SIDES: readonly EdgeSide[] = ['left', 'right', 'top', 'bottom'];

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
    const tileTypes = this.createTileTypeList(config);
    const maxAttempts = this.getMaxAssignmentAttempts(config);
    let best: TileAssignmentOptimizationResult | null = null;

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      const assignedTileTypes = this.createConflictAwareAssignment(config, skeletonPairs, conflictGraph, tileTypes, random);
      const candidate = this.createResult(config, skeletonPairs, assignedTileTypes, attemptIndex + 1, startedAt);

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
      tileTypes: best.tileTypes,
      solution: best.solution,
      board: best.board,
      difficultyMetrics: best.difficultyMetrics,
      optimizationScore: best.optimizationScore,
      optimizationIterations: best.optimizationIterations,
      conflictBuildMilliseconds,
      elapsedMilliseconds: Date.now() - startedAt,
    };
  }

  private buildConflictGraph(config: DifficultyConfig, skeletonPairs: readonly SkeletonPair[]): ConflictGraph {
    const boardTiles: BoardTile[] = [];

    for (let index = 0; index < skeletonPairs.length; index += 1) {
      const pair = skeletonPairs[index];
      boardTiles.push(
        { position: pair.first, type: CONFLICT_TILE_TYPE },
        { position: pair.second, type: CONFLICT_TILE_TYPE },
      );
    }

    const board = new BoardState(config.rows, config.columns, boardTiles);
    const graph: number[][] = [];

    for (let row = 0; row < skeletonPairs.length; row += 1) {
      const weights: number[] = [];

      for (let column = 0; column < skeletonPairs.length; column += 1) {
        weights.push(0);
      }

      graph.push(weights);
    }

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
      degrees: this.calculateConflictDegrees(graph),
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

  private calculateConflictDegrees(graph: readonly (readonly number[])[]): number[] {
    const degrees: number[] = [];

    for (let rowIndex = 0; rowIndex < graph.length; rowIndex += 1) {
      const row = graph[rowIndex];
      let degree = 0;

      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        degree += row[columnIndex];
      }

      degrees.push(degree);
    }

    return degrees;
  }

  private createConflictAwareAssignment(
    config: DifficultyConfig,
    skeletonPairs: readonly SkeletonPair[],
    conflictGraph: ConflictGraph,
    tileTypes: readonly string[],
    random: SeededRandom,
  ): string[] {
    const remainingCounts = this.createPairTypeCounts(config, tileTypes);
    const assignedTypes: Array<string | null> = Array(skeletonPairs.length).fill(null);
    const typeSideCounts = new Map<string, Map<EdgeSide, number>>();
    const shuffledIndexes = random.shuffle(this.createPairIndexes(skeletonPairs.length));
    const order = shuffledIndexes.sort((first, second) => {
      const degreeDelta = conflictGraph.degrees[second] - conflictGraph.degrees[first];
      return degreeDelta !== 0 ? degreeDelta : first - second;
    });

    this.validatePairTypeCapacity(config, skeletonPairs.length, remainingCounts, tileTypes);

    for (let orderIndex = 0; orderIndex < order.length; orderIndex += 1) {
      const pairIndex = order[orderIndex];
      const selectedType = this.selectBestTypeForPair(
        config,
        pairIndex,
        skeletonPairs,
        conflictGraph,
        assignedTypes,
        remainingCounts,
        tileTypes,
        typeSideCounts,
        random,
      );
      assignedTypes[pairIndex] = selectedType;
      remainingCounts.set(selectedType, (remainingCounts.get(selectedType) ?? 0) - 1);
      this.addTypeSideCounts(typeSideCounts, selectedType, this.getPairSideCounts(config, skeletonPairs[pairIndex]));
    }

    const assignedTileTypes: string[] = [];

    for (let index = 0; index < assignedTypes.length; index += 1) {
      const tileType = assignedTypes[index];

      if (!tileType) {
        throw new Error(`Tile assignment did not fill skeleton pair ${index} of ${skeletonPairs.length}.`);
      }

      assignedTileTypes.push(tileType);
    }

    return assignedTileTypes;
  }

  private selectBestTypeForPair(
    config: DifficultyConfig,
    pairIndex: number,
    skeletonPairs: readonly SkeletonPair[],
    conflictGraph: ConflictGraph,
    assignedTypes: readonly (string | null)[],
    remainingCounts: ReadonlyMap<string, number>,
    tileTypes: readonly string[],
    typeSideCounts: ReadonlyMap<string, ReadonlyMap<EdgeSide, number>>,
    random: SeededRandom,
  ): string {
    const pairSideCounts = this.getPairSideCounts(config, skeletonPairs[pairIndex]);
    const availableTypes: string[] = [];

    for (let index = 0; index < tileTypes.length; index += 1) {
      const tileType = tileTypes[index];

      if ((remainingCounts.get(tileType) ?? 0) > 0) {
        availableTypes.push(tileType);
      }
    }

    const candidates = random.shuffle(availableTypes);

    if (candidates.length === 0) {
      throw new Error(`No tile type remains for skeleton pair ${pairIndex} in difficulty: ${config.id}.`);
    }

    let bestType = candidates[0];
    let bestScore = Infinity;

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const tileType = candidates[candidateIndex];
      let score = 0;

      for (let assignedIndex = 0; assignedIndex < assignedTypes.length; assignedIndex += 1) {
        if (assignedTypes[assignedIndex] === tileType) {
          score += conflictGraph.weights[pairIndex][assignedIndex] * 100;
        }
      }

      for (let sideIndex = 0; sideIndex < EDGE_SIDES.length; sideIndex += 1) {
        const side = EDGE_SIDES[sideIndex];
        const count = pairSideCounts.get(side) ?? 0;

        score += (typeSideCounts.get(tileType)?.get(side) ?? 0) * count * this.getSideConcentrationWeight(config);
      }

      if (score < bestScore) {
        bestScore = score;
        bestType = tileType;
      }
    }

    return bestType;
  }

  private createTileTypeList(config: DifficultyConfig): string[] {
    const counts = getTileTypeCounts(config.id);
    const tileTypes: string[] = [];

    for (const tileType of Object.keys(counts)) {
      tileTypes.push(tileType);
    }

    return tileTypes;
  }

  private createPairIndexes(pairCount: number): number[] {
    const indexes: number[] = [];

    for (let index = 0; index < pairCount; index += 1) {
      indexes.push(index);
    }

    return indexes;
  }

  private validatePairTypeCapacity(
    config: DifficultyConfig,
    skeletonPairCount: number,
    remainingCounts: ReadonlyMap<string, number>,
    tileTypes: readonly string[],
  ): void {
    let totalPairs = 0;

    for (let index = 0; index < tileTypes.length; index += 1) {
      totalPairs += remainingCounts.get(tileTypes[index]) ?? 0;
    }

    if (totalPairs !== skeletonPairCount) {
      throw new Error(`Tile pair capacity ${totalPairs} does not match skeleton pair count ${skeletonPairCount} for difficulty: ${config.id}.`);
    }
  }

  private createPairTypeCounts(config: DifficultyConfig, tileTypes: readonly string[]): Map<string, number> {
    const counts = getTileTypeCounts(config.id);
    const pairCounts = new Map<string, number>();

    for (let index = 0; index < tileTypes.length; index += 1) {
      const tileType = tileTypes[index];
      const count = counts[tileType];

      if (!Number.isInteger(count) || count <= 0 || count % 2 !== 0) {
        throw new Error(`Invalid tile type count for ${tileType} in difficulty: ${config.id}.`);
      }

      pairCounts.set(tileType, count / 2);
    }

    return pairCounts;
  }

  private copyTileTypes(tileTypes: readonly string[]): string[] {
    const copy: string[] = [];

    for (let index = 0; index < tileTypes.length; index += 1) {
      copy.push(tileTypes[index]);
    }

    return copy;
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
      tileTypes: this.copyTileTypes(tileTypes),
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

    for (let sideIndex = 0; sideIndex < EDGE_SIDES.length; sideIndex += 1) {
      const side = EDGE_SIDES[sideIndex];
      const count = countsToAdd.get(side) ?? 0;

      sideCounts.set(side, (sideCounts.get(side) ?? 0) + count);
    }

    typeSideCounts.set(tileType, sideCounts);
  }

  private getPairSideCounts(config: DifficultyConfig, pair: SkeletonPair): Map<EdgeSide, number> {
    const counts = new Map<EdgeSide, number>();

    const points = [pair.first, pair.second];

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const pointSides = this.getPointSides(config, points[pointIndex]);

      for (let sideIndex = 0; sideIndex < pointSides.length; sideIndex += 1) {
        const side = pointSides[sideIndex];
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

    const secondSides = this.getPointSides(config, second);
    const sharedSides: EdgeSide[] = [];

    for (let index = 0; index < secondSides.length; index += 1) {
      const side = secondSides[index];

      if (firstSides.has(side)) {
        sharedSides.push(side);
      }
    }

    return sharedSides;
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
