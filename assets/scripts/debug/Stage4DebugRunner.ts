import { _decorator, Component } from 'cc';
import { NORMAL_BOARD_DIFFICULTY_CONFIG } from '../config/BoardDifficultyConfig';
import { NORMAL_DIFFICULTY } from '../config/DifficultyConfig';
import { getTileTypeCounts } from '../config/TileTypeConfig';
import { BoardGenerator } from '../core/BoardGenerator';
import { BoardState } from '../core/BoardState';
import { DeadlockDetector } from '../core/DeadlockDetector';
import type { BoardTile, GeneratedBoard } from '../core/GameTypes';

const { ccclass } = _decorator;
const DEBUG_TEST_SEEDS: readonly number[] = Array.from({ length: 20 }, (_, index) => 41000 + index);

@ccclass('Stage4DebugRunner')
export class Stage4DebugRunner extends Component {
  protected start(): void {
    const runner = new Stage4TestSuite();
    runner.run();
  }
}

class Stage4TestSuite {
  private readonly generator = new BoardGenerator();
  private readonly deadlockDetector = new DeadlockDetector();
  private passed = 0;
  private failed = 0;
  private firstFailureReported = false;
  private readonly openingMoveCounts: number[] = [];
  private readonly zeroTurnCounts: number[] = [];
  private readonly oneTurnCounts: number[] = [];
  private readonly twoTurnCounts: number[] = [];

  public run(): void {
    this.testGeneratedSeeds();
    this.testDeterministicSeed();
    this.testDifferentSeedsUsuallyDiffer();
    this.testDeadlockRules();
    this.logOpeningMoveSummary();
    console.log(`Stage4\u6d4b\u8bd5\u5b8c\u6210\uff1a\u901a\u8fc7${this.passed}\uff0c\u5931\u8d25${this.failed}`);
  }

  private testGeneratedSeeds(): void {
    for (const seed of DEBUG_TEST_SEEDS) {
      const startedAt = Date.now();

      try {
        const generated = this.generator.generate(NORMAL_DIFFICULTY, seed);
        const validation = this.validateGeneratedBoard(generated);
        this.openingMoveCounts.push(generated.difficultyMetrics.totalLegalMoves);
        this.zeroTurnCounts.push(generated.difficultyMetrics.zeroTurnMoves);
        this.oneTurnCounts.push(generated.difficultyMetrics.oneTurnMoves);
        this.twoTurnCounts.push(generated.difficultyMetrics.twoTurnMoves);
        this.expect(validation === null, `seed ${seed} generated valid board`, validation ?? undefined);
        this.logSeedSummary(seed, generated, Date.now() - startedAt);

        if (Date.now() - startedAt > NORMAL_BOARD_DIFFICULTY_CONFIG.maxSingleSeedDebugMilliseconds) {
          this.expect(false, `seed ${seed} exceeded time budget`, `${Date.now() - startedAt}ms`);
          return;
        }
      } catch (error) {
        this.expect(false, `seed ${seed} generated valid board`, error);
      }
    }
  }

  private testDeterministicSeed(): void {
    try {
      const first = this.generator.generate(NORMAL_DIFFICULTY, 90210);
      const second = this.generator.generate(NORMAL_DIFFICULTY, 90210);
      const sameBoard = this.getBoardSignature(first) === this.getBoardSignature(second);
      const sameSolution = this.getSolutionSignature(first) === this.getSolutionSignature(second);
      const sameStrategy = first.generationStrategy === second.generationStrategy;
      const sameMetrics = this.getDifficultySignature(first) === this.getDifficultySignature(second);

      this.expect(sameBoard && sameSolution && sameStrategy && sameMetrics, 'same seed reproduces board solution strategy and metrics');
    } catch (error) {
      this.expect(false, 'same seed reproduces board solution and strategy', error);
    }
  }

  private testDifferentSeedsUsuallyDiffer(): void {
    try {
      const first = this.generator.generate(NORMAL_DIFFICULTY, 90211);
      const second = this.generator.generate(NORMAL_DIFFICULTY, 90212);
      this.expect(this.getBoardSignature(first) !== this.getBoardSignature(second), 'different seeds usually differ');
    } catch (error) {
      this.expect(false, 'different seeds usually differ', error);
    }
  }

  private testDeadlockRules(): void {
    const playableBoard = new BoardState(2, 2, [
      { position: { row: 0, column: 0 }, type: 'A' },
      { position: { row: 0, column: 1 }, type: 'A' },
    ]);
    this.expect(!this.deadlockDetector.isDeadlocked(playableBoard), 'legal move is not deadlock');

    const deadlockedBoard = new BoardState(3, 3, [
      { position: { row: 0, column: 0 }, type: 'A' },
      { position: { row: 0, column: 1 }, type: 'B' },
      { position: { row: 0, column: 2 }, type: 'C' },
      { position: { row: 1, column: 0 }, type: 'D' },
      { position: { row: 1, column: 1 }, type: 'E' },
      { position: { row: 1, column: 2 }, type: 'F' },
      { position: { row: 2, column: 0 }, type: 'G' },
      { position: { row: 2, column: 1 }, type: 'H' },
      { position: { row: 2, column: 2 }, type: 'A' },
    ]);
    this.expect(this.deadlockDetector.isDeadlocked(deadlockedBoard), 'remaining tiles without legal move is deadlock');

    const emptyBoard = new BoardState(2, 2, []);
    this.expect(!this.deadlockDetector.isDeadlocked(emptyBoard), 'empty board is not deadlock');
  }

  private validateGeneratedBoard(generated: GeneratedBoard): string | null {
    const counts = this.countTileTypes(generated.board.getAllTiles());
    const metrics = generated.difficultyMetrics;

    if (generated.board.rows !== NORMAL_DIFFICULTY.rows || generated.board.columns !== NORMAL_DIFFICULTY.columns) {
      return `wrong size: ${generated.board.rows}x${generated.board.columns}`;
    }

    if (generated.board.getRemainingCount() !== NORMAL_DIFFICULTY.tileCount) {
      return `wrong tile count: ${generated.board.getRemainingCount()}`;
    }

    const configuredCounts = getTileTypeCounts(NORMAL_DIFFICULTY.id);

    if (counts.size !== Object.keys(configuredCounts).length) {
      return `wrong type count: ${counts.size}`;
    }

    for (const [tileType, expectedCount] of Object.entries(configuredCounts)) {
      const count = counts.get(tileType);

      if (count !== expectedCount) {
        return `wrong copy count for ${tileType}: ${count}`;
      }
    }

    if (generated.solution.length !== NORMAL_DIFFICULTY.tileCount / 2) {
      return `wrong solution length: ${generated.solution.length}`;
    }

    if (!this.generator.validateSolution(generated.board, generated.solution)) {
      return 'recorded solution cannot clear board';
    }

    if (!generated.validationPassed) {
      return 'validationPassed is false';
    }

    if (metrics.totalLegalMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minOpeningMoves) {
      return `opening moves too low: ${metrics.totalLegalMoves}`;
    }

    if (
      generated.generationStrategy !== 'FALLBACK'
      && metrics.totalLegalMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxOpeningMoves
    ) {
      return `opening moves too high: ${metrics.totalLegalMoves}`;
    }

    if (
      generated.generationStrategy === 'FALLBACK'
      && metrics.totalLegalMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxFallbackOpeningMoves
    ) {
      return `fallback opening moves too high: ${metrics.totalLegalMoves}`;
    }

    if (metrics.adjacentMatchingMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxAdjacentMatchingMoves) {
      return `too many adjacent matching moves: ${metrics.adjacentMatchingMoves}`;
    }

    if (metrics.zeroTurnMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minZeroTurnMoves) {
      return `zero-turn moves too low: ${metrics.zeroTurnMoves}`;
    }

    if (metrics.zeroTurnMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxZeroTurnMoves) {
      return `zero-turn moves too high: ${metrics.zeroTurnMoves}`;
    }

    if (metrics.oneTurnMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minOneTurnMoves) {
      return `one-turn moves too low: ${metrics.oneTurnMoves}`;
    }

    if (metrics.oneTurnMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxOneTurnMoves) {
      return `one-turn moves too high: ${metrics.oneTurnMoves}`;
    }

    if (metrics.twoTurnMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minTwoTurnMoves) {
      return `missing two-turn moves: ${metrics.twoTurnMoves}`;
    }

    if (metrics.twoTurnMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxTwoTurnMoves) {
      return `two-turn moves too high: ${metrics.twoTurnMoves}`;
    }

    const maxTurnTypeRatio = Math.max(metrics.zeroTurnMoves, metrics.oneTurnMoves, metrics.twoTurnMoves) / metrics.totalLegalMoves;

    if (maxTurnTypeRatio > NORMAL_BOARD_DIFFICULTY_CONFIG.maxSingleTurnTypeRatio) {
      return `single turn type ratio too high: ${maxTurnTypeRatio}`;
    }

    if (metrics.firstTenStepsAverageMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxFirstTenAverageMoves) {
      return `first ten average too high: ${metrics.firstTenStepsAverageMoves}`;
    }

    return null;
  }

  private countTileTypes(tiles: readonly BoardTile[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const tile of tiles) {
      counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1);
    }

    return counts;
  }

  private getBoardSignature(generated: GeneratedBoard): string {
    return generated.board
      .getAllTiles()
      .sort((first, second) => {
        if (first.position.row !== second.position.row) {
          return first.position.row - second.position.row;
        }

        return first.position.column - second.position.column;
      })
      .map((tile) => `${tile.position.row},${tile.position.column}:${tile.type}`)
      .join('|');
  }

  private getSolutionSignature(generated: GeneratedBoard): string {
    return generated.solution
      .map((step) => `${step.first.row},${step.first.column}-${step.second.row},${step.second.column}:${step.tileType}`)
      .join('|');
  }

  private getDifficultySignature(generated: GeneratedBoard): string {
    const metrics = generated.difficultyMetrics;

    return [
      metrics.totalLegalMoves,
      metrics.zeroTurnMoves,
      metrics.oneTurnMoves,
      metrics.twoTurnMoves,
      metrics.adjacentMatchingMoves,
      metrics.edgeLegalMoves,
      metrics.firstTenStepsAverageMoves.toFixed(2),
      metrics.accepted,
    ].join('|');
  }

  private logOpeningMoveSummary(): void {
    if (this.openingMoveCounts.length === 0) {
      console.log('[Stage4DebugRunner] openingMoves min=0 max=0 avg=0.0');
      return;
    }

    const min = Math.min(...this.openingMoveCounts);
    const max = Math.max(...this.openingMoveCounts);
    const average = this.openingMoveCounts.reduce((sum, count) => sum + count, 0) / this.openingMoveCounts.length;

    console.log(`[Stage4DebugRunner] openingMoves min=${min} max=${max} avg=${average.toFixed(1)}`);
    this.logMetricSummary('zeroTurnMoves', this.zeroTurnCounts);
    this.logMetricSummary('oneTurnMoves', this.oneTurnCounts);
    this.logMetricSummary('twoTurnMoves', this.twoTurnCounts);
  }

  private logMetricSummary(name: string, values: readonly number[]): void {
    if (values.length === 0) {
      console.log(`[Stage4DebugRunner] ${name} min=0 max=0 avg=0.0`);
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;

    console.log(`[Stage4DebugRunner] ${name} min=${min} max=${max} avg=${average.toFixed(1)}`);
  }

  private logSeedSummary(seed: number, generated: GeneratedBoard, elapsedMilliseconds: number): void {
    const metrics = generated.difficultyMetrics;

    console.log(
      `[Stage4DebugRunner] seed=${seed} elapsedMs=${elapsedMilliseconds} skeletonMs=${generated.skeletonElapsedMilliseconds} optimizationMs=${generated.assignmentOptimizationElapsedMilliseconds} optimizationIterations=${generated.optimizationIterations} openingMoves=${metrics.totalLegalMoves} zeroTurnMoves=${metrics.zeroTurnMoves} oneTurnMoves=${metrics.oneTurnMoves} twoTurnMoves=${metrics.twoTurnMoves} adjacentMatchingMoves=${metrics.adjacentMatchingMoves} penaltyScore=${metrics.score.toFixed(1)} difficultySelectionAttempts=${generated.difficultySelectionAttempts} accepted=${metrics.accepted}`,
    );
  }

  private expect(condition: boolean, name: string, detail?: unknown): void {
    if (condition) {
      this.passed += 1;
      console.log(`[Stage4DebugRunner] PASS: ${name}`);
      return;
    }

    this.failed += 1;

    if (!this.firstFailureReported) {
      this.firstFailureReported = true;
      console.error(`[Stage4DebugRunner] FAIL: ${name}`, detail ?? '');
      return;
    }

    console.warn(`[Stage4DebugRunner] FAIL: ${name}`);
  }
}
