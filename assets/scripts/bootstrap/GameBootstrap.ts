import { _decorator, Canvas, Color, Component, Graphics, isValid, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
import { DIFFICULTIES } from '../config/DifficultyConfig';
import { GameSession } from '../core/GameSession';
import type { DifficultyConfig } from '../core/GameTypes';
import { BoardView } from '../view/BoardView';
import { MainMenuController } from '../ui/MainMenuController';

const { ccclass } = _decorator;
const MENU_BACKGROUND_PATH = 'backgrounds/menu_landscape/spriteFrame';
const GAME_BACKGROUND_PATH = 'backgrounds/game_landscape/spriteFrame';
const MENU_BACKGROUND_ASPECT_RATIO = 9 / 16;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private gameRoot: Node | null = null;
  private menuContainer: Node | null = null;
  private gameContainer: Node | null = null;
  private menuController: MainMenuController | null = null;
  private boardView: BoardView | null = null;
  private gameSession: GameSession | null = null;
  private currentDifficulty: DifficultyConfig | null = null;
  private menuBackgroundNode: Node | null = null;
  private menuBackgroundTransform: UITransform | null = null;
  private menuBackgroundSprite: Sprite | null = null;
  private menuBackgroundTime = 0;
  private gameBackgroundNode: Node | null = null;
  private gameBackgroundTransform: UITransform | null = null;
  private gameBackgroundSprite: Sprite | null = null;
  private gameBackgroundTime = 0;
  private backgroundOverlayNode: Node | null = null;
  private backgroundOverlayGraphics: Graphics | null = null;
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
      this.gameBackgroundTime += this.getSafeDeltaTime(deltaTime);
      this.updateGameBackgroundPosition();
    } else {
      this.menuBackgroundTime += this.getSafeDeltaTime(deltaTime);
      this.updateMenuBackgroundPosition();
    }
  }

  protected onDestroy(): void {
    this.cleanupCurrentGame();
    this.gameRoot = null;
    this.menuContainer = null;
    this.gameContainer = null;
    this.menuController = null;
    this.boardView = null;
    this.gameSession = null;
    this.currentDifficulty = null;
    this.menuBackgroundNode = null;
    this.menuBackgroundTransform = null;
    this.menuBackgroundSprite = null;
    this.gameBackgroundNode = null;
    this.gameBackgroundTransform = null;
    this.gameBackgroundSprite = null;
    this.backgroundOverlayNode = null;
    this.backgroundOverlayGraphics = null;
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

    this.cleanupCurrentGame();
    this.activeScreen = 'menu';
    this.menuContainer.active = true;
    this.gameContainer.active = false;
    this.updateMenuBackgroundVisibility();
    this.menuController.setup(DIFFICULTIES, (difficulty) => this.startMode(difficulty));
  }

  private startMode(difficulty: DifficultyConfig): void {
    if (!this.menuContainer || !this.gameContainer || !this.boardView) {
      return;
    }

    this.cleanupCurrentGame();

    try {
      this.currentDifficulty = difficulty;
      this.gameSession = new GameSession(difficulty);
    } catch (error) {
      console.error(`[GameBootstrap] Failed to start ${difficulty.id} mode.`, error);
      this.showMainMenu();
      return;
    }

    this.activeScreen = 'game';
    this.menuContainer.active = false;
    this.gameContainer.active = true;
    this.updateMenuBackgroundVisibility();
    this.boardView.setup(this.gameSession, () => this.showMainMenu(), () => this.restartCurrentMode());
  }

  private rebuildForCurrentSize(width: number, height: number): void {
    this.lastRootWidth = width;
    this.lastRootHeight = height;
    this.updateRootSizes(width, height);

    if (this.activeScreen === 'game') {
      this.boardView?.refreshLayout();
    }
  }

  private restartCurrentMode(): void {
    if (!this.boardView || !this.currentDifficulty) {
      return;
    }

    const difficulty = this.currentDifficulty;
    this.cleanupCurrentGame();

    try {
      this.gameSession = new GameSession(difficulty);
    } catch (error) {
      console.error(`[GameBootstrap] Failed to restart ${difficulty.id} mode.`, error);
      this.showMainMenu();
      return;
    }

    this.boardView.setup(this.gameSession, () => this.showMainMenu(), () => this.restartCurrentMode());
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
    this.drawBackground(graphics, rootSize.width, rootSize.height);
    this.createMenuBackgroundImage(background, rootSize.width, rootSize.height);
    this.createGameBackgroundImage(background, rootSize.width, rootSize.height);
    this.createBackgroundOverlay(background, rootSize.width, rootSize.height);

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
    this.drawBackground(graphics, width, height);
    this.resizeMenuBackground(width, height);
    this.resizeGameBackground(width, height);
    this.resizeBackgroundOverlay(width, height);
  }

  private drawBackground(graphics: Graphics, width: number, height: number): void {
    graphics.fillColor = new Color(13, 54, 43, 255);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();

    graphics.fillColor = new Color(8, 36, 31, 84);
    graphics.rect(-width / 2, -height / 2, width, height * 0.18);
    graphics.fill();
    graphics.rect(-width / 2, height / 2 - height * 0.16, width, height * 0.16);
    graphics.fill();

    graphics.strokeColor = new Color(29, 84, 65, 92);
    graphics.lineWidth = Math.max(2, Math.floor(Math.min(width, height) * 0.004));
    graphics.rect(-width / 2 + 18, -height / 2 + 18, width - 36, height - 36);
    graphics.stroke();
  }

  private createMenuBackgroundImage(parent: Node, width: number, height: number): void {
    const imageNode = new Node('MenuLandscapeBackground');
    const transform = imageNode.addComponent(UITransform);
    const sprite = imageNode.addComponent(Sprite);

    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    imageNode.setSiblingIndex(0);
    parent.addChild(imageNode);

    this.menuBackgroundNode = imageNode;
    this.menuBackgroundTransform = transform;
    this.menuBackgroundSprite = sprite;
    this.resizeMenuBackground(width, height);
    this.updateMenuBackgroundVisibility();

    resources.load(MENU_BACKGROUND_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !this.menuBackgroundSprite?.isValid) {
        console.warn(`[GameBootstrap] Menu background image is unavailable: resources/${MENU_BACKGROUND_PATH}.`);
        return;
      }

      this.menuBackgroundSprite.spriteFrame = spriteFrame;
      this.menuBackgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.resizeMenuBackground(this.lastRootWidth, this.lastRootHeight);
    });
  }

  private createGameBackgroundImage(parent: Node, width: number, height: number): void {
    const imageNode = new Node('GameLandscapeBackground');
    const transform = imageNode.addComponent(UITransform);
    const sprite = imageNode.addComponent(Sprite);

    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    parent.addChild(imageNode);

    this.gameBackgroundNode = imageNode;
    this.gameBackgroundTransform = transform;
    this.gameBackgroundSprite = sprite;
    this.resizeGameBackground(width, height);
    this.updateMenuBackgroundVisibility();

    resources.load(GAME_BACKGROUND_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !this.gameBackgroundSprite?.isValid) {
        console.warn(`[GameBootstrap] Game background image is unavailable: resources/${GAME_BACKGROUND_PATH}.`);
        return;
      }

      this.gameBackgroundSprite.spriteFrame = spriteFrame;
      this.gameBackgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.resizeGameBackground(this.lastRootWidth, this.lastRootHeight);
    });
  }

  private createBackgroundOverlay(parent: Node, width: number, height: number): void {
    const overlayNode = new Node('BackgroundReadabilityOverlay');
    const transform = overlayNode.addComponent(UITransform);
    const graphics = overlayNode.addComponent(Graphics);

    transform.setContentSize(width, height);
    parent.addChild(overlayNode);
    this.backgroundOverlayNode = overlayNode;
    this.backgroundOverlayGraphics = graphics;
    this.drawBackgroundOverlay(graphics, width, height);
  }

  private resizeMenuBackground(width: number, height: number): void {
    if (!this.menuBackgroundNode || !this.menuBackgroundTransform) {
      return;
    }

    const coverByWidthHeight = width / MENU_BACKGROUND_ASPECT_RATIO;
    const coverByHeightWidth = height * MENU_BACKGROUND_ASPECT_RATIO;
    const imageWidth = Math.max(width, coverByHeightWidth) * 1.08;
    const imageHeight = Math.max(height, coverByWidthHeight) * 1.08;

    this.menuBackgroundTransform.setContentSize(imageWidth, imageHeight);
    this.updateMenuBackgroundPosition();
  }

  private resizeGameBackground(width: number, height: number): void {
    if (!this.gameBackgroundNode || !this.gameBackgroundTransform) {
      return;
    }

    const coverByWidthHeight = width / MENU_BACKGROUND_ASPECT_RATIO;
    const coverByHeightWidth = height * MENU_BACKGROUND_ASPECT_RATIO;
    const imageWidth = Math.max(width, coverByHeightWidth) * 1.05;
    const imageHeight = Math.max(height, coverByWidthHeight) * 1.05;

    this.gameBackgroundTransform.setContentSize(imageWidth, imageHeight);
    this.updateGameBackgroundPosition();
  }

  private resizeBackgroundOverlay(width: number, height: number): void {
    const transform = this.backgroundOverlayNode?.getComponent(UITransform);

    if (!transform || !this.backgroundOverlayGraphics) {
      return;
    }

    transform.setContentSize(width, height);
    this.drawBackgroundOverlay(this.backgroundOverlayGraphics, width, height);
  }

  private drawBackgroundOverlay(graphics: Graphics, width: number, height: number): void {
    graphics.clear();

    graphics.fillColor = new Color(2, 20, 17, 88);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();

    graphics.fillColor = new Color(4, 24, 20, 92);
    graphics.rect(-width / 2, height / 2 - height * 0.22, width, height * 0.22);
    graphics.fill();

    graphics.fillColor = new Color(4, 20, 17, 104);
    graphics.rect(-width / 2, -height / 2, width, height * 0.16);
    graphics.fill();
  }

  private updateMenuBackgroundVisibility(): void {
    if (this.menuBackgroundNode?.isValid) {
      this.menuBackgroundNode.active = this.activeScreen === 'menu';
    }

    if (this.gameBackgroundNode?.isValid) {
      this.gameBackgroundNode.active = this.activeScreen === 'game';
    }
  }

  private updateMenuBackgroundPosition(): void {
    if (!this.menuBackgroundNode || !this.menuBackgroundTransform) {
      return;
    }

    const driftRange = Math.min(34, this.menuBackgroundTransform.contentSize.height * 0.018);
    const y = Math.sin(this.menuBackgroundTime * 0.18) * driftRange;
    this.menuBackgroundNode.setPosition(0, y, 0);
  }

  private updateGameBackgroundPosition(): void {
    if (!this.gameBackgroundNode || !this.gameBackgroundTransform) {
      return;
    }

    const driftRange = Math.min(18, this.gameBackgroundTransform.contentSize.height * 0.008);
    const y = Math.sin(this.gameBackgroundTime * 0.12) * driftRange;
    this.gameBackgroundNode.setPosition(0, y, 0);
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

  private cleanupCurrentGame(): void {
    this.boardView?.stopGame();
    this.gameSession = null;
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
