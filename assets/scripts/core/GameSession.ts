import { BoardState } from './BoardState';
import { SCORE_CONFIG } from '../config/ScoreConfig';
import {
  BoardTile,
  DifficultyConfig,
  GameEndReason,
  GameSnapshot,
  GameStatus,
  GridPoint,
  TileClickResult,
  TileData,
} from './GameTypes';
import { LinkPathFinder } from './LinkPathFinder';

const TILE_LABELS: readonly string[] = [
  '一万',
  '二万',
  '三万',
  '四万',
  '五万',
  '一筒',
  '二筒',
  '三筒',
  '四筒',
  '五筒',
  '一条',
  '二条',
  '三条',
  '四条',
  '五条',
  '东',
  '南',
  '西',
  '北',
  '中',
];

export class GameSession {
  public readonly config: DifficultyConfig;
  public readonly board: BoardState;
  private readonly pathFinder = new LinkPathFinder();
  private readonly tiles: readonly TileData[];
  private selectedPoint: GridPoint | null = null;
  private remainingTileCount: number;
  private currentScore = 0;
  private currentRemainingTime: number;
  private currentStatus: GameStatus = 'running';
  private currentEndReason: GameEndReason | null = null;
  private inputLocked = false;

  public constructor(config: DifficultyConfig) {
    this.config = config;
    this.tiles = this.createFixedTiles(config);
    this.board = new BoardState(config.rows, config.columns, this.toBoardTiles(this.tiles));
    this.remainingTileCount = config.tileCount;
    this.currentRemainingTime = config.roundTime;
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
      this.remainingTileCount = Math.max(0, this.remainingTileCount - 2);
      this.currentScore += gainedScore;
      this.currentRemainingTime = this.config.roundTime;
    }

    this.selectedPoint = null;
    this.inputLocked = false;

    if (this.remainingTileCount === 0) {
      this.currentStatus = 'won';
      this.currentEndReason = 'win';
      this.inputLocked = true;
    }

    return gainedScore;
  }

  public update(deltaSeconds: number): GameEndReason | null {
    if (this.currentStatus !== 'running' || this.inputLocked) {
      return null;
    }

    this.currentRemainingTime = Math.max(0, this.currentRemainingTime - Math.max(0, deltaSeconds));

    if (this.currentRemainingTime <= 0) {
      this.currentStatus = 'lost';
      this.currentEndReason = 'timeout';
      this.inputLocked = true;
      this.selectedPoint = null;

      return 'timeout';
    }

    return null;
  }

  private createFixedTiles(config: DifficultyConfig): TileData[] {
    const tiles: TileData[] = [];

    for (let row = 0; row < config.rows; row += 1) {
      for (let column = 0; column < config.columns; column += 1) {
        const id = row * config.columns + column;
        const pairIndex = Math.floor(id / 2);
        const label = TILE_LABELS[pairIndex % TILE_LABELS.length];

        tiles.push({
          id,
          label,
          type: label,
          row,
          column,
        });
      }
    }

    return tiles;
  }

  private toBoardTiles(tiles: readonly TileData[]): BoardTile[] {
    return tiles.map((tile) => ({
      position: { row: tile.row, column: tile.column },
      type: tile.type,
    }));
  }

  private getDisplayedRemainingSeconds(): number {
    return Math.max(0, Math.ceil(this.currentRemainingTime));
  }
}
