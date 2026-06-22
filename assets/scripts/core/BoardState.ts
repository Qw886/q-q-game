import type { BoardTile, GridPoint } from './GameTypes';

export class BoardState {
  public readonly rows: number;
  public readonly columns: number;
  private readonly tilesByPosition: Map<string, string>;

  public constructor(rows: number, columns: number, tiles: readonly BoardTile[]) {
    if (rows <= 0 || columns <= 0) {
      throw new Error('Board size must be positive.');
    }

    this.rows = rows;
    this.columns = columns;
    this.tilesByPosition = new Map<string, string>();

    for (const tile of tiles) {
      this.setInitialTile(tile);
    }
  }

  public getTileType(point: GridPoint): string | null {
    return this.tilesByPosition.get(this.getKey(point)) ?? null;
  }

  public hasTile(point: GridPoint): boolean {
    return this.tilesByPosition.has(this.getKey(point));
  }

  public removeTile(point: GridPoint): void {
    this.tilesByPosition.delete(this.getKey(point));
  }

  public removeTiles(first: GridPoint, second: GridPoint): void {
    this.removeTile(first);
    this.removeTile(second);
  }

  public getRemainingCount(): number {
    return this.tilesByPosition.size;
  }

  public getAllTiles(): BoardTile[] {
    const tiles: BoardTile[] = [];

    for (const [key, type] of this.tilesByPosition.entries()) {
      const [rowText, columnText] = key.split(',');
      tiles.push({
        position: {
          row: Number(rowText),
          column: Number(columnText),
        },
        type,
      });
    }

    return tiles;
  }

  public clone(): BoardState {
    return new BoardState(this.rows, this.columns, this.getAllTiles());
  }

  public isInsideBoard(point: GridPoint): boolean {
    return point.row >= 0 && point.row < this.rows && point.column >= 0 && point.column < this.columns;
  }

  public canPathEnter(point: GridPoint, start: GridPoint, end: GridPoint): boolean {
    if (!this.isInsideSearchArea(point)) {
      return false;
    }

    if (this.isSamePoint(point, start) || this.isSamePoint(point, end)) {
      return true;
    }

    // 外围虚拟空白区和棋盘内已消除空位都可通行；其他未消除麻将不可通行。
    if (!this.isInsideBoard(point)) {
      return true;
    }

    return !this.hasTile(point);
  }

  public isSamePoint(first: GridPoint, second: GridPoint): boolean {
    return first.row === second.row && first.column === second.column;
  }

  private setInitialTile(tile: BoardTile): void {
    if (!this.isInsideBoard(tile.position)) {
      throw new Error(`Tile is outside board: ${tile.position.row},${tile.position.column}`);
    }

    if (tile.type.length === 0) {
      throw new Error('Tile type cannot be empty.');
    }

    const key = this.getKey(tile.position);

    if (this.tilesByPosition.has(key)) {
      throw new Error(`Duplicate tile at: ${tile.position.row},${tile.position.column}`);
    }

    this.tilesByPosition.set(key, tile.type);
  }

  private isInsideSearchArea(point: GridPoint): boolean {
    return point.row >= -1 && point.row <= this.rows && point.column >= -1 && point.column <= this.columns;
  }

  private getKey(point: GridPoint): string {
    return `${point.row},${point.column}`;
  }
}
