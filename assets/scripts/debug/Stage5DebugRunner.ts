import { _decorator, Component } from 'cc';
import { getBoardDifficultyConfig } from '../config/BoardDifficultyConfig';
import { DIFFICULTIES } from '../config/DifficultyConfig';
import { getTileTypeCounts } from '../config/TileTypeConfig';
import { BoardGenerator } from '../core/BoardGenerator';
import { MoveFinder } from '../core/MoveFinder';
import type { BoardTile, DifficultyConfig, GeneratedBoard } from '../core/GameTypes';

const { ccclass } = _decorator;
const TEST_SEEDS: readonly number[] = [51000, 51001, 51002];

@ccclass('Stage5DebugRunner')
export class Stage5DebugRunner extends Component {
  protected start(): void {
    new Stage5TestSuite().run();
  }
}

class Stage5TestSuite {
  private readonly generator = new BoardGenerator();
  private readonly moveFinder = new MoveFinder();
  private passed = 0;
  private failed = 0;
  private firstFailureReported = false;

  public run(): void {
    for (const difficulty of DIFFICULTIES) {
      this.testDifficulty(difficulty);
    }

    console.log(`Stage5测试完成：通过${this.passed}，失败${this.failed}`);
  }

  private testDifficulty(difficulty: DifficultyConfig): void {
    for (const seed of TEST_SEEDS) {
      const startedAt = Date.now();

      try {
        const generated = this.generator.generate(difficulty, seed);
        const elapsedMilliseconds = Date.now() - startedAt;
        const validation = this.validateGeneratedBoard(difficulty, generated, elapsedMilliseconds);
        const metrics = generated.difficultyMetrics;

        this.expect(validation === null, `${difficulty.id} seed ${seed} generated valid board`, validation ?? undefined);
        console.log(
          `[Stage5DebugRunner] mode=${difficulty.id} seed=${seed} elapsedMs=${elapsedMilliseconds} tileCount=${generated.board.getRemainingCount()} solutionLength=${generated.solution.length} openingMoves=${metrics.totalLegalMoves} zeroTurnMoves=${metrics.zeroTurnMoves} oneTurnMoves=${metrics.oneTurnMoves} twoTurnMoves=${metrics.twoTurnMoves} accepted=${metrics.accepted} validationPassed=${generated.validationPassed}`,
        );

        if (elapsedMilliseconds > 2000) {
          this.expect(false, `${difficulty.id} seed ${seed} exceeded 2000ms budget`, `${elapsedMilliseconds}ms`);
          return;
        }
      } catch (error) {
        this.expect(false, `${difficulty.id} seed ${seed} generated valid board`, error);
      }
    }

    this.testDeterministicSeed(difficulty);
  }

  private validateGeneratedBoard(
    difficulty: DifficultyConfig,
    generated: GeneratedBoard,
    elapsedMilliseconds: number,
  ): string | null {
    const counts = this.countTileTypes(generated.board.getAllTiles());
    const expectedCounts = getTileTypeCounts(difficulty.id);
    const difficultyConfig = getBoardDifficultyConfig(difficulty.id);

    if (elapsedMilliseconds > difficultyConfig.maxSingleSeedDebugMilliseconds) {
      return `generation exceeded mode budget: ${elapsedMilliseconds}ms`;
    }

    if (generated.board.rows !== difficulty.rows || generated.board.columns !== difficulty.columns) {
      return `wrong size: ${generated.board.rows}x${generated.board.columns}`;
    }

    if (generated.board.getRemainingCount() !== difficulty.tileCount) {
      return `wrong tile count: ${generated.board.getRemainingCount()}`;
    }

    if (generated.solution.length !== difficulty.tileCount / 2) {
      return `wrong solution length: ${generated.solution.length}`;
    }

    for (const [tileType, expectedCount] of Object.entries(expectedCounts)) {
      const actualCount = counts.get(tileType) ?? 0;

      if (actualCount !== expectedCount) {
        return `wrong copy count for ${tileType}: ${actualCount}`;
      }

      if (actualCount % 2 !== 0) {
        return `odd copy count for ${tileType}: ${actualCount}`;
      }
    }

    if (!generated.validationPassed || !this.generator.validateSolution(generated.board, generated.solution)) {
      return 'recorded solution cannot clear board';
    }

    if (!this.moveFinder.findFirstMove(generated.board)) {
      return 'opening board has no legal move';
    }

    return null;
  }

  private testDeterministicSeed(difficulty: DifficultyConfig): void {
    try {
      const first = this.generator.generate(difficulty, 51999);
      const second = this.generator.generate(difficulty, 51999);
      const sameBoard = this.getBoardSignature(first) === this.getBoardSignature(second);
      const sameSolution = this.getSolutionSignature(first) === this.getSolutionSignature(second);

      this.expect(sameBoard && sameSolution, `${difficulty.id} same seed reproduces board and solution`);
    } catch (error) {
      this.expect(false, `${difficulty.id} same seed reproduces board and solution`, error);
    }
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

  private expect(condition: boolean, name: string, detail?: unknown): void {
    if (condition) {
      this.passed += 1;
      console.log(`[Stage5DebugRunner] PASS: ${name}`);
      return;
    }

    this.failed += 1;

    if (!this.firstFailureReported) {
      this.firstFailureReported = true;
      console.error(`[Stage5DebugRunner] FAIL: ${name}`, detail ?? '');
      return;
    }

    console.warn(`[Stage5DebugRunner] FAIL: ${name}`);
  }
}
