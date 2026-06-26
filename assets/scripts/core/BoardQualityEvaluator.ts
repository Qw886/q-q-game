import { getBoardDifficultyConfig } from '../config/BoardDifficultyConfig';
import { BoardDifficultyEvaluator } from './BoardDifficultyEvaluator';
import { BoardState } from './BoardState';
import { LinkPathFinder } from './LinkPathFinder';
import { MoveFinder } from './MoveFinder';
import type { BoardDifficultyMetrics, DifficultyConfig, GridPoint, LegalMove, SolutionStep } from './GameTypes';

const MAX_EDGE_PEEL_STEPS_TO_SIMULATE = 8;
const MAX_ALLOWED_EDGE_PEEL = 4;

export interface BoardQualityResult {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly validationPassed: boolean;
  readonly difficultyMetrics: BoardDifficultyMetrics;
  readonly openingMoves: readonly LegalMove[];
  readonly edgePeel: EdgePeelMetrics;
  readonly score: number;
}

export interface EdgePeelMetrics {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly leftSteps: readonly string[];
  readonly rightSteps: readonly string[];
  readonly topSteps: readonly string[];
  readonly bottomSteps: readonly string[];
}

export class BoardQualityEvaluator {
  private readonly difficultyEvaluator = new BoardDifficultyEvaluator();
  private readonly pathFinder = new LinkPathFinder();
  private readonly moveFinder = new MoveFinder();

  public evaluate(board: BoardState, solution: readonly SolutionStep[], config: DifficultyConfig): BoardQualityResult {
    const validationPassed = this.validateSolution(board, solution);
    const difficultyMetrics = this.difficultyEvaluator.evaluate(board, solution, config);
    const openingMoves = this.moveFinder.findAllMoves(board);
    const edgePeel = this.evaluateEdgePeel(board);
    const reasons = this.getRejectionReasons(board, config, validationPassed, difficultyMetrics, openingMoves, edgePeel);

    return {
      accepted: reasons.length === 0,
      reasons,
      validationPassed,
      difficultyMetrics,
      openingMoves,
      edgePeel,
      score: this.calculateScore(config, difficultyMetrics, edgePeel, reasons),
    };
  }

  public getMaxEdgePeel(metrics: EdgePeelMetrics): number {
    return Math.max(metrics.left, metrics.right, metrics.top, metrics.bottom);
  }

  private validateSolution(board: BoardState, solution: readonly SolutionStep[]): boolean {
    const clone = board.clone();

    for (const step of solution) {
      const firstType = clone.getTileType(step.first);
      const secondType = clone.getTileType(step.second);

      if (firstType !== step.tileType || secondType !== step.tileType) {
        return false;
      }

      const path = this.pathFinder.findPath(clone, step.first, step.second);

      if (!path.connected) {
        return false;
      }

      clone.removeTiles(step.first, step.second);
    }

    return clone.getRemainingCount() === 0;
  }

  private getRejectionReasons(
    board: BoardState,
    config: DifficultyConfig,
    validationPassed: boolean,
    metrics: BoardDifficultyMetrics,
    openingMoves: readonly LegalMove[],
    edgePeel: EdgePeelMetrics,
  ): string[] {
    const reasons: string[] = [];
    const difficultyConfig = getBoardDifficultyConfig(config.id);
    const openingMoveDensity = metrics.totalLegalMoves / (config.tileCount / 2);
    const maxEdgePeel = this.getMaxEdgePeel(edgePeel);

    if (!validationPassed) {
      reasons.push('validateSolution=false');
    }

    if (board.getRemainingCount() !== config.tileCount) {
      reasons.push(`tileCount ${board.getRemainingCount()} expected ${config.tileCount}`);
    }

    if (openingMoves.length === 0) {
      reasons.push('openingMoves has no legal move');
    }

    if (
      openingMoveDensity < difficultyConfig.minOpeningMoveDensity
      || openingMoveDensity > difficultyConfig.maxOpeningMoveDensity
    ) {
      reasons.push(`openingMoveDensity ${openingMoveDensity.toFixed(3)} expected ${difficultyConfig.minOpeningMoveDensity}-${difficultyConfig.maxOpeningMoveDensity}`);
    }

    if (metrics.adjacentMatchingMoves > difficultyConfig.maxAdjacentMatchingMoves) {
      reasons.push(`adjacentMatchingMoves ${metrics.adjacentMatchingMoves} max ${difficultyConfig.maxAdjacentMatchingMoves}`);
    }

    if (maxEdgePeel > MAX_ALLOWED_EDGE_PEEL) {
      reasons.push(`edgePeel ${maxEdgePeel} max ${MAX_ALLOWED_EDGE_PEEL}`);
    }

    return reasons;
  }

  private calculateScore(
    config: DifficultyConfig,
    metrics: BoardDifficultyMetrics,
    edgePeel: EdgePeelMetrics,
    reasons: readonly string[],
  ): number {
    const difficultyConfig = getBoardDifficultyConfig(config.id);
    const openingMoveDensity = metrics.totalLegalMoves / (config.tileCount / 2);
    const densityOverflow = Math.max(0, openingMoveDensity - difficultyConfig.maxOpeningMoveDensity);
    const densityUnderflow = Math.max(0, difficultyConfig.minOpeningMoveDensity - openingMoveDensity);
    const adjacentOverflow = Math.max(0, metrics.adjacentMatchingMoves - difficultyConfig.maxAdjacentMatchingMoves);
    const edgeOverflow = Math.max(0, this.getMaxEdgePeel(edgePeel) - MAX_ALLOWED_EDGE_PEEL);
    const edgePeelPenalty = this.getMaxEdgePeel(edgePeel);

    return metrics.score
      + densityOverflow * 120000
      + densityUnderflow * 6000
      + adjacentOverflow * 12000
      + edgeOverflow * 90000
      + edgePeelPenalty * 2400
      + reasons.length * 20000;
  }

  private evaluateEdgePeel(board: BoardState): EdgePeelMetrics {
    const left = this.simulateEdgePeel(board, 'left');
    const right = this.simulateEdgePeel(board, 'right');
    const top = this.simulateEdgePeel(board, 'top');
    const bottom = this.simulateEdgePeel(board, 'bottom');

    return {
      left: left.count,
      right: right.count,
      top: top.count,
      bottom: bottom.count,
      leftSteps: left.steps,
      rightSteps: right.steps,
      topSteps: top.steps,
      bottomSteps: bottom.steps,
    };
  }

  private simulateEdgePeel(board: BoardState, side: EdgeSide): EdgePeelSimulation {
    const clone = board.clone();
    const steps: string[] = [];
    let previousMove: LegalMove | null = null;

    for (let step = 0; step < MAX_EDGE_PEEL_STEPS_TO_SIMULATE; step += 1) {
      const sideMove = this.findNextSidePeelMove(clone, side, previousMove);

      if (!sideMove) {
        break;
      }

      clone.removeTiles(sideMove.first, sideMove.second);
      steps.push(this.formatMove(sideMove));
      previousMove = sideMove;

      if (steps.length > MAX_ALLOWED_EDGE_PEEL) {
        break;
      }
    }

    return { count: steps.length, steps };
  }

  private findNextSidePeelMove(board: BoardState, side: EdgeSide, previousMove: LegalMove | null): LegalMove | null {
    const moves = this.moveFinder.findAllMoves(board);

    for (const move of moves) {
      if (!this.isOuterLayerMove(board, move, side)) {
        continue;
      }

      if (previousMove && !this.isContinuousAlongSide(previousMove, move, side)) {
        continue;
      }

      return move;
    }

    return null;
  }

  private isOuterLayerMove(board: BoardState, move: LegalMove, side: EdgeSide): boolean {
    const bounds = this.getOccupiedBounds(board);

    if (!bounds) {
      return false;
    }

    const points = [move.first, move.second];

    return points.every((point) => {
      switch (side) {
        case 'left':
          return point.column === bounds.minColumn;
        case 'right':
          return point.column === bounds.maxColumn;
        case 'top':
          return point.row === bounds.minRow;
        case 'bottom':
          return point.row === bounds.maxRow;
      }
    });
  }

  private isContinuousAlongSide(previous: LegalMove, current: LegalMove, side: EdgeSide): boolean {
    const previousRange = this.getSideAxisRange(previous, side);
    const currentRange = this.getSideAxisRange(current, side);

    return currentRange.min <= previousRange.max + 1 && previousRange.min <= currentRange.max + 1;
  }

  private getSideAxisRange(move: LegalMove, side: EdgeSide): { readonly min: number; readonly max: number } {
    const values = side === 'left' || side === 'right'
      ? [move.first.row, move.second.row]
      : [move.first.column, move.second.column];

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  private getOccupiedBounds(board: BoardState): OccupiedBounds | null {
    const tiles = board.getAllTiles();

    if (tiles.length === 0) {
      return null;
    }

    let minRow = Infinity;
    let maxRow = -Infinity;
    let minColumn = Infinity;
    let maxColumn = -Infinity;

    for (const tile of tiles) {
      minRow = Math.min(minRow, tile.position.row);
      maxRow = Math.max(maxRow, tile.position.row);
      minColumn = Math.min(minColumn, tile.position.column);
      maxColumn = Math.max(maxColumn, tile.position.column);
    }

    return {
      minRow,
      maxRow,
      minColumn,
      maxColumn,
    };
  }

  private formatMove(move: LegalMove): string {
    return `(${move.first.row},${move.first.column})-(${move.second.row},${move.second.column})`;
  }
}

interface OccupiedBounds {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minColumn: number;
  readonly maxColumn: number;
}

interface EdgePeelSimulation {
  readonly count: number;
  readonly steps: readonly string[];
}

type EdgeSide = 'left' | 'right' | 'top' | 'bottom';
