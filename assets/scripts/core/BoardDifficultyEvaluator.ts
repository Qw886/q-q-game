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
      adjacentMatchingMoves,
      config.tileCount,
      difficultyConfig,
    );
    const firstTenStepsAverageMoves = this.calculateFirstTenStepsAverageMoves(board, solution);
    const rejectionReasons = [...openingRejectionReasons];

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
        config.tileCount,
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
    adjacentMatchingMoves: number,
    tileCount: number,
    difficultyConfig: BoardDifficultyConfig,
  ): string[] {
    const reasons: string[] = [];
    const openingMoveDensity = this.getOpeningMoveDensity(totalLegalMoves, tileCount);

    if (totalLegalMoves <= 0) {
      reasons.push('opening board has no legal moves');
    }

    if (openingMoveDensity < difficultyConfig.minOpeningMoveDensity) {
      reasons.push('opening move density below range');
    }

    if (openingMoveDensity > difficultyConfig.maxOpeningMoveDensity) {
      reasons.push('opening move density above range');
    }

    if (adjacentMatchingMoves > difficultyConfig.maxAdjacentMatchingMoves) {
      reasons.push('too many adjacent matching moves');
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
    tileCount: number,
    difficultyConfig: BoardDifficultyConfig,
  ): number {
    const openingMoveDensity = this.getOpeningMoveDensity(totalLegalMoves, tileCount);
    const densityTarget = (difficultyConfig.minOpeningMoveDensity + difficultyConfig.maxOpeningMoveDensity) / 2;
    const densityPenalty = this.getRangePenaltyForValue(
      openingMoveDensity,
      difficultyConfig.minOpeningMoveDensity,
      difficultyConfig.maxOpeningMoveDensity,
    );
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
    const firstTenPenalty = Math.max(0, firstTenStepsAverageMoves - difficultyConfig.maxFirstTenAverageMoves);

    // Turn counts are soft scoring only; accepted does not depend on fixed turn distribution.
    return Math.abs(openingMoveDensity - densityTarget) * 100 * difficultyConfig.openingMoveWeight
      + densityPenalty * 100 * difficultyConfig.outOfRangeMoveWeight
      + adjacentPenalty * difficultyConfig.adjacentMoveWeight
      + (zeroTurnPenalty + oneTurnPenalty + twoTurnPenalty + turnTargetDistance) * difficultyConfig.turnDistributionWeight * 0.15
      + firstTenPenalty * difficultyConfig.firstTenAverageWeight
      + edgeLegalMoves * difficultyConfig.edgeMoveWeight;
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

  private getOpeningMoveDensity(totalLegalMoves: number, tileCount: number): number {
    if (tileCount <= 0) {
      return 0;
    }

    return totalLegalMoves / (tileCount / 2);
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
