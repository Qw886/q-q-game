import { _decorator, Component } from 'cc';
import { BoardState } from '../core/BoardState';
import { GridPoint, PathResult } from '../core/GameTypes';
import { LinkPathFinder } from '../core/LinkPathFinder';

const { ccclass } = _decorator;

interface DebugTestCase {
  readonly name: string;
  readonly board: BoardState;
  readonly start: GridPoint;
  readonly end: GridPoint;
  readonly expectedConnected: boolean;
  readonly expectedTurns?: number;
  readonly expectedPointCount?: number;
  readonly expectedFailureReason?: string;
}

@ccclass('LinkPathFinderDebugRunner')
export class LinkPathFinderDebugRunner extends Component {
  private readonly pathFinder = new LinkPathFinder();

  protected start(): void {
    this.runTests();
  }

  private runTests(): void {
    const tests = this.createTests();
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      const result = this.pathFinder.findPath(test.board, test.start, test.end);

      if (this.isResultExpected(result, test)) {
        passed += 1;
        console.log(`PASS：${test.name}`);
      } else {
        failed += 1;
        console.warn(
          [
            `FAIL：${test.name}`,
            `棋盘：\n${this.renderBoard(test)}`,
            `预期：${this.describeExpected(test)}`,
            `实际：${JSON.stringify(result)}`,
            `实际路径：${this.formatPath(result.points)}`,
          ].join('\n'),
        );
      }
    }

    console.log(`LinkPathFinder测试完成：通过 ${passed}，失败 ${failed}`);
  }

  private createTests(): DebugTestCase[] {
    return [
      {
        name: '相邻麻将，0次转弯',
        board: this.createBoard(2, 2, [[0, 0, 'A'], [0, 1, 'A']]),
        start: { row: 0, column: 0 },
        end: { row: 0, column: 1 },
        expectedConnected: true,
        expectedTurns: 0,
        expectedPointCount: 2,
      },
      {
        name: '同一行无障碍，0次转弯',
        board: this.createBoard(3, 5, [[1, 0, 'A'], [1, 4, 'A']]),
        start: { row: 1, column: 0 },
        end: { row: 1, column: 4 },
        expectedConnected: true,
        expectedTurns: 0,
        expectedPointCount: 2,
      },
      {
        name: '同一列无障碍，0次转弯',
        board: this.createBoard(5, 3, [[0, 1, 'A'], [4, 1, 'A']]),
        start: { row: 0, column: 1 },
        end: { row: 4, column: 1 },
        expectedConnected: true,
        expectedTurns: 0,
        expectedPointCount: 2,
      },
      {
        name: '一次转弯可以连接',
        board: this.createBoard(4, 4, [[0, 0, 'A'], [2, 2, 'A']]),
        start: { row: 0, column: 0 },
        end: { row: 2, column: 2 },
        expectedConnected: true,
        expectedTurns: 1,
        expectedPointCount: 3,
      },
      {
        name: '两次转弯可以连接',
        board: this.createBoard(4, 5, [[2, 1, 'A'], [2, 3, 'A'], [2, 2, 'B']]),
        start: { row: 2, column: 1 },
        end: { row: 2, column: 3 },
        expectedConnected: true,
        expectedTurns: 2,
        expectedPointCount: 4,
      },
      {
        name: '只能从棋盘外围绕行时可以连接',
        board: this.createBoard(3, 4, [
          [0, 0, 'A'],
          [0, 3, 'A'],
          [0, 1, 'B'],
          [0, 2, 'B'],
        ]),
        start: { row: 0, column: 0 },
        end: { row: 0, column: 3 },
        expectedConnected: true,
        expectedTurns: 2,
        expectedPointCount: 4,
      },
      {
        name: '中间被其他麻将完全阻挡时失败',
        board: this.createBoard(5, 5, [
          [2, 1, 'A'],
          [2, 3, 'A'],
          [1, 1, 'B'],
          [2, 0, 'B'],
          [2, 2, 'B'],
          [3, 1, 'B'],
          [1, 3, 'B'],
          [2, 4, 'B'],
          [3, 3, 'B'],
        ]),
        start: { row: 2, column: 1 },
        end: { row: 2, column: 3 },
        expectedConnected: false,
      },
      {
        name: '必须转弯3次时失败',
        board: this.createBoard(5, 6, [
          [0, 0, 'B'],
          [1, 1, 'A'],
          [0, 1, 'B'],
          [0, 2, 'B'],
          [0, 3, 'B'],
          [0, 4, 'B'],
          [0, 5, 'B'],
          [1, 0, 'B'],
          [1, 3, 'B'],
          [1, 4, 'B'],
          [1, 5, 'B'],
          [2, 0, 'B'],
          [2, 1, 'B'],
          [2, 4, 'B'],
          [2, 5, 'B'],
          [3, 0, 'B'],
          [3, 1, 'B'],
          [3, 2, 'B'],
          [3, 4, 'A'],
          [3, 5, 'B'],
          [4, 0, 'B'],
          [4, 1, 'B'],
          [4, 2, 'B'],
          [4, 3, 'B'],
          [4, 4, 'B'],
          [4, 5, 'B'],
        ]),
        start: { row: 1, column: 1 },
        end: { row: 3, column: 4 },
        expectedConnected: false,
        expectedFailureReason: '不存在两次转弯以内的连接路径',
      },
      {
        name: '图案不同失败',
        board: this.createBoard(2, 2, [[0, 0, 'A'], [0, 1, 'B']]),
        start: { row: 0, column: 0 },
        end: { row: 0, column: 1 },
        expectedConnected: false,
      },
      {
        name: '起点为空失败',
        board: this.createBoard(2, 2, [[0, 1, 'A']]),
        start: { row: 0, column: 0 },
        end: { row: 0, column: 1 },
        expectedConnected: false,
      },
      {
        name: '终点为空失败',
        board: this.createBoard(2, 2, [[0, 0, 'A']]),
        start: { row: 0, column: 0 },
        end: { row: 0, column: 1 },
        expectedConnected: false,
      },
      {
        name: '起点和终点相同失败',
        board: this.createBoard(2, 2, [[0, 0, 'A']]),
        start: { row: 0, column: 0 },
        end: { row: 0, column: 0 },
        expectedConnected: false,
      },
      {
        name: '左上角和右下角边界可以连接',
        board: this.createBoard(4, 4, [[0, 0, 'A'], [3, 3, 'A']]),
        start: { row: 0, column: 0 },
        end: { row: 3, column: 3 },
        expectedConnected: true,
        expectedTurns: 1,
        expectedPointCount: 3,
      },
      {
        name: '搜索失败时不能死循环',
        board: this.createBoard(5, 5, [
          [2, 1, 'A'],
          [2, 3, 'A'],
          [1, 1, 'B'],
          [2, 0, 'B'],
          [2, 2, 'B'],
          [3, 1, 'B'],
          [1, 3, 'B'],
          [2, 4, 'B'],
          [3, 3, 'B'],
        ]),
        start: { row: 2, column: 1 },
        end: { row: 2, column: 3 },
        expectedConnected: false,
      },
      {
        name: '返回路径不能包含多余共线点',
        board: this.createBoard(1, 5, [[0, 0, 'A'], [0, 4, 'A']]),
        start: { row: 0, column: 0 },
        end: { row: 0, column: 4 },
        expectedConnected: true,
        expectedTurns: 0,
        expectedPointCount: 2,
      },
    ];
  }

  private isResultExpected(result: PathResult, test: DebugTestCase): boolean {
    if (result.connected !== test.expectedConnected) {
      return false;
    }

    if (!result.connected) {
      return test.expectedFailureReason === undefined
        || result.failureReason === test.expectedFailureReason;
    }

    if (test.expectedTurns !== undefined && result.turns !== test.expectedTurns) {
      return false;
    }

    if (test.expectedPointCount !== undefined && result.points.length !== test.expectedPointCount) {
      return false;
    }

    return true;
  }

  private renderBoard(test: DebugTestCase): string {
    const rows: string[] = [];

    for (let row = 0; row < test.board.rows; row += 1) {
      let line = '';

      for (let column = 0; column < test.board.columns; column += 1) {
        const point = { row, column };

        if (test.board.isSamePoint(point, test.start)) {
          line += 'S';
        } else if (test.board.isSamePoint(point, test.end)) {
          line += 'E';
        } else if (test.board.hasTile(point)) {
          line += 'X';
        } else {
          line += '.';
        }
      }

      rows.push(line);
    }

    return rows.join('\n');
  }

  private describeExpected(test: DebugTestCase): string {
    if (!test.expectedConnected) {
      return `connected=false, failureReason=${test.expectedFailureReason ?? '任意失败原因'}`;
    }

    return `connected=true, turns=${test.expectedTurns ?? '不检查'}, pointCount=${test.expectedPointCount ?? '不检查'}`;
  }

  private formatPath(points: readonly GridPoint[]): string {
    if (points.length === 0) {
      return '[]';
    }

    return points.map((point) => `(${point.row},${point.column})`).join(' -> ');
  }

  private createBoard(rows: number, columns: number, tileData: readonly TestTileData[]): BoardState {
    return new BoardState(
      rows,
      columns,
      tileData.map((tile) => ({
        position: { row: tile[0], column: tile[1] },
        type: tile[2],
      })),
    );
  }
}

type TestTileData = readonly [row: number, column: number, type: string];
