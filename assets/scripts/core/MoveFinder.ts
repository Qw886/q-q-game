import { BoardState } from './BoardState';
import { LinkPathFinder } from './LinkPathFinder';
import type { BoardTile, LegalMove } from './GameTypes';

export class MoveFinder {
  private readonly pathFinder = new LinkPathFinder();

  public findFirstMove(board: BoardState): LegalMove | null {
    const groups = this.groupTilesByType(board.getAllTiles());

    for (const [tileType, tiles] of groups.entries()) {
      for (let firstIndex = 0; firstIndex < tiles.length - 1; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < tiles.length; secondIndex += 1) {
          const path = this.pathFinder.findPath(board, tiles[firstIndex].position, tiles[secondIndex].position);

          if (path.connected) {
            return {
              first: tiles[firstIndex].position,
              second: tiles[secondIndex].position,
              tileType,
              path,
            };
          }
        }
      }
    }

    return null;
  }

  public findAllMoves(board: BoardState, maxResults?: number): LegalMove[] {
    const groups = this.groupTilesByType(board.getAllTiles());
    const moves: LegalMove[] = [];

    for (const [tileType, tiles] of groups.entries()) {
      for (let firstIndex = 0; firstIndex < tiles.length - 1; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < tiles.length; secondIndex += 1) {
          const path = this.pathFinder.findPath(board, tiles[firstIndex].position, tiles[secondIndex].position);

          if (path.connected) {
            moves.push({
              first: tiles[firstIndex].position,
              second: tiles[secondIndex].position,
              tileType,
              path,
            });

            if (maxResults !== undefined && moves.length >= maxResults) {
              return moves;
            }
          }
        }
      }
    }

    return moves;
  }

  private groupTilesByType(tiles: readonly BoardTile[]): Map<string, BoardTile[]> {
    const groups = new Map<string, BoardTile[]>();

    for (const tile of tiles) {
      const group = groups.get(tile.type) ?? [];
      group.push(tile);
      groups.set(tile.type, group);
    }

    return groups;
  }
}
