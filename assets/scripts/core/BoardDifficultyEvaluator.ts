import { NORMAL_BOARD_DIFFICULTY_CONFIG } from '../config/BoardDifficultyConfig';
import { BoardState } from './BoardState';
import { MoveFinder } from './MoveFinder';
import type { BoardDifficultyMetrics, DifficultyConfig, GridPoint, LegalMove, SolutionStep } from './GameTypes';

export class BoardDifficultyEvaluator {
  private readonly moveFinder = new MoveFinder();

  public evaluate(board: BoardState, solution: readonly SolutionStep[], config: DifficultyConfig): BoardDifficultyMetrics {
    const legalMoves = this.moveFinder.findAllMoves(board);
    const totalLegalMoves = legalMoves.length;
    const zeroTurnMoves = legalMoves.filter((move) => move.path.turns === 0).length;
    const oneTurnMoves = legalMoves.filter((move) => move.path.turns === 1).length;
    const twoTurnMoves = legalMoves.filter((move) => move.path.turns === 2).length;
    const adjacentMatchingMoves = legalMoves.filter((move) => this.isAdjacent(move.first, move.second)).length;
    const edgeLegalMoves = legalMoves.filter((move) => this.isEdgeMove(config, move)).length;
    const openingRejectionReasons = this.getOpeningRejectionReasons(
      totalLegalMoves,
      zeroTurnMoves,
      oneTurnMoves,
      twoTurnMoves,
      adjacentMatchingMoves,
    );
    const firstTenStepsAverageMoves = openingRejectionReasons.length === 0
      ? this.calculateFirstTenStepsAverageMoves(board, solution)
      : 0;
    const rejectionReasons = [...openingRejectionReasons];

    if (firstTenStepsAverageMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxFirstTenAverageMoves) {
      rejectionReasons.push('first ten solution steps have too many choices');
    }

    return {
      totalLegalMoves,
      zeroTurnMoves,
      oneTurnMoves,
      twoTurnMoves,
      adjacentMatchingMoves,
      edgeLegalMoves,
      firstTenStepsAverageMoves,
      score: this.calculateScore(
        totalLegalMoves,
        zeroTurnMoves,
        oneTurnMoves,
        twoTurnMoves,
        adjacentMatchingMoves,
        edgeLegalMoves,
        firstTenStepsAverageMoves,
      ),
      accepted: rejectionReasons.length === 0,
      rejectionReasons,
    };
  }

  private calculateFirstTenStepsAverageMoves(board: BoardState, solution: readonly SolutionStep[]): number {
    const clone = board.clone();
    const stepsToCheck = Math.min(10, solution.length);
    let totalMoves = 0;

    for (let index = 0; index < stepsToCheck; index += 1) {
      totalMoves += this.moveFinder.findAllMoves(clone).length;
      clone.removeTiles(solution[index].first, solution[index].second);
    }

    return stepsToCheck === 0 ? 0 : totalMoves / stepsToCheck;
  }

  private getOpeningRejectionReasons(
    totalLegalMoves: number,
    zeroTurnMoves: number,
    oneTurnMoves: number,
    twoTurnMoves: number,
    adjacentMatchingMoves: number,
  ): string[] {
    const reasons: string[] = [];
    const singleTurnTypeRatio = this.getMaxTurnTypeRatio(totalLegalMoves, zeroTurnMoves, oneTurnMoves, twoTurnMoves);

    if (totalLegalMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minOpeningMoves) {
      reasons.push('opening moves below normal range');
    }

    if (totalLegalMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxOpeningMoves) {
      reasons.push('opening moves above normal range');
    }

    if (adjacentMatchingMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxAdjacentMatchingMoves) {
      reasons.push('too many adjacent matching moves');
    }

    if (zeroTurnMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minZeroTurnMoves) {
      reasons.push('missing zero-turn opening move');
    }

    if (zeroTurnMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxZeroTurnMoves) {
      reasons.push('too many zero-turn opening moves');
    }

    if (
      NORMAL_BOARD_DIFFICULTY_CONFIG.minOneTurnMoves > 0
      && oneTurnMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minOneTurnMoves
    ) {
      reasons.push('missing one-turn opening moves');
    }

    if (oneTurnMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxOneTurnMoves) {
      reasons.push('too many one-turn opening moves');
    }

    if (twoTurnMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minTwoTurnMoves) {
      reasons.push('missing two-turn opening move');
    }

    if (twoTurnMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxTwoTurnMoves) {
      reasons.push('too many two-turn opening moves');
    }

    if (singleTurnTypeRatio > NORMAL_BOARD_DIFFICULTY_CONFIG.maxSingleTurnTypeRatio) {
      reasons.push('one turn type dominates opening moves');
    }

    return reasons;
  }

  private calculateScore(
    totalLegalMoves: number,
    zeroTurnMoves: number,
    oneTurnMoves: number,
    twoTurnMoves: number,
    adjacentMatchingMoves: number,
    edgeLegalMoves: number,
    firstTenStepsAverageMoves: number,
  ): number {
    const openingDistance = Math.abs(totalLegalMoves - NORMAL_BOARD_DIFFICULTY_CONFIG.targetOpeningMoves);
    const rangePenalty = this.getRangePenalty(totalLegalMoves);
    const adjacentPenalty = Math.max(0, adjacentMatchingMoves - NORMAL_BOARD_DIFFICULTY_CONFIG.maxAdjacentMatchingMoves);
    const zeroTurnPenalty = this.getRangePenaltyForValue(
      zeroTurnMoves,
      NORMAL_BOARD_DIFFICULTY_CONFIG.minZeroTurnMoves,
      NORMAL_BOARD_DIFFICULTY_CONFIG.maxZeroTurnMoves,
    );
    const oneTurnPenalty = this.getRangePenaltyForValue(
      oneTurnMoves,
      NORMAL_BOARD_DIFFICULTY_CONFIG.minOneTurnMoves,
      NORMAL_BOARD_DIFFICULTY_CONFIG.maxOneTurnMoves,
    );
    const twoTurnPenalty = this.getRangePenaltyForValue(
      twoTurnMoves,
      NORMAL_BOARD_DIFFICULTY_CONFIG.minTwoTurnMoves,
      NORMAL_BOARD_DIFFICULTY_CONFIG.maxTwoTurnMoves,
    );
    const turnTargetDistance = Math.abs(zeroTurnMoves - NORMAL_BOARD_DIFFICULTY_CONFIG.targetZeroTurnMoves)
      + Math.abs(oneTurnMoves - NORMAL_BOARD_DIFFICULTY_CONFIG.targetOneTurnMoves)
      + Math.abs(twoTurnMoves - NORMAL_BOARD_DIFFICULTY_CONFIG.targetTwoTurnMoves);
    const singleTurnTypeRatio = this.getMaxTurnTypeRatio(totalLegalMoves, zeroTurnMoves, oneTurnMoves, twoTurnMoves);
    const singleTurnTypePenalty = Math.max(0, singleTurnTypeRatio - NORMAL_BOARD_DIFFICULTY_CONFIG.maxSingleTurnTypeRatio);
    const missingEasyMovePenalty = Number(zeroTurnMoves === 0);
    const missingTwoTurnPenalty = Math.max(0, NORMAL_BOARD_DIFFICULTY_CONFIG.minTwoTurnMoves - twoTurnMoves);
    const firstTenPenalty = Math.max(0, firstTenStepsAverageMoves - NORMAL_BOARD_DIFFICULTY_CONFIG.maxFirstTenAverageMoves);

    // 评分越低越接近普通模式目标，用于在没有完美候选时选择最接近目标的棋盘。
    return openingDistance * NORMAL_BOARD_DIFFICULTY_CONFIG.openingMoveWeight
      + rangePenalty * NORMAL_BOARD_DIFFICULTY_CONFIG.outOfRangeMoveWeight
      + adjacentPenalty * NORMAL_BOARD_DIFFICULTY_CONFIG.adjacentMoveWeight
      + (zeroTurnPenalty + oneTurnPenalty + twoTurnPenalty + turnTargetDistance) * NORMAL_BOARD_DIFFICULTY_CONFIG.turnDistributionWeight
      + missingEasyMovePenalty * NORMAL_BOARD_DIFFICULTY_CONFIG.missingEasyMoveWeight
      + singleTurnTypePenalty * NORMAL_BOARD_DIFFICULTY_CONFIG.singleTurnTypeRatioWeight
      + missingTwoTurnPenalty * NORMAL_BOARD_DIFFICULTY_CONFIG.missingTwoTurnWeight
      + firstTenPenalty * NORMAL_BOARD_DIFFICULTY_CONFIG.firstTenAverageWeight
      + edgeLegalMoves * NORMAL_BOARD_DIFFICULTY_CONFIG.edgeMoveWeight;
  }

  private getRangePenalty(totalLegalMoves: number): number {
    if (totalLegalMoves < NORMAL_BOARD_DIFFICULTY_CONFIG.minOpeningMoves) {
      return NORMAL_BOARD_DIFFICULTY_CONFIG.minOpeningMoves - totalLegalMoves;
    }

    if (totalLegalMoves > NORMAL_BOARD_DIFFICULTY_CONFIG.maxOpeningMoves) {
      return totalLegalMoves - NORMAL_BOARD_DIFFICULTY_CONFIG.maxOpeningMoves;
    }

    return 0;
  }

  private getRangePenaltyForValue(value: number, min: number, max: number): number {
    if (value < min) {
      return min - value;
    }

    if (value > max) {
      return value - max;
    }

    return 0;
  }

  private getMaxTurnTypeRatio(
    totalLegalMoves: number,
    zeroTurnMoves: number,
    oneTurnMoves: number,
    twoTurnMoves: number,
  ): number {
    if (totalLegalMoves === 0) {
      return 0;
    }

    return Math.max(zeroTurnMoves, oneTurnMoves, twoTurnMoves) / totalLegalMoves;
  }

  private isAdjacent(first: GridPoint, second: GridPoint): boolean {
    return Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;
  }

  private isEdgeMove(config: DifficultyConfig, move: LegalMove): boolean {
    return this.isEdgePoint(config, move.first) || this.isEdgePoint(config, move.second);
  }

  private isEdgePoint(config: DifficultyConfig, point: GridPoint): boolean {
    return point.row === 0
      || point.column === 0
      || point.row === config.rows - 1
      || point.column === config.columns - 1;
  }
}
