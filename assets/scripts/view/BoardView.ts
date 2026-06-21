import { _decorator, Color, Component, Graphics, Label, Node, UITransform, Vec3 } from 'cc';
import { DifficultyConfig, TileData } from '../core/GameTypes';
import { TileView } from './TileView';

const { ccclass } = _decorator;

const TILE_LABELS: readonly string[] = [
  '一万',
  '二万',
  '三万',
  '四万',
  '五万',
  '一筒',
  '二筒',
  '三筒',
  '四筒',
  '五筒',
  '一条',
  '二条',
  '三条',
  '四条',
  '五条',
  '东',
  '南',
  '西',
  '北',
  '中',
];

@ccclass('BoardView')
export class BoardView extends Component {
  private hudContainer: Node | null = null;
  private boardContainer: Node | null = null;
  private bottomContainer: Node | null = null;
  private backButtonNode: Node | null = null;
  private onBack: (() => void) | null = null;

  public setup(config: DifficultyConfig, onBack: () => void): void {
    this.clearBackButtonEvent();
    this.onBack = onBack;
    this.node.removeAllChildren();

    const rootSize = this.getRootSize();
    const layout = this.calculateLayout(rootSize.width, rootSize.height, config);

    this.createHudContainer(config, layout);
    this.createBoardContainer(config, layout);
    this.createBottomContainer(layout);
  }

  protected onDestroy(): void {
    this.clearBackButtonEvent();
  }

  private createHudContainer(config: DifficultyConfig, layout: GameLayout): void {
    this.hudContainer = new Node('HudContainer');
    const transform = this.hudContainer.addComponent(UITransform);
    transform.setContentSize(layout.width, layout.hudHeight);
    this.hudContainer.setPosition(0, layout.height / 2 - layout.hudHeight / 2, 0);

    const labelNode = new Node('StatusText');
    const labelTransform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);

    labelTransform.setContentSize(layout.width - layout.sidePadding * 2, layout.hudHeight);
    label.string = `模式：${config.name}    剩余：${config.tileCount}    分数：0    时间：${config.roundTime}`;
    label.fontSize = layout.statusFontSize;
    label.lineHeight = layout.statusFontSize + 6;
    label.color = new Color(255, 255, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    this.hudContainer.addChild(labelNode);
    this.node.addChild(this.hudContainer);
  }

  private createBoardContainer(config: DifficultyConfig, layout: GameLayout): void {
    this.boardContainer = new Node('BoardContainer');
    const containerTransform = this.boardContainer.addComponent(UITransform);
    containerTransform.setContentSize(layout.width, layout.boardAreaHeight);
    this.boardContainer.setPosition(0, layout.boardCenterY, 0);

    const boardNode = new Node('StaticBoard');
    const boardTransform = boardNode.addComponent(UITransform);
    boardTransform.setContentSize(layout.boardWidth, layout.boardHeight);
    boardNode.setPosition(0, 0, 0);

    const tiles = this.createStaticTiles(config);
    for (const tile of tiles) {
      const tileNode = new Node(`Tile_${tile.row}_${tile.column}`);
      const tileView = tileNode.addComponent(TileView);
      const x = -layout.boardWidth / 2 + layout.tileWidth / 2 + tile.column * (layout.tileWidth + layout.gap);
      const y = layout.boardHeight / 2 - layout.tileHeight / 2 - tile.row * (layout.tileHeight + layout.gap);

      tileNode.setPosition(new Vec3(x, y, 0));
      tileView.setup(tile, layout.tileWidth, layout.tileHeight);
      boardNode.addChild(tileNode);
    }

    this.boardContainer.addChild(boardNode);
    this.node.addChild(this.boardContainer);
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

  private createStaticTiles(config: DifficultyConfig): TileData[] {
    const tiles: TileData[] = [];

    // 当前阶段只做固定循环占位麻将，不做随机生成和可解性校验。
    for (let row = 0; row < config.rows; row += 1) {
      for (let column = 0; column < config.columns; column += 1) {
        const id = row * config.columns + column;
        tiles.push({
          id,
          row,
          column,
          label: TILE_LABELS[id % TILE_LABELS.length],
        });
      }
    }

    return tiles;
  }

  private handleBackButton(): void {
    if (this.onBack) {
      this.onBack();
    }
  }

  private clearBackButtonEvent(): void {
    if (this.backButtonNode && this.backButtonNode.isValid) {
      this.backButtonNode.off(Node.EventType.TOUCH_END, this.handleBackButton, this);
    }

    this.backButtonNode = null;
  }

  private createButton(text: string, width: number, height: number): Node {
    const buttonNode = new Node(text);
    const transform = buttonNode.addComponent(UITransform);
    const graphics = buttonNode.addComponent(Graphics);
    const labelNode = new Node('Label');
    const labelTransform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);

    transform.setContentSize(width, height);
    graphics.fillColor = new Color(81, 126, 94, 255);
    graphics.strokeColor = new Color(42, 72, 50, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.stroke();

    labelTransform.setContentSize(width, height);
    label.string = text;
    label.fontSize = Math.max(20, Math.floor(height * 0.42));
    label.lineHeight = label.fontSize + 4;
    label.color = new Color(255, 255, 255, 255);
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

  private calculateLayout(width: number, height: number, config: DifficultyConfig): GameLayout {
    const hudHeight = this.clamp(height * 0.1, 64, 128);
    const bottomHeight = this.clamp(height * 0.12, 76, 150);
    const boardAreaHeight = Math.max(120, height - hudHeight - bottomHeight);
    const sidePadding = this.clamp(width * 0.035, 18, 42);
    const verticalPadding = this.clamp(boardAreaHeight * 0.025, 10, 28);
    const gap = this.clamp(Math.min(width, height) * 0.007, 3, 8);
    const availableWidth = Math.max(120, width - sidePadding * 2);
    const availableHeight = Math.max(120, boardAreaHeight - verticalPadding * 2);
    const tileAspect = 3 / 4;

    // 先分别按宽度和高度推导单张牌尺寸，再取较小值，保证整盘完整显示且不与上下区域重叠。
    const widthLimitedTileWidth = (availableWidth - gap * (config.columns - 1)) / config.columns;
    const heightLimitedTileWidth = ((availableHeight - gap * (config.rows - 1)) / config.rows) * tileAspect;
    const tileWidth = Math.floor(Math.max(24, Math.min(widthLimitedTileWidth, heightLimitedTileWidth)));
    const tileHeight = Math.floor(tileWidth / tileAspect);
    const boardWidth = tileWidth * config.columns + gap * (config.columns - 1);
    const boardHeight = tileHeight * config.rows + gap * (config.rows - 1);
    const boardCenterY = -height / 2 + bottomHeight + boardAreaHeight / 2;

    return {
      width,
      height,
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
      statusFontSize: this.clamp(width * 0.035, 18, 30),
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }
}

interface GameLayout {
  readonly width: number;
  readonly height: number;
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
  readonly statusFontSize: number;
}
