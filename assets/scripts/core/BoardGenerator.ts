import { getBoardDifficultyConfig } from '../config/BoardDifficultyConfig';
import { getTileTypeCounts } from '../config/TileTypeConfig';
import { BoardState } from './BoardState';
import { LinkPathFinder } from './LinkPathFinder';
import { BoardQualityEvaluator } from './BoardQualityEvaluator';
import { SeededRandom } from './SeededRandom';
import { TileAssignmentOptimizer } from './TileAssignmentOptimizer';
import type { SkeletonPair, TileAssignmentOptimizationResult } from './TileAssignmentOptimizer';
import type { BoardQualityResult } from './BoardQualityEvaluator';
import type {
  BoardDifficultyMetrics,
  BoardTile,
  DifficultyConfig,
  GeneratedBoard,
  GridPoint,
  LegalMove,
  SolutionStep,
  TileData,
} from './GameTypes';

const GEOMETRY_TILE_TYPE = '__geometry__';
const MAX_LEGAL_GEOMETRY_CANDIDATES = 16;
const MAX_GEOMETRY_RESTARTS = 28;

export class BoardGenerator {
  private readonly pathFinder = new LinkPathFinder();
  private readonly qualityEvaluator = new BoardQualityEvaluator();
  private readonly assignmentOptimizer = new TileAssignmentOptimizer();

  public generate(config: DifficultyConfig, seed: number = Date.now()): GeneratedBoard {
    this.validateConfig(config);
    const startedAt = Date.now();
    const normalizedSeed = seed >>> 0;
    const candidates: GeneratedBoardCandidate[] = [];
    const timing = this.createTimingStats();
    const maxCandidates = this.getMaxCandidateAttempts(config);
    const maxSearchRounds = this.getMaxSearchRounds(config);

    for (let roundIndex = 0; roundIndex < maxSearchRounds; roundIndex += 1) {
      const roundSeed = this.deriveSearchRoundSeed(normalizedSeed, roundIndex);

      for (let attemptIndex = 0; attemptIndex < maxCandidates; attemptIndex += 1) {
        const candidate = this.generateCandidate(config, roundSeed, attemptIndex, timing);

        if (candidate) {
          candidates.push(candidate);
        }

        const best = candidates.length > 0 ? this.selectBestCandidate(candidates) : null;
        if (best && this.isStrongCandidate(best)) {
          break;
        }

        if (Date.now() - startedAt > this.getCandidateSearchBudgetMilliseconds(config)) {
          break;
        }
      }

      const best = candidates.length > 0 ? this.selectBestCandidate(candidates) : null;
      if ((best && this.isStrongCandidate(best)) || Date.now() - startedAt > this.getCandidateSearchBudgetMilliseconds(config)) {
        break;
      }
    }

    if (candidates.length === 0) {
      throw new Error(`Failed to generate a random solvable board for difficulty: ${config.id}`);
    }

    const selected = this.selectBestCandidate(candidates);
    const totalMilliseconds = Date.now() - startedAt;

    if (!this.isStrongCandidate(selected)) {
      throw new Error(`Failed to generate accepted board for ${config.id}: ${this.formatCandidateFailureReasons(config, selected)}`);
    }

    return {
      board: selected.board,
      seed: normalizedSeed,
      tiles: this.toTileData(config, selected.board.getAllTiles()),
      solution: selected.solution,
      generationAttempts: candidates.length,
      validationPassed: selected.validationPassed,
      generationStrategy: 'SEEDED_RANDOM_SOLUTION',
      searchNodes: selected.searchNodes,
      backtrackCount: 0,
      restartCount: selected.restartCount,
      difficultyMetrics: selected.difficultyMetrics,
      difficultySelectionAttempts: candidates.length,
      generationElapsedMilliseconds: totalMilliseconds,
      skeletonElapsedMilliseconds: selected.skeletonElapsedMilliseconds,
      assignmentOptimizationElapsedMilliseconds: selected.assignmentOptimizationElapsedMilliseconds,
      optimizationIterations: selected.optimizationIterations,
    };
  }

  public validateSolution(board: BoardState, solution: readonly SolutionStep[]): boolean {
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

  private generateCandidate(
    config: DifficultyConfig,
    seed: number,
    attemptIndex: number,
    timing: GenerationTimingStats,
  ): GeneratedBoardCandidate | null {
    const candidateSeed = this.deriveCandidateSeed(seed, attemptIndex);
    const geometryRandom = new SeededRandom((candidateSeed ^ 0x9e3779b9) >>> 0);
    const skeletonStartedAt = Date.now();
    const geometry = this.createRandomGeometrySkeleton(config, geometryRandom, timing);
    timing.geometryMilliseconds += Date.now() - skeletonStartedAt;

    if (!geometry) {
      return null;
    }

    const skeletonElapsedMilliseconds = Date.now() - skeletonStartedAt;
    let best: GeneratedBoardCandidate | null = null;
    const maxAssignmentVariants = this.getAssignmentVariantAttempts(config);

    for (let assignmentIndex = 0; assignmentIndex < maxAssignmentVariants; assignmentIndex += 1) {
      const assignmentStartedAt = Date.now();
      const optimized = this.assignmentOptimizer.optimize(
        config,
        geometry.pairs,
        new SeededRandom(this.deriveAssignmentSeed(candidateSeed, assignmentIndex)),
      );
      timing.assignmentMilliseconds += Date.now() - assignmentStartedAt;
      timing.conflictBuildMilliseconds += optimized.conflictBuildMilliseconds;
      const candidate = this.createAnalyzedCandidate(
        config,
        geometry,
        optimized,
        skeletonElapsedMilliseconds,
        timing,
      );

      if (!best || this.compareCandidates(candidate, best) < 0) {
        best = candidate;
      }

      if (this.isStrongCandidate(candidate)) {
        break;
      }
    }

    return best;
  }

  private createAnalyzedCandidate(
    config: DifficultyConfig,
    geometry: GeometrySkeletonResult,
    optimized: TileAssignmentOptimizationResult,
    skeletonElapsedMilliseconds: number,
    timing: GenerationTimingStats,
  ): GeneratedBoardCandidate {
    const validationStartedAt = Date.now();
    const quality = this.qualityEvaluator.evaluate(optimized.board, optimized.solution, config);
    timing.validationMilliseconds += Date.now() - validationStartedAt;
    const openingAnalysis = this.analyzeOpeningMoves(config, quality.openingMoves);

    return {
      board: optimized.board,
      solution: optimized.solution,
      validationPassed: quality.validationPassed,
      difficultyMetrics: quality.difficultyMetrics,
      skeletonElapsedMilliseconds,
      assignmentOptimizationElapsedMilliseconds: optimized.elapsedMilliseconds,
      optimizationIterations: optimized.optimizationIterations,
      openingAnalysis,
      edgePeel: quality.edgePeel,
      quality,
      geometryAnalysis: geometry.analysis,
      searchNodes: geometry.searchNodes,
      restartCount: geometry.restartCount,
      difficultyId: config.id,
      qualityPenalty: quality.score + geometry.analysis.penalty + Math.max(0, 4 - geometry.analysis.firstTenRegionCount) * 1600,
    };
  }

  private createRandomGeometrySkeleton(
    config: DifficultyConfig,
    random: SeededRandom,
    timing: GenerationTimingStats,
  ): GeometrySkeletonResult | null {
    let bestComplete: GeometrySkeletonResult | null = null;
    let totalSearchNodes = 0;

    for (let restartIndex = 0; restartIndex < MAX_GEOMETRY_RESTARTS; restartIndex += 1) {
      const occupied = this.createFullOccupiedSet(config);
      const pairs: SkeletonPair[] = [];
      let failed = false;

      while (occupied.size > 0) {
        const board = this.createGeometryBoard(config, occupied);
        const candidatesStartedAt = Date.now();
        const candidates = this.findGeometryCandidates(config, occupied, board, pairs, random);
        timing.geometryCandidateMilliseconds += Date.now() - candidatesStartedAt;
        totalSearchNodes += candidates.length;

        if (candidates.length === 0) {
          failed = true;
          break;
        }

        const selected = this.selectGeometryCandidate(config, pairs, candidates, random);

        if (!selected) {
          failed = true;
          break;
        }

        pairs.push({
          first: selected.first,
          second: selected.second,
        });
        occupied.delete(this.getPointKey(selected.first));
        occupied.delete(this.getPointKey(selected.second));
      }

      if (failed || pairs.length !== config.tileCount / 2) {
        continue;
      }

      const analysis = this.analyzeGeometrySkeleton(config, pairs);
      const result: GeometrySkeletonResult = {
        pairs,
        analysis,
        searchNodes: totalSearchNodes,
        restartCount: restartIndex + 1,
      };

      if (!bestComplete || analysis.penalty < bestComplete.analysis.penalty) {
        bestComplete = result;
      }

      if (analysis.firstTenRegionCount >= 4 && analysis.maxConsecutiveSide <= 3) {
        return result;
      }
    }

    return bestComplete;
  }

  private findGeometryCandidates(
    config: DifficultyConfig,
    occupied: ReadonlySet<string>,
    board: BoardState,
    existingPairs: readonly SkeletonPair[],
    random: SeededRandom,
  ): GeometryCandidate[] {
    const points = random.shuffle(this.getOccupiedPoints(occupied));
    const candidates: GeometryCandidate[] = [];
    const seen = new Set<string>();
    const pairChecks = this.createLimitedPairChecks(config, points, random);
    this.collectGeometryCandidates(config, board, existingPairs, pairChecks, seen, candidates, this.getMaxPairChecks(config));

    if (candidates.length > 0) {
      return candidates;
    }

    const fallbackPairs = this.createFallbackPairChecks(points, random);
    this.collectGeometryCandidates(config, board, existingPairs, fallbackPairs, seen, candidates, Number.POSITIVE_INFINITY);

    return candidates;
  }

  private collectGeometryCandidates(
    config: DifficultyConfig,
    board: BoardState,
    existingPairs: readonly SkeletonPair[],
    pairChecks: readonly PairCheck[],
    seen: Set<string>,
    candidates: GeometryCandidate[],
    maxChecks: number,
  ): void {
    let checked = 0;

    for (const pair of pairChecks) {
      if (checked >= maxChecks || candidates.length >= MAX_LEGAL_GEOMETRY_CANDIDATES) {
        return;
      }

      const pairKey = this.getPairKey(pair.first, pair.second);

      if (seen.has(pairKey)) {
        continue;
      }

      seen.add(pairKey);
      checked += 1;

      if (!this.pathFinder.findPath(board, pair.first, pair.second).connected) {
        continue;
      }

      candidates.push(this.createGeometryCandidate(config, pair.first, pair.second, existingPairs));
    }
  }

  private createLimitedPairChecks(
    config: DifficultyConfig,
    points: readonly GridPoint[],
    random: SeededRandom,
  ): PairCheck[] {
    const checks: PairCheck[] = [];
    const pointMap = new Map(points.map((point) => [this.getPointKey(point), point]));

    for (const point of points) {
      this.addPairIfPresent(checks, point, { row: point.row, column: point.column + 1 }, pointMap);
      this.addPairIfPresent(checks, point, { row: point.row + 1, column: point.column }, pointMap);

      for (let distance = 2; distance <= 4; distance += 1) {
        this.addPairIfPresent(checks, point, { row: point.row, column: point.column + distance }, pointMap);
        this.addPairIfPresent(checks, point, { row: point.row + distance, column: point.column }, pointMap);
      }
    }

    const shuffledPoints = random.shuffle(points);
    const randomPairCount = Math.min(this.getMaxPairChecks(config), shuffledPoints.length * 2);

    for (let index = 0; index < randomPairCount; index += 1) {
      const first = shuffledPoints[index % shuffledPoints.length];
      let second = shuffledPoints[random.nextInt(shuffledPoints.length)];

      for (let retry = 0; retry < 4 && this.getPointRegion(config, first) === this.getPointRegion(config, second); retry += 1) {
        second = shuffledPoints[random.nextInt(shuffledPoints.length)];
      }

      if (!this.isSamePoint(first, second)) {
        checks.push({ first, second });
      }
    }

    return random.shuffle(checks);
  }

  private createFallbackPairChecks(points: readonly GridPoint[], random: SeededRandom): PairCheck[] {
    const shuffledPoints = random.shuffle(points);
    const checks: PairCheck[] = [];

    for (let firstIndex = 0; firstIndex < shuffledPoints.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < shuffledPoints.length; secondIndex += 1) {
        checks.push({
          first: shuffledPoints[firstIndex],
          second: shuffledPoints[secondIndex],
        });
      }
    }

    return random.shuffle(checks);
  }

  private addPairIfPresent(
    checks: PairCheck[],
    first: GridPoint,
    second: GridPoint,
    pointMap: ReadonlyMap<string, GridPoint>,
  ): void {
    const existing = pointMap.get(this.getPointKey(second));

    if (existing) {
      checks.push({ first, second: existing });
    }
  }

  private createGeometryCandidate(
    config: DifficultyConfig,
    first: GridPoint,
    second: GridPoint,
    existingPairs: readonly SkeletonPair[],
  ): GeometryCandidate {
    const region = this.getPairRegion(config, first, second);
    const side = this.getPairSide(config, first, second);
    const adjacent = this.isAdjacent(first, second);
    const internalAdjacent = this.isAdjacent(first, second) && this.isInternalPoint(config, first) && this.isInternalPoint(config, second);
    const stepIndex = existingPairs.length;
    const requiredInternalAdjacentMoves = this.getRequiredInternalAdjacentMoves(config);
    let penalty = 0;

    if (stepIndex < requiredInternalAdjacentMoves) {
      penalty += internalAdjacent ? -80 : 120;
      penalty += this.isCornerPoint(config, first) || this.isCornerPoint(config, second) ? 80 : 0;
    } else {
      penalty += adjacent ? 2000 : 0;
    }

    const previousRegion = existingPairs.length > 0 ? this.getPairRegion(config, existingPairs[existingPairs.length - 1].first, existingPairs[existingPairs.length - 1].second) : null;
    const previousSide = existingPairs.length > 0 ? this.getPairSide(config, existingPairs[existingPairs.length - 1].first, existingPairs[existingPairs.length - 1].second) : 'none';

    if (previousRegion === region) {
      penalty += 45;
    }

    if (side !== 'none' && side === previousSide) {
      penalty += 220 + this.countTrailingSide(config, existingPairs, side) * 260;
    }

    if (stepIndex < 10) {
      const seenRegions = new Set(existingPairs.slice(0, 10).map((pair) => this.getPairRegion(config, pair.first, pair.second)));
      penalty += seenRegions.has(region) ? 18 : -26;
      penalty += side === 'none' ? -30 : 36;
    }

    return {
      first,
      second,
      region,
      side,
      adjacent,
      internalAdjacent,
      penalty,
    };
  }

  private selectGeometryCandidate(
    config: DifficultyConfig,
    existingPairs: readonly SkeletonPair[],
    candidates: readonly GeometryCandidate[],
    random: SeededRandom,
  ): GeometryCandidate | null {
    const sorted = [...candidates].sort((first, second) => first.penalty - second.penalty);
    const strictCandidates = sorted.filter((candidate) => this.isAllowedGeometryStep(config, existingPairs, candidate));
    const pool = strictCandidates;

    if (pool.length === 0) {
      return null;
    }

    const topCount = Math.min(8, pool.length);

    return pool[random.nextInt(topCount)];
  }

  private isAllowedGeometryStep(
    config: DifficultyConfig,
    existingPairs: readonly SkeletonPair[],
    candidate: GeometryCandidate,
  ): boolean {
    const stepIndex = existingPairs.length;
    const requiredInternalAdjacentMoves = this.getRequiredInternalAdjacentMoves(config);

    if (stepIndex < requiredInternalAdjacentMoves) {
      const existingRegions = new Set(existingPairs.map((pair) => this.getPairRegion(config, pair.first, pair.second)));
      return candidate.internalAdjacent && !existingRegions.has(candidate.region);
    }

    if (
      candidate.adjacent
      && this.countAdjacentSkeletonPairs(existingPairs) >= getBoardDifficultyConfig(config.id).maxAdjacentMatchingMoves
    ) {
      return false;
    }

    if (candidate.side !== 'none' && this.countTrailingSide(config, existingPairs, candidate.side) >= 1) {
      return false;
    }

    if (
      candidate.side !== 'none'
      && this.countSkeletonSidePairs(config, existingPairs, candidate.side) >= this.getMaxSkeletonPairsPerSide(config)
    ) {
      return false;
    }

    return true;
  }

  private analyzeGeometrySkeleton(config: DifficultyConfig, pairs: readonly SkeletonPair[]): GeometrySkeletonAnalysis {
    const firstTen = pairs.slice(0, 10);
    const regions = firstTen.map((pair) => this.getPairRegion(config, pair.first, pair.second));
    const uniqueRegions = new Set(regions);
    const sides = pairs.map((pair) => this.getPairSide(config, pair.first, pair.second));
    const maxConsecutiveSide = this.getMaxConsecutiveSameSide(sides);
    let maxConsecutiveRegion = 0;
    let currentRegionRun = 0;
    let previousRegion: BoardRegion | null = null;

    for (const region of regions) {
      currentRegionRun = region === previousRegion ? currentRegionRun + 1 : 1;
      maxConsecutiveRegion = Math.max(maxConsecutiveRegion, currentRegionRun);
      previousRegion = region;
    }

    const penalty = Math.max(0, 4 - uniqueRegions.size) * 120
      + Math.max(0, maxConsecutiveSide - 3) * 140
      + Math.max(0, maxConsecutiveRegion - 2) * 80;

    return {
      firstTenRegions: regions,
      firstTenRegionCount: uniqueRegions.size,
      maxConsecutiveSide,
      maxConsecutiveRegion,
      penalty,
    };
  }

  private analyzeOpeningMoves(config: DifficultyConfig, moves: readonly LegalMove[]): OpeningAnalysis {
    const regionSignatures = new Map<string, number>();
    let internalAdjacentMoves = 0;

    for (const move of moves) {
      if (this.isAdjacent(move.first, move.second) && this.isInternalPoint(config, move.first) && this.isInternalPoint(config, move.second)) {
        internalAdjacentMoves += 1;
      }

      const signature = [this.getPointRegion(config, move.first), this.getPointRegion(config, move.second)].sort().join('-');
      regionSignatures.set(signature, (regionSignatures.get(signature) ?? 0) + 1);
    }

    return {
      totalMoves: moves.length,
      internalAdjacentMoves,
      signature: [...regionSignatures.entries()]
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, count]) => `${key}:${count}`)
        .join('|'),
    };
  }

  private selectBestCandidate(candidates: readonly GeneratedBoardCandidate[]): GeneratedBoardCandidate {
    let best = candidates[0];

    for (let index = 1; index < candidates.length; index += 1) {
      const candidate = candidates[index];

      if (this.compareCandidates(candidate, best) < 0) {
        best = candidate;
      }
    }

    return best;
  }

  private compareCandidates(first: GeneratedBoardCandidate, second: GeneratedBoardCandidate): number {
    const firstStrong = this.isStrongCandidate(first);
    const secondStrong = this.isStrongCandidate(second);

    if (firstStrong !== secondStrong) {
      return firstStrong ? -1 : 1;
    }

    if (first.qualityPenalty !== second.qualityPenalty) {
      return first.qualityPenalty - second.qualityPenalty;
    }

    return first.difficultyMetrics.score - second.difficultyMetrics.score;
  }

  private isStrongCandidate(candidate: GeneratedBoardCandidate): boolean {
    return candidate.quality.accepted
      && candidate.openingAnalysis.totalMoves > 0
      && candidate.geometryAnalysis.firstTenRegionCount >= 4;
  }

  private getMaxCandidateAttempts(config: DifficultyConfig): number {
    switch (config.id) {
      case 'hard':
        return 10;
      case 'medium':
        return 10;
      case 'normal':
      default:
        return 10;
    }
  }

  private getMaxSearchRounds(config: DifficultyConfig): number {
    switch (config.id) {
      case 'hard':
        return 6;
      case 'medium':
        return 5;
      case 'normal':
      default:
        return 4;
    }
  }

  private getAssignmentVariantAttempts(config: DifficultyConfig): number {
    switch (config.id) {
      case 'hard':
        return 5;
      case 'medium':
        return 3;
      case 'normal':
      default:
        return 2;
    }
  }

  private getMaxPairChecks(config: DifficultyConfig): number {
    switch (config.id) {
      case 'hard':
        return 180;
      case 'medium':
        return 140;
      case 'normal':
      default:
        return 100;
    }
  }

  private getRequiredInternalAdjacentMoves(config: Pick<DifficultyConfig, 'id'>): number {
    return Math.min(2, getBoardDifficultyConfig(config.id).maxAdjacentMatchingMoves);
  }

  private createTimingStats(): GenerationTimingStats {
    return {
      geometryMilliseconds: 0,
      geometryCandidateMilliseconds: 0,
      conflictBuildMilliseconds: 0,
      assignmentMilliseconds: 0,
      openingMovesMilliseconds: 0,
      validationMilliseconds: 0,
      edgePeelMilliseconds: 0,
    };
  }

  private formatCandidateFailureReasons(config: DifficultyConfig, candidate: GeneratedBoardCandidate): string {
    const reasons: string[] = [...candidate.quality.reasons];

    if (candidate.geometryAnalysis.firstTenRegionCount < 4) {
      reasons.push(`firstTenRegions ${candidate.geometryAnalysis.firstTenRegionCount} min 4`);
    }

    return reasons.length === 0 ? 'none' : reasons.join(';');
  }

  private getCandidateSearchBudgetMilliseconds(config: DifficultyConfig): number {
    switch (config.id) {
      case 'hard':
        return 18000;
      case 'medium':
        return 10000;
      case 'normal':
      default:
        return 5000;
    }
  }

  private deriveCandidateSeed(seed: number, attemptIndex: number): number {
    let value = (seed + Math.imul(attemptIndex + 1, 0x9e3779b9)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x85ebca6b) >>> 0;
    value ^= value >>> 13;
    value = Math.imul(value, 0xc2b2ae35) >>> 0;
    value ^= value >>> 16;

    return value >>> 0;
  }

  private deriveSearchRoundSeed(seed: number, roundIndex: number): number {
    if (roundIndex === 0) {
      return seed;
    }

    let value = (seed ^ Math.imul(roundIndex + 17, 0x45d9f3b)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x119de1f3) >>> 0;
    value ^= value >>> 15;

    return value >>> 0;
  }

  private deriveAssignmentSeed(candidateSeed: number, assignmentIndex: number): number {
    let value = (candidateSeed ^ Math.imul(assignmentIndex + 1, 0x7f4a7c15)) >>> 0;
    value ^= value >>> 15;
    value = Math.imul(value, 0x2c1b3c6d) >>> 0;
    value ^= value >>> 12;

    return value >>> 0;
  }

  private createFullOccupiedSet(config: DifficultyConfig): Set<string> {
    const occupied = new Set<string>();

    for (let row = 0; row < config.rows; row += 1) {
      for (let column = 0; column < config.columns; column += 1) {
        occupied.add(this.getPointKey({ row, column }));
      }
    }

    return occupied;
  }

  private createGeometryBoard(config: DifficultyConfig, occupied: ReadonlySet<string>): BoardState {
    const tiles: BoardTile[] = [];

    occupied.forEach((key) => {
      tiles.push({
        position: this.parsePointKey(key),
        type: GEOMETRY_TILE_TYPE,
      });
    });

    return new BoardState(config.rows, config.columns, tiles);
  }

  private getOccupiedPoints(occupied: ReadonlySet<string>): GridPoint[] {
    const points: GridPoint[] = [];

    occupied.forEach((key) => {
      points.push(this.parsePointKey(key));
    });

    return points;
  }

  private getPairKey(first: GridPoint, second: GridPoint): string {
    const firstKey = this.getPointKey(first);
    const secondKey = this.getPointKey(second);

    return firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
  }

  private getPointKey(point: GridPoint): string {
    return `${point.row},${point.column}`;
  }

  private parsePointKey(key: string): GridPoint {
    if (typeof key !== 'string') {
      throw new TypeError(`[BoardGenerator] Invalid point key type: ${typeof key}`);
    }

    const parts = key.split(',');

    if (parts.length !== 2) {
      throw new Error(`[BoardGenerator] Invalid point key: ${key}`);
    }

    const row = Number(parts[0]);
    const column = Number(parts[1]);

    if (!Number.isInteger(row) || !Number.isInteger(column)) {
      throw new Error(`[BoardGenerator] Invalid point key: ${key}`);
    }

    return { row, column };
  }

  private getMaxConsecutiveSameSide(sides: readonly PairSide[]): number {
    let maxRun = 0;
    let currentRun = 0;
    let previous: PairSide = 'none';

    for (const side of sides) {
      if (side === 'none') {
        currentRun = 0;
        previous = 'none';
        continue;
      }

      currentRun = side === previous ? currentRun + 1 : 1;
      maxRun = Math.max(maxRun, currentRun);
      previous = side;
    }

    return maxRun;
  }

  private countTrailingSide(config: DifficultyConfig, pairs: readonly SkeletonPair[], side: PairSide): number {
    let count = 0;

    for (let index = pairs.length - 1; index >= 0; index -= 1) {
      if (this.getPairSide(config, pairs[index].first, pairs[index].second) !== side) {
        break;
      }

      count += 1;
    }

    return count;
  }

  private countSkeletonSidePairs(config: DifficultyConfig, pairs: readonly SkeletonPair[], side: PairSide): number {
    return pairs.filter((pair) => this.getPairSide(config, pair.first, pair.second) === side).length;
  }

  private getMaxSkeletonPairsPerSide(config: Pick<DifficultyConfig, 'id'>): number {
    switch (config.id) {
      case 'hard':
        return 2;
      case 'medium':
        return 2;
      case 'normal':
      default:
        return 3;
    }
  }

  private countAdjacentSkeletonPairs(pairs: readonly SkeletonPair[]): number {
    return pairs.filter((pair) => this.isAdjacent(pair.first, pair.second)).length;
  }

  private getPairRegion(config: DifficultyConfig, first: GridPoint, second: GridPoint): BoardRegion {
    const midpoint = {
      row: (first.row + second.row) / 2,
      column: (first.column + second.column) / 2,
    };

    return this.getPointRegion(config, midpoint);
  }

  private getPointRegion(config: DifficultyConfig, point: GridPoint): BoardRegion {
    const rowBand = point.row < config.rows / 3 ? 'top' : point.row >= (config.rows * 2) / 3 ? 'bottom' : 'middle';
    const columnBand = point.column < config.columns / 3 ? 'Left' : point.column >= (config.columns * 2) / 3 ? 'Right' : 'Center';

    return `${rowBand}${columnBand}` as BoardRegion;
  }

  private getPairSide(config: DifficultyConfig, first: GridPoint, second: GridPoint): PairSide {
    const firstSide = this.getPointSide(config, first);
    const secondSide = this.getPointSide(config, second);

    return firstSide === secondSide ? firstSide : 'none';
  }

  private getPointSide(config: DifficultyConfig, point: GridPoint): PairSide {
    if (point.column === 0) {
      return 'left';
    }

    if (point.column === config.columns - 1) {
      return 'right';
    }

    if (point.row === 0) {
      return 'top';
    }

    if (point.row === config.rows - 1) {
      return 'bottom';
    }

    return 'none';
  }

  private isAdjacent(first: GridPoint, second: GridPoint): boolean {
    return Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;
  }

  private isSamePoint(first: GridPoint, second: GridPoint): boolean {
    return first.row === second.row && first.column === second.column;
  }

  private isInternalPoint(config: DifficultyConfig, point: GridPoint): boolean {
    return point.row > 0
      && point.row < config.rows - 1
      && point.column > 0
      && point.column < config.columns - 1;
  }

  private isCornerPoint(config: DifficultyConfig, point: GridPoint): boolean {
    return (point.row === 0 || point.row === config.rows - 1)
      && (point.column === 0 || point.column === config.columns - 1);
  }

  private toTileData(config: DifficultyConfig, tiles: readonly BoardTile[]): TileData[] {
    return tiles
      .map((tile) => ({
        id: tile.position.row * config.columns + tile.position.column,
        label: tile.type,
        type: tile.type,
        row: tile.position.row,
        column: tile.position.column,
      }))
      .sort((first, second) => first.id - second.id);
  }

  private validateConfig(config: DifficultyConfig): void {
    if (config.tileCount % 2 !== 0) {
      throw new Error(`Tile count must be even for difficulty: ${config.id}`);
    }

    if (config.rows * config.columns !== config.tileCount) {
      throw new Error(`Board size does not match tile count for difficulty: ${config.id}`);
    }

    const counts = getTileTypeCounts(config.id);
    let totalCount = 0;

    for (const [tileType, count] of Object.entries(counts)) {
      if (count <= 0 || count % 2 !== 0) {
        throw new Error(`Tile type ${tileType} must have a positive even count.`);
      }

      totalCount += count;
    }

    if (totalCount !== config.tileCount) {
      throw new Error(`Tile type total ${totalCount} does not match tile count ${config.tileCount}.`);
    }
  }
}

interface GeneratedBoardCandidate {
  readonly difficultyId: DifficultyConfig['id'];
  readonly board: BoardState;
  readonly solution: readonly SolutionStep[];
  readonly validationPassed: boolean;
  readonly difficultyMetrics: BoardDifficultyMetrics;
  readonly skeletonElapsedMilliseconds: number;
  readonly assignmentOptimizationElapsedMilliseconds: number;
  readonly optimizationIterations: number;
  readonly openingAnalysis: OpeningAnalysis;
  readonly edgePeel: EdgePeelMetrics;
  readonly quality: BoardQualityResult;
  readonly geometryAnalysis: GeometrySkeletonAnalysis;
  readonly searchNodes: number;
  readonly restartCount: number;
  readonly qualityPenalty: number;
}

interface GeometrySkeletonResult {
  readonly pairs: readonly SkeletonPair[];
  readonly analysis: GeometrySkeletonAnalysis;
  readonly searchNodes: number;
  readonly restartCount: number;
}

interface GeometryCandidate extends SkeletonPair {
  readonly region: BoardRegion;
  readonly side: PairSide;
  readonly adjacent: boolean;
  readonly internalAdjacent: boolean;
  readonly penalty: number;
}

interface GeometrySkeletonAnalysis {
  readonly firstTenRegions: readonly BoardRegion[];
  readonly firstTenRegionCount: number;
  readonly maxConsecutiveSide: number;
  readonly maxConsecutiveRegion: number;
  readonly penalty: number;
}

interface OpeningAnalysis {
  readonly totalMoves: number;
  readonly internalAdjacentMoves: number;
  readonly signature: string;
}

interface EdgePeelMetrics {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly leftSteps: readonly string[];
  readonly rightSteps: readonly string[];
  readonly topSteps: readonly string[];
  readonly bottomSteps: readonly string[];
}

interface EdgePeelSimulation {
  readonly count: number;
  readonly steps: readonly string[];
}

interface PairCheck {
  readonly first: GridPoint;
  readonly second: GridPoint;
}

interface GenerationTimingStats {
  geometryMilliseconds: number;
  geometryCandidateMilliseconds: number;
  conflictBuildMilliseconds: number;
  assignmentMilliseconds: number;
  openingMovesMilliseconds: number;
  validationMilliseconds: number;
  edgePeelMilliseconds: number;
}

type PairSide = 'left' | 'right' | 'top' | 'bottom' | 'none';
type RowBand = 'top' | 'middle' | 'bottom';
type ColumnBand = 'Left' | 'Center' | 'Right';
type BoardRegion = `${RowBand}${ColumnBand}`;
