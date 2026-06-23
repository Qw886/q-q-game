import { _decorator, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { getTileDisplayInfo, TILE_BACKGROUND_PATH, validateTileDisplayMappings } from '../config/TileDisplayConfig';
import type { TileData } from '../core/GameTypes';
import { TileSpriteFrameCache } from './TileSpriteFrameCache';

const { ccclass } = _decorator;

@ccclass('TileView')
export class TileView extends Component {
  private readonly backgroundColor = new Color(248, 239, 211, 255);
  private readonly borderColor = new Color(126, 91, 43, 255);
  private readonly selectedBorderColor = new Color(76, 210, 124, 255);
  private readonly failureBorderColor = new Color(231, 82, 70, 255);
  private tileWidth = 0;
  private tileHeight = 0;
  private tileType = '';
  private removed = false;
  private backgroundFallbackNode: Node | null = null;
  private backgroundNode: Node | null = null;
  private backgroundSprite: Sprite | null = null;
  private fallbackLabelNode: Node | null = null;
  private fallbackLabel: Label | null = null;
  private faceNode: Node | null = null;
  private faceSprite: Sprite | null = null;
  private highlightNode: Node | null = null;
  private highlightGraphics: Graphics | null = null;
  private feedbackNode: Node | null = null;
  private feedbackGraphics: Graphics | null = null;

  public setup(tile: TileData, width: number, height: number): void {
    validateTileDisplayMappings();
    this.destroyChildNodes();
    this.tileWidth = width;
    this.tileHeight = height;
    this.tileType = tile.type;
    this.removed = false;
    this.node.active = true;
    this.node.setScale(Vec3.ONE);

    const transform = this.ensureComponent(this.node, UITransform);
    transform.setContentSize(width, height);

    this.createLayerNodes(tile);
    this.loadSprites(tile.type);
    this.setSelected(false);
  }

  public setSelected(selected: boolean): void {
    if (this.removed) {
      return;
    }

    this.node.setScale(selected ? new Vec3(1.08, 1.08, 1) : Vec3.ONE);
    this.drawHighlight(selected ? this.selectedBorderColor : this.borderColor, selected ? 4 : 2);
    this.setNodeActive(this.highlightNode, true);
    this.setNodeActive(this.feedbackNode, false);
  }

  public showFailure(): void {
    if (this.removed) {
      return;
    }

    this.node.setScale(new Vec3(1.04, 1.04, 1));
    this.drawHighlight(this.failureBorderColor, 4);
    this.drawFeedbackOverlay();
    this.setNodeActive(this.highlightNode, true);
    this.setNodeActive(this.feedbackNode, true);
  }

  public clearFeedback(): void {
    if (this.removed) {
      return;
    }

    this.node.setScale(Vec3.ONE);
    this.drawHighlight(this.borderColor, 2);
    this.setNodeActive(this.feedbackNode, false);
  }

  public markRemoved(): void {
    this.removed = true;
    this.node.setScale(new Vec3(0.82, 0.82, 1));
    this.node.active = false;
  }

  protected onDestroy(): void {
    this.clearNodeReferences();
  }

  private createLayerNodes(tile: TileData): void {
    this.createShadowLayer();
    this.createBackgroundLayer();
    this.createFaceLayer();
    this.createFallbackLabelLayer(tile.type);
    this.createHighlightLayer();
    this.createFeedbackLayer();
  }

  private createShadowLayer(): void {
    const shadowNode = new Node('Shadow');
    const transform = shadowNode.addComponent(UITransform);
    const graphics = shadowNode.addComponent(Graphics);

    transform.setContentSize(this.tileWidth, this.tileHeight);
    shadowNode.setPosition(2, -3, 0);
    graphics.fillColor = new Color(0, 0, 0, 70);
    graphics.roundRect(-this.tileWidth / 2, -this.tileHeight / 2, this.tileWidth, this.tileHeight, this.getCornerRadius());
    graphics.fill();
    this.node.addChild(shadowNode);
  }

  private createBackgroundLayer(): void {
    this.backgroundFallbackNode = new Node('BackgroundFallback');
    const fallbackTransform = this.backgroundFallbackNode.addComponent(UITransform);
    fallbackTransform.setContentSize(this.tileWidth, this.tileHeight);
    this.node.addChild(this.backgroundFallbackNode);
    this.drawGraphicsBackground();

    this.backgroundNode = new Node('Background');
    const transform = this.backgroundNode.addComponent(UITransform);
    this.backgroundSprite = this.backgroundNode.addComponent(Sprite);

    this.backgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    transform.setContentSize(this.tileWidth, this.tileHeight);
    this.node.addChild(this.backgroundNode);
  }

  private createFaceLayer(): void {
    this.faceNode = new Node('Face');
    const transform = this.faceNode.addComponent(UITransform);
    this.faceSprite = this.faceNode.addComponent(Sprite);
    const faceSize = this.getFaceSize();

    this.faceSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    transform.setContentSize(faceSize.width, faceSize.height);
    this.faceNode.active = false;
    this.node.addChild(this.faceNode);
  }

  private createFallbackLabelLayer(tileType: string): void {
    const displayInfo = getTileDisplayInfo(tileType);
    this.fallbackLabelNode = new Node('FallbackLabel');
    const transform = this.fallbackLabelNode.addComponent(UITransform);
    this.fallbackLabel = this.fallbackLabelNode.addComponent(Label);

    transform.setContentSize(this.tileWidth, this.tileHeight);
    this.fallbackLabel.string = displayInfo.displayName;
    this.fallbackLabel.fontSize = this.calculateLabelFontSize(displayInfo.displayName);
    this.fallbackLabel.lineHeight = this.fallbackLabel.fontSize + 4;
    this.fallbackLabel.color = displayInfo.fallbackColor;
    this.fallbackLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.fallbackLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(this.fallbackLabelNode);
  }

  private createHighlightLayer(): void {
    this.highlightNode = new Node('Highlight');
    const transform = this.highlightNode.addComponent(UITransform);
    this.highlightGraphics = this.highlightNode.addComponent(Graphics);

    transform.setContentSize(this.tileWidth, this.tileHeight);
    this.node.addChild(this.highlightNode);
  }

  private createFeedbackLayer(): void {
    this.feedbackNode = new Node('FeedbackOverlay');
    const transform = this.feedbackNode.addComponent(UITransform);
    this.feedbackGraphics = this.feedbackNode.addComponent(Graphics);

    transform.setContentSize(this.tileWidth, this.tileHeight);
    this.feedbackNode.active = false;
    this.node.addChild(this.feedbackNode);
  }

  private loadSprites(tileType: string): void {
    const displayInfo = getTileDisplayInfo(tileType);

    TileSpriteFrameCache.load(TILE_BACKGROUND_PATH, (spriteFrame) => {
      if (!this.isCurrentTile(tileType) || !this.backgroundSprite) {
        return;
      }

      if (spriteFrame) {
        this.applySpriteFrame(this.backgroundSprite, spriteFrame, this.tileWidth, this.tileHeight);
      }
    });

    TileSpriteFrameCache.load(displayInfo.facePath, (spriteFrame) => {
      if (!this.isCurrentTile(tileType) || !this.faceSprite || !this.faceNode || !this.fallbackLabelNode) {
        return;
      }

      if (!spriteFrame) {
        this.faceNode.active = false;
        this.fallbackLabelNode.active = true;
        return;
      }

      const faceSize = this.getFaceSize();
      this.applySpriteFrame(this.faceSprite, spriteFrame, faceSize.width, faceSize.height);
      this.faceNode.active = true;
      this.fallbackLabelNode.active = false;
    });
  }

  private applySpriteFrame(sprite: Sprite, spriteFrame: SpriteFrame, width: number, height: number): void {
    const transform = sprite.node.getComponent(UITransform) ?? sprite.node.addComponent(UITransform);

    // Cocos 在赋值 SpriteFrame 时可能按图片原始尺寸重设 UITransform；
    // 先进入 CUSTOM 模式，并在赋值后再次恢复目标尺寸。
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = spriteFrame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    transform.setContentSize(width, height);
  }

  private drawGraphicsBackground(): void {
    if (!this.backgroundFallbackNode) {
      return;
    }

    const graphics = this.backgroundFallbackNode.addComponent(Graphics);
    graphics.fillColor = this.backgroundColor;
    graphics.roundRect(-this.tileWidth / 2, -this.tileHeight / 2, this.tileWidth, this.tileHeight, this.getCornerRadius());
    graphics.fill();
  }

  private drawHighlight(borderColor: Color, lineWidth: number): void {
    if (!this.highlightGraphics) {
      return;
    }

    this.highlightGraphics.clear();
    this.highlightGraphics.strokeColor = borderColor;
    this.highlightGraphics.lineWidth = lineWidth;
    this.highlightGraphics.roundRect(
      -this.tileWidth / 2,
      -this.tileHeight / 2,
      this.tileWidth,
      this.tileHeight,
      this.getCornerRadius(),
    );
    this.highlightGraphics.stroke();
  }

  private drawFeedbackOverlay(): void {
    if (!this.feedbackGraphics) {
      return;
    }

    this.feedbackGraphics.clear();
    this.feedbackGraphics.fillColor = new Color(231, 82, 70, 70);
    this.feedbackGraphics.roundRect(
      -this.tileWidth / 2,
      -this.tileHeight / 2,
      this.tileWidth,
      this.tileHeight,
      this.getCornerRadius(),
    );
    this.feedbackGraphics.fill();
  }

  private ensureComponent<T extends Component>(
    target: Node,
    ComponentClass: new () => T,
  ): T {
    return target.getComponent(ComponentClass) ?? target.addComponent(ComponentClass);
  }

  private calculateLabelFontSize(text: string): number {
    const maxByHeight = Math.floor(this.tileHeight * 0.36);
    const maxByWidth = Math.floor((this.tileWidth * 0.78) / Math.max(1, text.length));

    return Math.max(10, Math.min(maxByHeight, maxByWidth));
  }

  private getFaceSize(): { width: number; height: number } {
    return {
      width: this.tileWidth * 0.72,
      height: this.tileHeight * 0.72,
    };
  }

  private getCornerRadius(): number {
    return Math.max(4, Math.min(8, this.tileWidth * 0.12));
  }

  private setNodeActive(node: Node | null, active: boolean): void {
    if (node && node.isValid) {
      node.active = active;
    }
  }

  private isCurrentTile(tileType: string): boolean {
    return this.node.isValid && !this.removed && this.tileType === tileType;
  }

  private destroyChildNodes(): void {
    const children = [...this.node.children];

    for (const child of children) {
      if (!child.isValid) {
        continue;
      }

      child.removeFromParent();
      child.destroy();
    }

    this.clearNodeReferences();
  }

  private clearNodeReferences(): void {
    this.backgroundFallbackNode = null;
    this.backgroundNode = null;
    this.backgroundSprite = null;
    this.fallbackLabelNode = null;
    this.fallbackLabel = null;
    this.faceNode = null;
    this.faceSprite = null;
    this.highlightNode = null;
    this.highlightGraphics = null;
    this.feedbackNode = null;
    this.feedbackGraphics = null;
  }
}
