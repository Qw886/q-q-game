import { _decorator, Color, Component, Graphics, Label, Node, UITransform, Vec3 } from 'cc';
import { GameSession } from '../core/GameSession';
import { GameEndReason, GridPoint, TileClickResult, TileData } from '../core/GameTypes';
import { HudController } from '../ui/HudController';
import { ResultDialogController } from '../ui/ResultDialogController';
import { BoardGridMetrics, LinkLineView } from './LinkLineView';
import { TileView } from './TileView';

const { ccclass } = _decorator;

interface BoardTileBinding {
  readonly node: Node;
  readonly view: TileView;
  readonly point: GridPoint;
  readonly onClick: () => void;
}

export interface BoardViewDiagnostics {
  readonly hasSession: boolean;
  readonly tileBindingCount: number;
  readonly boardContainerChildCount: number;
  readonly failureFeedbackScheduled: boolean;
  readonly lineClearScheduled: boolean;
  readonly finishRemovalScheduled: boolean;
}

@ccclass('BoardView')
export class BoardView extends Component {
  private hudContainer: Node | null = null;
  private boardContainer: Node | null = null;
  private bottomContainer: Node | null = null;
  private resultContainer: Node | null = null;
  private boardNode: Node | null = null;
  private linkLineNode: Node | null = null;
  private linkLineView: LinkLineView | null = null;
  private hudController: HudController | null = null;
  private resultDialog: ResultDialogController | null = null;
  private backButtonNode: Node | null = null;
  private session: GameSession | null = null;
  private onBack: (() => void) | null = null;
  private onRestart: (() => void) | null = null;
  private readonly tileBindings: BoardTileBinding[] = [];
  private metrics: BoardGridMetrics | null = null;
  private failureFeedbackScheduled = false;
  private lineClearScheduled = false;
  private finishRemovalScheduled = false;
  private connectionAnimationId = 0;

  public setup(session: GameSession, onBack: () => void, onRestart: () => void): void {
    this.stopGame();
    this.session = session;
    this.onBack = onBack;
    this.onRestart = onRestart;

    this.createLayout();
    this.updateHud();
  }

  public tick(deltaSeconds: number): void {
    if (!this.session) {
      return;
    }

    const endReason = this.session.update(deltaSeconds);
    this.updateHud();

    if (endReason) {
      this.handleGameEnded(endReason);
    }
  }

  public refreshLayout(): void {
    if (!this.session) {
      return;
    }

    this.session.cancelPendingAction();
    this.setup(this.session, this.onBack ?? (() => undefined), this.onRestart ?? (() => undefined));
  }

  public stopGame(): void {
    this.cleanupDynamicState();
    this.destroyDynamicNodes();
  }

  protected onDestroy(): void {
    this.unscheduleAllCallbacks();
    this.failureFeedbackScheduled = false;
    this.lineClearScheduled = false;
    this.finishRemovalScheduled = false;
    this.connectionAnimationId += 1;
    this.session?.cancelPendingAction();
    this.clearTileEvents();
    this.clearBackButtonEvent();
    this.linkLineView?.clear();
    this.session = null;
    this.onBack = null;
    this.onRestart = null;
  }

  private createLayout(): void {
    const session = this.requireSession();
    const rootSize = this.getRootSize();
    const layout = this.calculateLayout(rootSize.width, rootSize.height, session.config.rows, session.config.columns);

    this.createHudContainer(layout);
    this.createBoardContainer(session.getTiles(), layout);
    this.createBottomContainer(layout);
    this.createResultContainer(layout);
  }

  private createHudContainer(layout: GameLayout): void {
    this.hudContainer = new Node('HudContainer');
    const transform = this.hudContainer.addComponent(UITransform);
    transform.setContentSize(layout.width, layout.hudHeight);
    this.hudContainer.setPosition(0, layout.height / 2 - layout.hudHeight / 2, 0);
    this.hudController = this.hudContainer.addComponent(HudController);
    this.hudController.setup(layout.width, layout.hudHeight);
    this.node.addChild(this.hudContainer);
  }

  private createBoardContainer(tiles: readonly TileData[], layout: GameLayout): void {
    this.boardContainer = new Node('BoardContainer');
    const containerTransform = this.boardContainer.addComponent(UITransform);
    containerTransform.setContentSize(layout.width, layout.boardAreaHeight);
    this.boardContainer.setPosition(0, layout.boardCenterY, 0);

    this.boardNode = new Node('PlayableBoard');
    const boardTransform = this.boardNode.addComponent(UITransform);
    boardTransform.setContentSize(layout.boardWidth, layout.boardHeight);
    this.boardNode.setPosition(0, 0, 0);

    this.metrics = {
      rows: layout.rows,
      columns: layout.columns,
      tileWidth: layout.tileWidth,
      tileHeight: layout.tileHeight,
      gap: layout.gap,
      boardWidth: layout.boardWidth,
      boardHeight: layout.boardHeight,
    };

    for (const tile of tiles) {
      if (!this.session?.board.hasTile(tile)) {
        continue;
      }

      this.createTile(tile, layout);
    }

    this.linkLineNode = new Node('LinkLine');
    this.linkLineView = this.linkLineNode.addComponent(LinkLineView);
    this.linkLineView.setup(layout.boardWidth, layout.boardHeight);
    this.boardNode.addChild(this.linkLineNode);

    this.boardContainer.addChild(this.boardNode);
    this.node.addChild(this.boardContainer);
  }

  private createTile(tile: TileData, layout: GameLayout): void {
    if (!this.boardNode) {
      return;
    }

    const tileNode = new Node(`Tile_${tile.row}_${tile.column}`);
    const tileView = tileNode.addComponent(TileView);
    const point = { row: tile.row, column: tile.column };
    const onClick = (): void => this.handleTileClicked(point);
    const x = -layout.boardWidth / 2 + layout.tileWidth / 2 + tile.column * (layout.tileWidth + layout.gap);
    const y = layout.boardHeight / 2 - layout.tileHeight / 2 - tile.row * (layout.tileHeight + layout.gap);

    tileNode.setPosition(new Vec3(x, y, 0));
    tileView.setup(tile, layout.tileWidth, layout.tileHeight);
    tileNode.on(Node.EventType.TOUCH_END, onClick, this);
    this.tileBindings.push({ node: tileNode, view: tileView, point, onClick });
    this.boardNode.addChild(tileNode);
  }

  private createBottomContainer(layout: GameLayout): void {
    this.bottomContainer = new Node('BottomContainer');
    const transform = this.bottomContainer.addComponent(UITransform);
    transform.setContentSize(layout.width, layout.bottomHeight);
    this.bottomContainer.setPosition(0, -layout.height / 2 + layout.bottomHeight / 2, 0);

    this.backButtonNode = this.createButton('返回菜单', layout.buttonWidth, layout.buttonHeight);
    this.backButtonNode.setPosition(0, 0, 0);
    this.backButtonNode.on(Node.EventType.TOUCH_END, this.handleBackButton, this);
    this.bottomContainer.addChild(this.backButtonNode);
    this.node.addChild(this.bottomContainer);
  }

  private createResultContainer(layout: GameLayout): void {
    this.resultContainer = new Node('ResultContainer');
    const transform = this.resultContainer.addComponent(UITransform);
    transform.setContentSize(layout.width, layout.height);
    this.resultContainer.setPosition(0, 0, 0);
    this.resultDialog = this.resultContainer.addComponent(ResultDialogController);
    this.resultContainer.active = false;
    this.node.addChild(this.resultContainer);
  }

  private handleTileClicked(point: GridPoint): void {
    if (!this.session) {
      return;
    }

    const result = this.session.handleTileClick(point);
    this.applyClickResult(result);
    this.updateHud();
  }

  private applyClickResult(result: TileClickResult): void {
    switch (result.kind) {
      case 'ignored':
        return;
      case 'selected':
        this.clearAllTileFeedback();
        this.getTileView(result.point)?.setSelected(true);
        return;
      case 'deselected':
        this.getTileView(result.point)?.clearFeedback();
        return;
      case 'typeMismatch':
        this.getTileView(result.previous)?.clearFeedback();
        this.getTileView(result.selected)?.setSelected(true);
        return;
      case 'blocked':
        this.showFailureFeedback(result.previous, result.selected);
        return;
      case 'connected':
        this.showConnectedFeedback(result);
        return;
      default:
        return;
    }
  }

  private showFailureFeedback(first: GridPoint, second: GridPoint): void {
    this.getTileView(first)?.showFailure();
    this.getTileView(second)?.showFailure();
    this.failureFeedbackScheduled = true;
    this.scheduleOnce(() => {
      this.failureFeedbackScheduled = false;
      this.getTileView(first)?.clearFeedback();
      this.getTileView(second)?.setSelected(true);
    }, 0.25);
  }

  private showConnectedFeedback(result: Extract<TileClickResult, { kind: 'connected' }>): void {
    if (!this.metrics || !this.linkLineView || !this.session) {
      return;
    }

    this.clearAllTileFeedback();
    const animationId = this.connectionAnimationId + 1;
    this.connectionAnimationId = animationId;
    this.lineClearScheduled = true;
    this.finishRemovalScheduled = true;

    this.linkLineView.drawPathAnimated(result.path.points, this.metrics, () => {
      if (animationId !== this.connectionAnimationId || !this.session) {
        return;
      }

      this.lineClearScheduled = false;
      this.getTileView(result.first)?.playRemoveAnimation();
      this.getTileView(result.second)?.playRemoveAnimation();
      this.scheduleOnce(() => {
        if (animationId !== this.connectionAnimationId) {
          return;
        }

        this.finishRemovalScheduled = false;
        this.finishPairRemoval(result.first, result.second);
      }, 0.22);
    });
  }

  private finishPairRemoval(first: GridPoint, second: GridPoint): void {
    if (!this.session) {
      return;
    }

    this.getTileView(first)?.markRemoved();
    this.getTileView(second)?.markRemoved();
    this.session.completePairRemoval(first, second);
    this.updateHud();

    if (this.session.endReason) {
      this.handleGameEnded(this.session.endReason);
    }
  }

  private handleGameEnded(reason: GameEndReason): void {
    if (!this.session || !this.resultDialog || !this.resultContainer) {
      return;
    }

    this.clearAllTileFeedback();
    this.linkLineView?.clear();
    this.resultContainer.active = true;
    this.resultDialog.show(
      this.session.getSnapshot(),
      reason,
      () => this.handleRestartButton(),
      () => this.handleBackButton(),
      this.getRootSize().width,
      this.getRootSize().height,
    );
  }

  private handleRestartButton(): void {
    if (this.onRestart) {
      this.onRestart();
    }
  }

  private handleBackButton(): void {
    const back = this.onBack;

    this.stopGame();
    if (back) {
      back();
    }
  }

  private updateHud(): void {
    if (this.session && this.hudController) {
      this.hudController.updateSnapshot(this.session.getSnapshot());
    }
  }

  private getTileView(point: GridPoint): TileView | null {
    const binding = this.tileBindings.find((item) => this.isSamePoint(item.point, point));

    return binding?.view ?? null;
  }

  private clearAllTileFeedback(): void {
    for (const binding of this.tileBindings) {
      if (binding.node.isValid && binding.node.active) {
        binding.view.clearFeedback();
      }
    }
  }

  private cleanupDynamicState(): void {
    this.unscheduleAllCallbacks();
    this.failureFeedbackScheduled = false;
    this.lineClearScheduled = false;
    this.finishRemovalScheduled = false;
    this.connectionAnimationId += 1;
    this.session?.cancelPendingAction();
    this.stopTileAnimations();
    this.clearTileEvents();
    this.clearBackButtonEvent();
    this.linkLineView?.clear();
    this.resultDialog?.hide();
  }

  public getDiagnostics(): BoardViewDiagnostics {
    return {
      hasSession: this.session !== null,
      tileBindingCount: this.tileBindings.length,
      boardContainerChildCount: this.boardContainer?.isValid ? this.boardContainer.children.length : 0,
      failureFeedbackScheduled: this.failureFeedbackScheduled,
      lineClearScheduled: this.lineClearScheduled,
      finishRemovalScheduled: this.finishRemovalScheduled,
    };
  }

  private clearTileEvents(): void {
    for (const binding of this.tileBindings) {
      if (binding.node.isValid) {
        binding.node.off(Node.EventType.TOUCH_END, binding.onClick, this);
      }
    }

    this.tileBindings.length = 0;
  }

  private stopTileAnimations(): void {
    for (const binding of this.tileBindings) {
      if (binding.node.isValid) {
        binding.view.stopAnimationsForCleanup();
      }
    }
  }

  private clearBackButtonEvent(): void {
    if (this.backButtonNode && this.backButtonNode.isValid) {
      this.backButtonNode.off(Node.EventType.TOUCH_END, this.handleBackButton, this);
    }

    this.backButtonNode = null;
  }

  private destroyDynamicNodes(): void {
    const children = [...this.node.children];

    for (const child of children) {
      if (!child.isValid) {
        continue;
      }

      child.removeFromParent();
      child.destroy();
    }

    this.tileBindings.length = 0;
    this.failureFeedbackScheduled = false;
    this.lineClearScheduled = false;
    this.finishRemovalScheduled = false;
    this.connectionAnimationId += 1;
    this.hudContainer = null;
    this.boardContainer = null;
    this.bottomContainer = null;
    this.resultContainer = null;
    this.boardNode = null;
    this.linkLineNode = null;
    this.linkLineView = null;
    this.hudController = null;
    this.resultDialog = null;
    this.backButtonNode = null;
    this.session = null;
    this.onBack = null;
    this.onRestart = null;
    this.metrics = null;
  }

  private createButton(text: string, width: number, height: number): Node {
    const buttonNode = new Node(text);
    const transform = buttonNode.addComponent(UITransform);
    const graphics = buttonNode.addComponent(Graphics);
    const labelNode = new Node('Label');
    const labelTransform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);

    transform.setContentSize(width, height);
    graphics.fillColor = new Color(0, 0, 0, 50);
    graphics.roundRect(-width / 2 + 4, -height / 2 - 4, width, height, 9);
    graphics.fill();
    graphics.fillColor = new Color(232, 219, 181, 255);
    graphics.strokeColor = new Color(55, 125, 82, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-width / 2, -height / 2, width, height, 9);
    graphics.fill();
    graphics.stroke();

    labelTransform.setContentSize(width, height);
    label.string = text;
    label.fontSize = Math.max(20, Math.floor(height * 0.42));
    label.lineHeight = label.fontSize + 4;
    label.color = new Color(45, 70, 48, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    buttonNode.addChild(labelNode);

    return buttonNode;
  }

  private getRootSize(): { width: number; height: number } {
    const transform = this.node.getComponent(UITransform);
    const width = transform?.contentSize.width ?? 720;
    const height = transform?.contentSize.height ?? 1280;

    return { width, height };
  }

  private calculateLayout(width: number, height: number, rows: number, columns: number): GameLayout {
    const hudHeight = this.clamp(height * 0.1, 64, 128);
    const bottomHeight = this.clamp(height * 0.12, 76, 150);
    const boardAreaHeight = Math.max(120, height - hudHeight - bottomHeight);
    const sidePadding = this.clamp(width * 0.035, 18, 42);
    const verticalPadding = this.clamp(boardAreaHeight * 0.025, 10, 28);
    const gap = this.clamp(Math.min(width, height) * 0.007, 3, 8);
    const availableWidth = Math.max(120, width - sidePadding * 2);
    const availableHeight = Math.max(120, boardAreaHeight - verticalPadding * 2);
    const tileAspect = 3 / 4;
    const widthLimitedTileWidth = (availableWidth - gap * (columns - 1)) / columns;
    const heightLimitedTileWidth = ((availableHeight - gap * (rows - 1)) / rows) * tileAspect;
    const tileWidth = Math.floor(Math.max(24, Math.min(widthLimitedTileWidth, heightLimitedTileWidth)));
    const tileHeight = Math.floor(tileWidth / tileAspect);
    const boardWidth = tileWidth * columns + gap * (columns - 1);
    const boardHeight = tileHeight * rows + gap * (rows - 1);
    const boardCenterY = -height / 2 + bottomHeight + boardAreaHeight / 2;

    return {
      width,
      height,
      rows,
      columns,
      hudHeight,
      bottomHeight,
      boardAreaHeight,
      boardCenterY,
      sidePadding,
      gap,
      tileWidth,
      tileHeight,
      boardWidth,
      boardHeight,
      buttonWidth: this.clamp(width * 0.34, 180, 260),
      buttonHeight: this.clamp(bottomHeight * 0.52, 48, 68),
    };
  }

  private requireSession(): GameSession {
    if (!this.session) {
      throw new Error('BoardView requires a GameSession before layout.');
    }

    return this.session;
  }

  private isSamePoint(first: GridPoint, second: GridPoint): boolean {
    return first.row === second.row && first.column === second.column;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }
}

interface GameLayout {
  readonly width: number;
  readonly height: number;
  readonly rows: number;
  readonly columns: number;
  readonly hudHeight: number;
  readonly bottomHeight: number;
  readonly boardAreaHeight: number;
  readonly boardCenterY: number;
  readonly sidePadding: number;
  readonly gap: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly buttonWidth: number;
  readonly buttonHeight: number;
}
