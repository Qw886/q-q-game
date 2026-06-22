import { getBoardDifficultyConfig } from '../config/BoardDifficultyConfig';
import type { BoardDifficultyConfig } from '../config/BoardDifficultyConfig';
import { BoardState } from './BoardState';
import { MoveFinder } from './MoveFinder';
import type { BoardDifficultyMetrics, DifficultyConfig, GridPoint, LegalMove, SolutionStep } from './GameTypes';

export class BoardDifficultyEvaluator {
  private readonly moveFinder = new MoveFinder();

  public evaluate(board: BoardState, solution: readonly SolutionStep[], config: DifficultyConfig): BoardDifficultyMetrics {
    const legalMoves = this.moveFinder.findAllMoves(board);
    const difficultyConfig = getBoardDifficultyConfig(config.id);
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
      difficultyConfig,
    );
    const firstTenStepsAverageMoves = openingRejectionReasons.length === 0
      ? this.calculateFirstTenStepsAverageMoves(board, solution)
      : 0;
    const rejectionReasons = [...openingRejectionReasons];

    if (firstTenStepsAverageMoves > difficultyConfig.maxFirstTenAverageMoves) {
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
        difficultyConfig,
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
    difficultyConfig: BoardDifficultyConfig,
  ): string[] {
    const reasons: string[] = [];
    const singleTurnTypeRatio = this.getMaxTurnTypeRatio(totalLegalMoves, zeroTurnMoves, oneTurnMoves, twoTurnMoves);

    if (totalLegalMoves < difficultyConfig.minOpeningMoves) {
      reasons.push('opening moves below normal range');
    }

    if (totalLegalMoves > difficultyConfig.maxOpeningMoves) {
      reasons.push('opening moves above normal range');
    }

    if (adjacentMatchingMoves > difficultyConfig.maxAdjacentMatchingMoves) {
      reasons.push('too many adjacent matching moves');
    }

    if (zeroTurnMoves < difficultyConfig.minZeroTurnMoves) {
      reasons.push('missing zero-turn opening move');
    }

    if (zeroTurnMoves > difficultyConfig.maxZeroTurnMoves) {
      reasons.push('too many zero-turn opening moves');
    }

    if (
      difficultyConfig.minOneTurnMoves > 0
      && oneTurnMoves < difficultyConfig.minOneTurnMoves
    ) {
      reasons.push('missing one-turn opening moves');
    }

    if (oneTurnMoves > difficultyConfig.maxOneTurnMoves) {
      reasons.push('too many one-turn opening moves');
    }

    if (twoTurnMoves < difficultyConfig.minTwoTurnMoves) {
      reasons.push('missing two-turn opening move');
    }

    if (twoTurnMoves > difficultyConfig.maxTwoTurnMoves) {
      reasons.push('too many two-turn opening moves');
    }

    if (singleTurnTypeRatio > difficultyConfig.maxSingleTurnTypeRatio) {
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
    difficultyConfig: BoardDifficultyConfig,
  ): number {
    const openingDistance = Math.abs(totalLegalMoves - difficultyConfig.targetOpeningMoves);
    const rangePenalty = this.getRangePenalty(totalLegalMoves, difficultyConfig);
    const adjacentPenalty = Math.max(0, adjacentMatchingMoves - difficultyConfig.maxAdjacentMatchingMoves);
    const zeroTurnPenalty = this.getRangePenaltyForValue(
      zeroTurnMoves,
      difficultyConfig.minZeroTurnMoves,
      difficultyConfig.maxZeroTurnMoves,
    );
    const oneTurnPenalty = this.getRangePenaltyForValue(
      oneTurnMoves,
      difficultyConfig.minOneTurnMoves,
      difficultyConfig.maxOneTurnMoves,
    );
    const twoTurnPenalty = this.getRangePenaltyForValue(
      twoTurnMoves,
      difficultyConfig.minTwoTurnMoves,
      difficultyConfig.maxTwoTurnMoves,
    );
    const turnTargetDistance = Math.abs(zeroTurnMoves - difficultyConfig.targetZeroTurnMoves)
      + Math.abs(oneTurnMoves - difficultyConfig.targetOneTurnMoves)
      + Math.abs(twoTurnMoves - difficultyConfig.targetTwoTurnMoves);
    const singleTurnTypeRatio = this.getMaxTurnTypeRatio(totalLegalMoves, zeroTurnMoves, oneTurnMoves, twoTurnMoves);
    const singleTurnTypePenalty = Math.max(0, singleTurnTypeRatio - difficultyConfig.maxSingleTurnTypeRatio);
    const missingEasyMovePenalty = Number(zeroTurnMoves === 0);
    const missingTwoTurnPenalty = Math.max(0, difficultyConfig.minTwoTurnMoves - twoTurnMoves);
    const firstTenPenalty = Math.max(0, firstTenStepsAverageMoves - difficultyConfig.maxFirstTenAverageMoves);

    // 评分越低越接近普通模式目标，用于在没有完美候选时选择最接近目标的棋盘。
    return openingDistance * difficultyConfig.openingMoveWeight
      + rangePenalty * difficultyConfig.outOfRangeMoveWeight
      + adjacentPenalty * difficultyConfig.adjacentMoveWeight
      + (zeroTurnPenalty + oneTurnPenalty + twoTurnPenalty + turnTargetDistance) * difficultyConfig.turnDistributionWeight
      + missingEasyMovePenalty * difficultyConfig.missingEasyMoveWeight
      + singleTurnTypePenalty * difficultyConfig.singleTurnTypeRatioWeight
      + missingTwoTurnPenalty * difficultyConfig.missingTwoTurnWeight
      + firstTenPenalty * difficultyConfig.firstTenAverageWeight
      + edgeLegalMoves * difficultyConfig.edgeMoveWeight;
  }

  private getRangePenalty(totalLegalMoves: number, difficultyConfig: BoardDifficultyConfig): number {
    if (totalLegalMoves < difficultyConfig.minOpeningMoves) {
      return difficultyConfig.minOpeningMoves - totalLegalMoves;
    }

    if (totalLegalMoves > difficultyConfig.maxOpeningMoves) {
      return totalLegalMoves - difficultyConfig.maxOpeningMoves;
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
