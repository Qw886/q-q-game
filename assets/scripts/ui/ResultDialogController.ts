import { _decorator, Color, Component, EventTouch, Graphics, Label, Node, resources, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';
import type { GameEndReason, GameSnapshot } from '../core/GameTypes';

const { ccclass } = _decorator;
const HARD_WIN_BACKGROUND_PATH = 'endings/hard_win_sky/spriteFrame';
const HARD_WIN_TEXT = '\u83ab\u9053\u6851\u6986\u665a\u4e3a\u971e\u5c1a\u6ee1\u5929';

@ccclass('ResultDialogController')
export class ResultDialogController extends Component {
  private restartButton: Node | null = null;
  private menuButton: Node | null = null;
  private onRestart: (() => void) | null = null;
  private onMenu: (() => void) | null = null;
  private readonly animatedNodes: Node[] = [];

  public show(
    _snapshot: GameSnapshot,
    reason: GameEndReason,
    onRestart: () => void,
    onMenu: () => void,
    width: number,
    height: number,
  ): void {
    this.clear();
    this.onRestart = onRestart;
    this.onMenu = onMenu;
    this.node.active = true;

    if (reason === 'win' && _snapshot.modeId === 'hard') {
      this.showHardWinEasterEgg(onRestart, onMenu, width, height);
      return;
    }

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    const graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    transform.setContentSize(width, height);
    graphics.clear();
    graphics.fillColor = new Color(0, 0, 0, 150);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();

    const panelWidth = Math.min(460, width * 0.82);
    const panelHeight = Math.min(320, height * 0.42);
    const panel = this.createPanel(panelWidth, panelHeight);
    this.addPanelLabel(panel, 'Title', this.getTitle(reason), 0, 76, 34, panelWidth - 64, 52);
    this.addPanelLabel(panel, 'Detail', this.getDetail(reason), 0, 12, 22, panelWidth - 72, 76);

    this.restartButton = this.createButton('\u91cd\u65b0\u5f00\u59cb', 180, 54);
    this.restartButton.setPosition(-96, -92, 0);
    panel.addChild(this.restartButton);

    this.menuButton = this.createButton('\u8fd4\u56de\u83dc\u5355', 180, 54);
    this.menuButton.setPosition(96, -92, 0);
    panel.addChild(this.menuButton);

    this.node.addChild(panel);
    this.node.on(Node.EventType.TOUCH_END, this.handleDialogTouch, this);
  }

  public hide(): void {
    this.clear();
    this.node.active = false;
  }

  protected onDestroy(): void {
    this.clear();
    this.onRestart = null;
    this.onMenu = null;
  }

  private clear(): void {
    this.stopAnimations();
    this.clearButtonEvents();
    this.onRestart = null;
    this.onMenu = null;
    this.destroyChildNodes();
    const graphics = this.node.getComponent(Graphics);

    if (graphics) {
      graphics.clear();
    }
  }

  private clearButtonEvents(): void {
    this.node.off(Node.EventType.TOUCH_END, this.handleDialogTouch, this);
    this.restartButton = null;
    this.menuButton = null;
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
  }

  private stopAnimations(): void {
    for (const node of this.animatedNodes) {
      if (node.isValid) {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);

        if (opacity) {
          Tween.stopAllByTarget(opacity);
        }
      }
    }

    this.animatedNodes.length = 0;
  }

  private showHardWinEasterEgg(onRestart: () => void, onMenu: () => void, width: number, height: number): void {
    this.onRestart = onRestart;
    this.onMenu = onMenu;

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    const graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    transform.setContentSize(width, height);
    graphics.clear();
    graphics.fillColor = new Color(76, 136, 190, 255);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();

    const backgroundNode = this.createHardWinBackground(width, height);
    this.node.addChild(backgroundNode);
    this.animateHardWinBackground(backgroundNode);

    const overlay = new Node('HardWinReadabilityOverlay');
    const overlayTransform = overlay.addComponent(UITransform);
    const overlayGraphics = overlay.addComponent(Graphics);
    overlayTransform.setContentSize(width, height);
    overlayGraphics.fillColor = new Color(0, 24, 44, 70);
    overlayGraphics.rect(-width / 2, -height / 2, width, height);
    overlayGraphics.fill();
    this.node.addChild(overlay);

    this.createHardWinPoem(width, height);

    const buttonY = -height / 2 + Math.max(62, height * 0.105);
    this.restartButton = this.createButton('\u518d\u6311\u6218', 170, 52);
    this.restartButton.setPosition(-92, buttonY, 0);
    this.node.addChild(this.restartButton);

    this.menuButton = this.createButton('\u8fd4\u56de\u83dc\u5355', 170, 52);
    this.menuButton.setPosition(92, buttonY, 0);
    this.node.addChild(this.menuButton);
    this.node.on(Node.EventType.TOUCH_END, this.handleDialogTouch, this);
  }

  private createHardWinBackground(width: number, height: number): Node {
    const backgroundNode = new Node('HardWinSkyBackground');
    const transform = backgroundNode.addComponent(UITransform);
    const imageAspectRatio = 1448 / 1086;
    const targetAspectRatio = width / height;
    const displayHeight = targetAspectRatio > imageAspectRatio ? width / imageAspectRatio : height;
    const displayWidth = targetAspectRatio > imageAspectRatio ? width : height * imageAspectRatio;

    transform.setContentSize(displayWidth * 1.08, displayHeight * 1.08);

    const fallbackNode = new Node('HardWinSkyFallback');
    const fallbackTransform = fallbackNode.addComponent(UITransform);
    const fallbackGraphics = fallbackNode.addComponent(Graphics);
    fallbackTransform.setContentSize(displayWidth * 1.08, displayHeight * 1.08);
    this.drawHardWinFallbackSky(fallbackGraphics, displayWidth * 1.08, displayHeight * 1.08);
    backgroundNode.addChild(fallbackNode);

    const spriteNode = new Node('HardWinSkySprite');
    const spriteTransform = spriteNode.addComponent(UITransform);
    const sprite = spriteNode.addComponent(Sprite);
    spriteTransform.setContentSize(displayWidth * 1.08, displayHeight * 1.08);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    backgroundNode.addChild(spriteNode);

    resources.load(HARD_WIN_BACKGROUND_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !spriteNode.isValid) {
        console.warn(`[ResultDialogController] Hard win background is unavailable: resources/${HARD_WIN_BACKGROUND_PATH}.`);
        return;
      }

      sprite.spriteFrame = spriteFrame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      spriteTransform.setContentSize(displayWidth * 1.08, displayHeight * 1.08);
    });

    return backgroundNode;
  }

  private drawHardWinFallbackSky(graphics: Graphics, width: number, height: number): void {
    const left = -width / 2;
    const bottom = -height / 2;
    const bandHeight = height / 7;
    const colors = [
      new Color(58, 124, 189, 255),
      new Color(73, 143, 207, 255),
      new Color(96, 163, 220, 255),
      new Color(129, 184, 229, 255),
      new Color(166, 205, 236, 255),
      new Color(197, 222, 241, 255),
      new Color(219, 232, 244, 255),
    ];

    graphics.clear();
    colors.forEach((color, index) => {
      graphics.fillColor = color;
      graphics.rect(left, bottom + bandHeight * index, width, bandHeight + 1);
      graphics.fill();
    });

    this.drawCloudCluster(graphics, -width * 0.2, -height * 0.22, width * 0.2, 235);
    this.drawCloudCluster(graphics, width * 0.22, -height * 0.18, width * 0.24, 225);
    this.drawCloudCluster(graphics, 0, -height * 0.34, width * 0.32, 210);
  }

  private drawCloudCluster(graphics: Graphics, centerX: number, centerY: number, size: number, alpha: number): void {
    const cloudColor = new Color(255, 255, 255, alpha);
    const shadowColor = new Color(145, 168, 190, Math.floor(alpha * 0.35));
    const circles = [
      { x: -0.42, y: -0.03, r: 0.24 },
      { x: -0.16, y: 0.1, r: 0.28 },
      { x: 0.13, y: 0.12, r: 0.32 },
      { x: 0.42, y: 0.02, r: 0.25 },
      { x: 0.02, y: -0.08, r: 0.34 },
    ];

    graphics.fillColor = shadowColor;
    circles.forEach((circle) => {
      graphics.circle(centerX + circle.x * size, centerY + circle.y * size - size * 0.08, circle.r * size);
      graphics.fill();
    });

    graphics.fillColor = cloudColor;
    circles.forEach((circle) => {
      graphics.circle(centerX + circle.x * size, centerY + circle.y * size, circle.r * size);
      graphics.fill();
    });
  }

  private animateHardWinBackground(backgroundNode: Node): void {
    this.animatedNodes.push(backgroundNode);
    backgroundNode.setPosition(-10, -4, 0);
    backgroundNode.setScale(new Vec3(1.02, 1.02, 1));
    tween(backgroundNode)
      .repeatForever(
        tween<Node>()
          .to(5.2, { position: new Vec3(10, 5, 0), scale: new Vec3(1.045, 1.045, 1) }, { easing: 'sineInOut' })
          .to(5.2, { position: new Vec3(-10, -4, 0), scale: new Vec3(1.02, 1.02, 1) }, { easing: 'sineInOut' }),
      )
      .start();
  }

  private createHardWinPoem(width: number, height: number): void {
    const poemRoot = new Node('HardWinPoem');
    const rootTransform = poemRoot.addComponent(UITransform);
    rootTransform.setContentSize(width, 220);
    poemRoot.setPosition(0, height * 0.1, 0);
    this.node.addChild(poemRoot);

    const lines = ['\u83ab\u9053\u6851\u6986\u665a', '\u4e3a\u971e\u5c1a\u6ee1\u5929'];
    const fontSize = Math.floor(Math.min(58, Math.max(34, width / 13)));
    const charGap = fontSize * 0.12;
    const step = fontSize + charGap;
    const lineGap = fontSize * 1.35;
    let animationIndex = 0;

    lines.forEach((line, lineIndex) => {
      const chars = [...line];
      const startX = -((chars.length - 1) * step) / 2;
      const y = lineIndex === 0 ? lineGap / 2 : -lineGap / 2;

      chars.forEach((char, charIndex) => {
        const charNode = new Node(`PoemChar_${lineIndex}_${charIndex}`);
        const transform = charNode.addComponent(UITransform);
        const opacity = charNode.addComponent(UIOpacity);
        const label = charNode.addComponent(Label);
        transform.setContentSize(fontSize + 10, fontSize + 22);
        charNode.setPosition(startX + charIndex * step, y, 0);
        opacity.opacity = 0;
        label.string = char;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 12;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        poemRoot.addChild(charNode);
        this.animatedNodes.push(charNode);
        this.animatedNodes.push(opacity.node);

        tween(opacity)
          .delay(animationIndex * 0.045)
          .to(0.16, { opacity: 255 }, { easing: 'quadOut' })
          .start();
        animationIndex += 1;
      });
    });
  }

  private createPanel(width: number, height: number): Node {
    const panel = new Node('ResultPanel');
    const transform = panel.addComponent(UITransform);
    const graphics = panel.addComponent(Graphics);
    transform.setContentSize(width, height);
    graphics.fillColor = new Color(244, 236, 213, 255);
    graphics.strokeColor = new Color(75, 63, 44, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-width / 2, -height / 2, width, height, 9);
    graphics.fill();
    graphics.stroke();

    return panel;
  }

  private addPanelLabel(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    width: number,
    height: number,
  ): void {
    const labelNode = new Node(name);
    const transform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);
    transform.setContentSize(width, height);
    labelNode.setPosition(x, y, 0);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = new Color(48, 39, 28, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    parent.addChild(labelNode);
  }

  private createButton(text: string, width: number, height: number): Node {
    const node = new Node(text);
    const transform = node.addComponent(UITransform);
    const graphics = node.addComponent(Graphics);
    const labelNode = new Node('Label');
    const labelTransform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);

    transform.setContentSize(width, height);
    graphics.fillColor = new Color(74, 123, 92, 255);
    graphics.strokeColor = new Color(39, 78, 52, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.stroke();

    labelTransform.setContentSize(width, height);
    label.string = text;
    label.fontSize = 22;
    label.lineHeight = 28;
    label.color = new Color(255, 255, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    node.addChild(labelNode);

    return node;
  }

  private handleRestart(): void {
    if (this.onRestart) {
      this.onRestart();
    }
  }

  private handleMenu(): void {
    if (this.onMenu) {
      this.onMenu();
    }
  }

  private handleDialogTouch(event: EventTouch): void {
    const location = event.getUILocation();

    if (this.isTouchInsideNode(location, this.restartButton)) {
      this.handleRestart();
      return;
    }

    if (this.isTouchInsideNode(location, this.menuButton)) {
      this.handleMenu();
    }
  }

  private isTouchInsideNode(location: Vec2, node: Node | null): boolean {
    const transform = node?.getComponent(UITransform);

    if (!node || !node.isValid || !transform) {
      return false;
    }

    return transform.getBoundingBoxToWorld().contains(location);
  }

  private getTitle(reason: GameEndReason): string {
    if (reason === 'win') {
      return '\u606d\u559c\u901a\u5173';
    }

    if (reason === 'deadlock') {
      return '\u65e0\u53ef\u6d88\u9664\u7ec4\u5408';
    }

    return '\u65f6\u95f4\u8017\u5c3d';
  }

  private getDetail(reason: GameEndReason): string {
    if (reason === 'win') {
      return '\u6240\u6709\u96c0\u724c\u5df2\u6210\u529f\u6d88\u9664';
    }

    if (reason === 'deadlock') {
      return '\u672c\u5c40\u5df2\u5f62\u6210\u6b7b\u5c40\uff0c\u8bf7\u91cd\u65b0\u6311\u6218';
    }

    return '\u8bf7\u5728\u5012\u8ba1\u65f6\u7ed3\u675f\u524d\u5b8c\u6210\u4e00\u6b21\u6d88\u9664';
  }
}
