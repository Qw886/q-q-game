import { NORMAL_BOARD_DIFFICULTY_CONFIG } from '../config/BoardDifficultyConfig';
import { NORMAL_TILE_TYPES } from '../config/TileTypeConfig';
import { BoardDifficultyEvaluator } from './BoardDifficultyEvaluator';
import { BoardState } from './BoardState';
import { SeededRandom } from './SeededRandom';
import type { BoardDifficultyMetrics, BoardTile, DifficultyConfig, GridPoint, SolutionStep } from './GameTypes';

export interface SkeletonPair {
  readonly first: GridPoint;
  readonly second: GridPoint;
}

export interface TileAssignmentOptimizationResult {
  readonly tileTypes: readonly string[];
  readonly solution: readonly SolutionStep[];
  readonly board: BoardState;
  readonly difficultyMetrics: BoardDifficultyMetrics;
  readonly optimizationIterations: number;
  readonly elapsedMilliseconds: number;
}

export class TileAssignmentOptimizer {
  private readonly evaluator = new BoardDifficultyEvaluator();

  public optimize(
    config: DifficultyConfig,
    skeletonPairs: readonly SkeletonPair[],
    random: SeededRandom,
  ): TileAssignmentOptimizationResult {
    const startedAt = Date.now();
    let currentTypes = this.createInitialAssignment(random);
    let current = this.createResult(config, skeletonPairs, currentTypes, 0, startedAt);
    let best = current;
    let iterations = 0;

    for (; iterations < NORMAL_BOARD_DIFFICULTY_CONFIG.maxOptimizationIterations; iterations += 1) {
      if (current.difficultyMetrics.accepted) {
        best = current;
        break;
      }

      if (Date.now() - startedAt > NORMAL_BOARD_DIFFICULTY_CONFIG.maxOptimizationMilliseconds) {
        break;
      }

      const firstIndex = random.nextInt(currentTypes.length);
      let secondIndex = random.nextInt(currentTypes.length - 1);

      if (secondIndex >= firstIndex) {
        secondIndex += 1;
      }

      if (currentTypes[firstIndex] === currentTypes[secondIndex]) {
        continue;
      }

      const candidateTypes = [...currentTypes];
      const firstType = candidateTypes[firstIndex];
      candidateTypes[firstIndex] = candidateTypes[secondIndex];
      candidateTypes[secondIndex] = firstType;

      const candidate = this.createResult(config, skeletonPairs, candidateTypes, iterations + 1, startedAt);
      const improved = candidate.difficultyMetrics.score <= current.difficultyMetrics.score;
      const acceptWorse = random.next() < NORMAL_BOARD_DIFFICULTY_CONFIG.randomWorseAssignmentAcceptRate;

      if (improved || acceptWorse) {
        currentTypes = candidateTypes;
        current = candidate;
      }

      if (candidate.difficultyMetrics.score < best.difficultyMetrics.score) {
        best = candidate;
      }
    }

    return {
      ...best,
      optimizationIterations: iterations,
      elapsedMilliseconds: Date.now() - startedAt,
    };
  }

  private createInitialAssignment(random: SeededRandom): string[] {
    const pairTypes: string[] = [];

    for (const tileType of NORMAL_TILE_TYPES) {
      pairTypes.push(tileType, tileType);
    }

    return random.shuffle(pairTypes);
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

    return {
      tileTypes: [...tileTypes],
      solution,
      board,
      difficultyMetrics: this.evaluator.evaluate(board, solution, config),
      optimizationIterations,
      elapsedMilliseconds: Date.now() - startedAt,
    };
  }
}
