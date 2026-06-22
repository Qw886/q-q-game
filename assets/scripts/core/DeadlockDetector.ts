import { BoardState } from './BoardState';
import { MoveFinder } from './MoveFinder';

export class DeadlockDetector {
  private readonly moveFinder = new MoveFinder();

  public isDeadlocked(board: BoardState): boolean {
    if (board.getRemainingCount() === 0) {
      return false;
    }

    return this.moveFinder.findFirstMove(board) === null;
  }
}
