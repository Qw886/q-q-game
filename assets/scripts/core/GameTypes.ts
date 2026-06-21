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
  readonly row: number;
  readonly column: number;
}

