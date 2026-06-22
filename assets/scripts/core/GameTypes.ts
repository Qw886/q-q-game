export type DifficultyId = 'normal' | 'medium' | 'hard';

export interface DifficultyConfig {
  readonly id: DifficultyId;
  readonly name: string;
  readonly rows: number;
  readonly columns: number;
  readonly tileCount: number;
  readonly roundTime: number;
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

export type GameEndReason = 'win' | 'timeout';

export interface GameSnapshot {
  readonly modeName: string;
  readonly remainingTiles: number;
  readonly score: number;
  readonly remainingSeconds: number;
  readonly status: GameStatus;
}

export type GameStatus = 'running' | 'won' | 'lost';

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
