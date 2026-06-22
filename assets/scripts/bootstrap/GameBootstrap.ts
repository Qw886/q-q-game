import { _decorator, Canvas, Color, Component, Graphics, isValid, Node, UITransform } from 'cc';
import { DIFFICULTIES, NORMAL_DIFFICULTY } from '../config/DifficultyConfig';
import { GameSession } from '../core/GameSession';
import { BoardView } from '../view/BoardView';
import { MainMenuController } from '../ui/MainMenuController';

const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private gameRoot: Node | null = null;
  private menuContainer: Node | null = null;
  private gameContainer: Node | null = null;
  private menuController: MainMenuController | null = null;
  private boardView: BoardView | null = null;
  private gameSession: GameSession | null = null;
  private activeScreen: 'menu' | 'game' = 'menu';
  private lastRootWidth = 0;
  private lastRootHeight = 0;

  protected start(): void {
    this.buildRootUi();
    this.showMainMenu();
  }

  protected update(deltaTime: number): void {
    const rootSize = this.getRootSize();
    const sizeChanged = rootSize.width !== this.lastRootWidth || rootSize.height !== this.lastRootHeight;

    if (sizeChanged) {
      this.rebuildForCurrentSize(rootSize.width, rootSize.height);
    }

    if (this.activeScreen === 'game') {
      this.boardView?.tick(this.getSafeDeltaTime(deltaTime));
    }
  }

  protected onDestroy(): void {
    this.gameRoot = null;
    this.menuContainer = null;
    this.gameContainer = null;
    this.menuController = null;
    this.boardView = null;
    this.gameSession = null;
  }

  private buildRootUi(): void {
    this.destroyExistingRoot();
    this.gameRoot = this.createGameRoot();
    this.createBackground();
    this.menuContainer = this.createContainer('MainMenuContainer');
    this.gameContainer = this.createContainer('GameContainer');
    this.menuController = this.menuContainer.addComponent(MainMenuController);
    this.boardView = this.gameContainer.addComponent(BoardView);

    this.gameRoot.addChild(this.menuContainer);
    this.gameRoot.addChild(this.gameContainer);
  }

  private showMainMenu(): void {
    if (!this.menuContainer || !this.gameContainer || !this.menuController) {
      return;
    }

    this.activeScreen = 'menu';
    this.boardView?.stopGame();
    this.gameSession = null;
    this.menuContainer.active = true;
    this.gameContainer.active = false;
    this.menuController.setup(DIFFICULTIES, () => this.startNormalMode());
  }

  private startNormalMode(): void {
    if (!this.menuContainer || !this.gameContainer || !this.boardView) {
      return;
    }

    try {
      this.gameSession = new GameSession(NORMAL_DIFFICULTY);
    } catch (error) {
      console.error('[Stage4] Failed to start normal mode.', error);
      this.showMainMenu();
      return;
    }

    this.activeScreen = 'game';
    this.menuContainer.active = false;
    this.gameContainer.active = true;
    this.boardView.setup(this.gameSession, () => this.showMainMenu(), () => this.restartNormalMode());
  }

  private rebuildForCurrentSize(width: number, height: number): void {
    this.lastRootWidth = width;
    this.lastRootHeight = height;
    this.updateRootSizes(width, height);

    if (this.activeScreen === 'game') {
      this.boardView?.refreshLayout();
    }
  }

  private restartNormalMode(): void {
    if (!this.boardView) {
      return;
    }

    try {
      this.gameSession = new GameSession(NORMAL_DIFFICULTY);
    } catch (error) {
      console.error('[Stage4] Failed to restart normal mode.', error);
      this.showMainMenu();
      return;
    }

    this.boardView.setup(this.gameSession, () => this.showMainMenu(), () => this.restartNormalMode());
  }

  private createGameRoot(): Node {
    const canvasNode = this.getCanvasNode();
    const root = new Node('GameRoot');
    const transform = root.addComponent(UITransform);
    const rootSize = this.getRootSize();

    transform.setContentSize(rootSize.width, rootSize.height);
    root.setPosition(0, 0, 0);
    canvasNode.addChild(root);
    this.lastRootWidth = rootSize.width;
    this.lastRootHeight = rootSize.height;

    return root;
  }

  private createContainer(name: string): Node {
    const container = new Node(name);
    const transform = container.addComponent(UITransform);
    const rootSize = this.getRootSize();

    transform.setContentSize(rootSize.width, rootSize.height);
    container.setPosition(0, 0, 0);

    return container;
  }

  private updateRootSizes(width: number, height: number): void {
    this.setNodeSize(this.gameRoot, width, height);
    this.setNodeSize(this.menuContainer, width, height);
    this.setNodeSize(this.gameContainer, width, height);
    this.redrawBackground(width, height);
  }

  private createBackground(): void {
    if (!this.gameRoot) {
      return;
    }

    const background = new Node('RuntimeBackground');
    const transform = background.addComponent(UITransform);
    const graphics = background.addComponent(Graphics);
    const rootSize = this.getRootSize();

    transform.setContentSize(rootSize.width, rootSize.height);
    graphics.fillColor = new Color(18, 54, 45, 255);
    graphics.rect(-rootSize.width / 2, -rootSize.height / 2, rootSize.width, rootSize.height);
    graphics.fill();

    this.gameRoot.addChild(background);
  }

  private redrawBackground(width: number, height: number): void {
    const background = this.gameRoot?.getChildByName('RuntimeBackground');
    const transform = background?.getComponent(UITransform);
    const graphics = background?.getComponent(Graphics);

    if (!background || !transform || !graphics) {
      return;
    }

    transform.setContentSize(width, height);
    graphics.clear();
    graphics.fillColor = new Color(18, 54, 45, 255);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
  }

  private setNodeSize(node: Node | null, width: number, height: number): void {
    const transform = node?.getComponent(UITransform);

    if (!transform) {
      return;
    }

    transform.setContentSize(width, height);
  }

  private getRootSize(): { width: number; height: number } {
    const canvasNode = this.getCanvasNode();
    const transform = canvasNode.getComponent(UITransform);
    const width = transform?.contentSize.width && transform.contentSize.width > 0 ? transform.contentSize.width : 720;
    const height = transform?.contentSize.height && transform.contentSize.height > 0 ? transform.contentSize.height : 1280;

    return { width, height };
  }

  private getCanvasNode(): Node {
    const selfCanvas = this.node.getComponent(Canvas);

    if (selfCanvas) {
      return this.node;
    }

    const parent = this.node.parent;
    const parentCanvas = parent?.getComponent(Canvas);

    if (parent && parentCanvas) {
      return parent;
    }

    return this.node;
  }

  private getSafeDeltaTime(deltaTime: number): number {
    return Math.min(0.25, Math.max(0, deltaTime));
  }

  private destroyExistingRoot(): void {
    const canvasNode = this.getCanvasNode();
    const existingRoot = canvasNode.getChildByName('GameRoot');

    this.safeDestroyNode(existingRoot);

    this.destroyRuntimeChildByName(this.node, 'RuntimeBackground');
    this.destroyRuntimeChildByName(this.node, 'MainMenuContainer');
    this.destroyRuntimeChildByName(this.node, 'GameContainer');
  }

  private destroyRuntimeChildByName(parent: Node, name: string): void {
    const child = parent.getChildByName(name);

    this.safeDestroyNode(child);
  }

  private safeDestroyNode(node: Node | null): void {
    if (!node || !isValid(node, true)) {
      return;
    }

    node.removeFromParent();
    node.destroy();
  }
}
