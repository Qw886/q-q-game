import { BoardState } from './BoardState';
import { GridPoint, PathResult } from './GameTypes';

type Direction = 0 | 1 | 2 | 3;

interface DirectionOffset {
  readonly direction: Direction;
  readonly rowDelta: number;
  readonly columnDelta: number;
}

interface SearchState {
  readonly row: number;
  readonly column: number;
  readonly direction: Direction | null;
  readonly turns: number;
  readonly parentKey: string | null;
}

const DIRECTIONS: readonly DirectionOffset[] = [
  { direction: 0, rowDelta: -1, columnDelta: 0 },
  { direction: 1, rowDelta: 1, columnDelta: 0 },
  { direction: 2, rowDelta: 0, columnDelta: -1 },
  { direction: 3, rowDelta: 0, columnDelta: 1 },
];

const MAX_TURNS = 2;

export class LinkPathFinder {
  public findPath(board: BoardState, start: GridPoint, end: GridPoint): PathResult {
    const validationFailure = this.validateInput(board, start, end);

    if (validationFailure) {
      return this.failure(validationFailure);
    }

    return this.searchPath(board, start, end);
  }

  private validateInput(board: BoardState, start: GridPoint, end: GridPoint): string | null {
    if (board.isSamePoint(start, end)) {
      return '起点和终点不能相同';
    }

    if (!board.isInsideBoard(start) || !board.isInsideBoard(end)) {
      return '起点和终点必须在棋盘内';
    }

    const startType = board.getTileType(start);
    const endType = board.getTileType(end);

    if (!startType) {
      return '起点为空';
    }

    if (!endType) {
      return '终点为空';
    }

    if (startType !== endType) {
      return '麻将图案不同';
    }

    return null;
  }

  private searchPath(board: BoardState, start: GridPoint, end: GridPoint): PathResult {
    const expandedStart = this.toExpandedPoint(start);
    const expandedEnd = this.toExpandedPoint(end);
    const queue: SearchState[] = [];
    const states = new Map<string, SearchState>();
    const visited = new Set<string>();
    const startState: SearchState = {
      row: expandedStart.row,
      column: expandedStart.column,
      direction: null,
      turns: 0,
      parentKey: null,
    };
    const startKey = this.getStateKey(startState);

    queue.push(startState);
    states.set(startKey, startState);
    visited.add(startKey);

    let bestEndState: SearchState | null = null;

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];

      if (current.row === expandedEnd.row && current.column === expandedEnd.column) {
        if (!bestEndState || current.turns < bestEndState.turns) {
          bestEndState = current;
        }

        if (current.turns === 0) {
          break;
        }

        continue;
      }

      if (bestEndState && current.turns >= bestEndState.turns) {
        continue;
      }

      for (const offset of DIRECTIONS) {
        const nextTurns = current.direction === null || current.direction === offset.direction
          ? current.turns
          : current.turns + 1;

        if (nextTurns > MAX_TURNS) {
          continue;
        }

        const next: SearchState = {
          row: current.row + offset.rowDelta,
          column: current.column + offset.columnDelta,
          direction: offset.direction,
          turns: nextTurns,
          parentKey: this.getStateKey(current),
        };
        const boardPoint = this.toBoardPoint(next);

        if (!board.canPathEnter(boardPoint, start, end)) {
          continue;
        }

        const nextKey = this.getStateKey(next);

        if (visited.has(nextKey)) {
          continue;
        }

        visited.add(nextKey);
        states.set(nextKey, next);
        queue.push(next);
      }
    }

    if (bestEndState) {
      const expandedPath = this.restoreExpandedPath(bestEndState, states);
      const points = this.compressPath(expandedPath.map((point) => this.toBoardPoint(point)));

      return {
        connected: true,
        turns: bestEndState.turns,
        points,
      };
    }

    return this.failure('不存在两次转弯以内的连接路径');
  }

  private restoreExpandedPath(endState: SearchState, states: ReadonlyMap<string, SearchState>): GridPoint[] {
    const path: GridPoint[] = [];
    let current: SearchState | null = endState;

    while (current) {
      path.push({ row: current.row, column: current.column });
      current = current.parentKey ? states.get(current.parentKey) ?? null : null;
    }

    return path.reverse();
  }

  private compressPath(points: readonly GridPoint[]): GridPoint[] {
    if (points.length <= 2) {
      return [...points];
    }

    const compressed: GridPoint[] = [points[0]];

    // 连续共线点只保留方向变化前的点，方便后续绘制折线。
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      const sameRow = previous.row === current.row && current.row === next.row;
      const sameColumn = previous.column === current.column && current.column === next.column;

      if (!sameRow && !sameColumn) {
        compressed.push(current);
      }
    }

    compressed.push(points[points.length - 1]);

    return compressed;
  }

  private toExpandedPoint(point: GridPoint): GridPoint {
    return {
      row: point.row + 1,
      column: point.column + 1,
    };
  }

  private toBoardPoint(point: GridPoint): GridPoint {
    return {
      row: point.row - 1,
      column: point.column - 1,
    };
  }

  private getStateKey(state: SearchState): string {
    const direction = state.direction === null ? 'start' : state.direction.toString();

    return `${state.row},${state.column},${direction},${state.turns}`;
  }

  private failure(reason: string): PathResult {
    return {
      connected: false,
      turns: -1,
      points: [],
      failureReason: reason,
    };
  }
}
