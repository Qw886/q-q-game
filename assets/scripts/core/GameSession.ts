import { SCORE_CONFIG } from '../config/ScoreConfig';
import { BoardGenerator } from './BoardGenerator';
import { BoardState } from './BoardState';
import { DeadlockDetector } from './DeadlockDetector';
import { LinkPathFinder } from './LinkPathFinder';
import {
  DifficultyConfig,
  GameEndReason,
  GameSnapshot,
  GameStatus,
  GeneratedBoard,
  GridPoint,
  SolutionStep,
  TileClickResult,
  TileData,
} from './GameTypes';

export class GameSession {
  public readonly config: DifficultyConfig;
  public readonly board: BoardState;
  public readonly seed: number;
  public readonly solution: readonly SolutionStep[];
  public readonly generationAttempts: number;
  public readonly validationPassed: boolean;
  public readonly generationStrategy: 'BACKTRACKING' | 'FALLBACK';
  private readonly pathFinder = new LinkPathFinder();
  private readonly deadlockDetector = new DeadlockDetector();
  private readonly tiles: readonly TileData[];
  private selectedPoint: GridPoint | null = null;
  private remainingTileCount: number;
  private currentScore = 0;
  private currentRemainingTime: number;
  private currentStatus: GameStatus = 'running';
  private currentEndReason: GameEndReason | null = null;
  private inputLocked = false;

  public constructor(config: DifficultyConfig, seed?: number) {
    const generatedBoard = new BoardGenerator().generate(config, seed);

    this.config = config;
    this.board = generatedBoard.board;
    this.tiles = generatedBoard.tiles;
    this.seed = generatedBoard.seed;
    this.solution = generatedBoard.solution;
    this.generationAttempts = generatedBoard.generationAttempts;
    this.validationPassed = generatedBoard.validationPassed;
    this.generationStrategy = generatedBoard.generationStrategy;
    this.remainingTileCount = this.board.getRemainingCount();
    this.currentRemainingTime = config.roundTime;
    this.logGenerationSummary(generatedBoard);
  }

  public getTiles(): readonly TileData[] {
    return this.tiles;
  }

  public getSnapshot(): GameSnapshot {
    return {
      modeName: this.config.name,
      remainingTiles: this.remainingTileCount,
      score: this.currentScore,
      remainingSeconds: this.getDisplayedRemainingSeconds(),
      status: this.currentStatus,
    };
  }

  public get status(): GameStatus {
    return this.currentStatus;
  }

  public get endReason(): GameEndReason | null {
    return this.currentEndReason;
  }

  public get score(): number {
    return this.currentScore;
  }

  public get remainingTiles(): number {
    return this.remainingTileCount;
  }

  public get selected(): GridPoint | null {
    return this.selectedPoint;
  }

  public isInputLocked(): boolean {
    return this.inputLocked || this.currentStatus !== 'running';
  }

  public setInputLocked(locked: boolean): void {
    this.inputLocked = locked;
  }

  public cancelPendingAction(): void {
    if (this.currentStatus !== 'running') {
      return;
    }

    this.inputLocked = false;
    this.selectedPoint = null;
  }

  public clearSelection(): void {
    this.selectedPoint = null;
  }

  public handleTileClick(point: GridPoint): TileClickResult {
    if (this.isInputLocked()) {
      return { kind: 'ignored', reason: '当前不能操作棋盘' };
    }

    if (!this.board.hasTile(point)) {
      return { kind: 'ignored', reason: '点击位置没有麻将' };
    }

    if (!this.selectedPoint) {
      this.selectedPoint = point;
      return { kind: 'selected', point };
    }

    if (this.board.isSamePoint(this.selectedPoint, point)) {
      const deselected = this.selectedPoint;
      this.selectedPoint = null;
      return { kind: 'deselected', point: deselected };
    }

    const previous = this.selectedPoint;
    const previousType = this.board.getTileType(previous);
    const currentType = this.board.getTileType(point);

    if (previousType !== currentType) {
      this.selectedPoint = point;
      return { kind: 'typeMismatch', previous, selected: point };
    }

    const path = this.pathFinder.findPath(this.board, previous, point);

    if (!path.connected) {
      this.selectedPoint = point;
      return {
        kind: 'blocked',
        previous,
        selected: point,
        reason: path.failureReason ?? '无法连接',
      };
    }

    this.inputLocked = true;

    return {
      kind: 'connected',
      first: previous,
      second: point,
      path,
    };
  }

  public completePairRemoval(first: GridPoint, second: GridPoint): number {
    if (this.currentStatus !== 'running') {
      return 0;
    }

    let gainedScore = 0;

    if (this.board.hasTile(first) && this.board.hasTile(second)) {
      const remainingSeconds = this.getDisplayedRemainingSeconds();
      gainedScore = SCORE_CONFIG.pairBaseScore + remainingSeconds * SCORE_CONFIG.remainingSecondBonus;

      this.board.removeTiles(first, second);
      this.remainingTileCount = this.board.getRemainingCount();
      this.currentScore += gainedScore;
      this.currentRemainingTime = this.config.roundTime;
    }

    this.selectedPoint = null;
    this.inputLocked = false;
    this.updateEndStateAfterRemoval();

    return gainedScore;
  }

  public update(deltaSeconds: number): GameEndReason | null {
    if (this.currentStatus !== 'running' || this.inputLocked) {
      return null;
    }

    this.currentRemainingTime = Math.max(0, this.currentRemainingTime - Math.max(0, deltaSeconds));

    if (this.currentRemainingTime <= 0) {
      this.setLost('timeout');

      return 'timeout';
    }

    return null;
  }

  private updateEndStateAfterRemoval(): void {
    if (this.remainingTileCount === 0) {
      this.currentStatus = 'won';
      this.currentEndReason = 'win';
      this.inputLocked = true;
      return;
    }

    if (this.deadlockDetector.isDeadlocked(this.board)) {
      this.setLost('deadlock');
    }
  }

  private setLost(reason: Exclude<GameEndReason, 'win'>): void {
    this.currentStatus = 'lost';
    this.currentEndReason = reason;
    this.inputLocked = true;
    this.selectedPoint = null;
  }

  private logGenerationSummary(generatedBoard: GeneratedBoard): void {
    const metrics = generatedBoard.difficultyMetrics;
    console.info(
      `[Stage4] seed=${generatedBoard.seed}, strategy=${generatedBoard.generationStrategy}, elapsedMs=${generatedBoard.generationElapsedMilliseconds}, skeletonMs=${generatedBoard.skeletonElapsedMilliseconds}, optimizationMs=${generatedBoard.assignmentOptimizationElapsedMilliseconds}, optimizationIterations=${generatedBoard.optimizationIterations}, openingMoves=${metrics.totalLegalMoves}, zeroTurnMoves=${metrics.zeroTurnMoves}, oneTurnMoves=${metrics.oneTurnMoves}, twoTurnMoves=${metrics.twoTurnMoves}, adjacentMatchingMoves=${metrics.adjacentMatchingMoves}, penaltyScore=${metrics.score.toFixed(1)}, firstTenStepsAverageMoves=${metrics.firstTenStepsAverageMoves.toFixed(1)}, accepted=${metrics.accepted}`,
    );
  }

  private getDisplayedRemainingSeconds(): number {
    return Math.max(0, Math.ceil(this.currentRemainingTime));
  }
}
