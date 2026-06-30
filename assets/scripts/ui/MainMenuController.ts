import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import type { DifficultyConfig, DifficultyId } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('MainMenuController')
export class MainMenuController extends Component {
  private readonly buttonBindings: ButtonBinding[] = [];
  private onStartMode: ((difficulty: DifficultyConfig) => void) | null = null;
  private initialized = false;

  public setup(difficulties: readonly DifficultyConfig[], onStartMode: (difficulty: DifficultyConfig) => void): void {
    this.onStartMode = onStartMode;

    if (this.initialized) {
      return;
    }

    const rootSize = this.getRootSize();
    const layout = this.getMenuLayout(rootSize.width, rootSize.height);
    this.createTitle(layout);
    this.createModeButtons(difficulties, layout);
    this.createRuleHint(layout);
    this.initialized = true;
  }

  protected onDestroy(): void {
    this.clearButtonEvents();
  }

  private createTitle(layout: MenuLayout): void {
    const titleShadowNode = new Node('TitleShadow');
    const shadowTransform = titleShadowNode.addComponent(UITransform);
    const shadowLabel = titleShadowNode.addComponent(Label);

    shadowTransform.setContentSize(layout.titleWidth, layout.titleHeight);
    titleShadowNode.setPosition(2, layout.titleY - 3, 0);
    shadowLabel.string = 'Qwq\u8fde\u7ebf';
    shadowLabel.fontSize = layout.titleFontSize;
    shadowLabel.lineHeight = layout.titleLineHeight;
    shadowLabel.color = new Color(0, 0, 0, 96);
    shadowLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    shadowLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(titleShadowNode);

    const titleNode = new Node('Title');
    const transform = titleNode.addComponent(UITransform);
    const label = titleNode.addComponent(Label);

    transform.setContentSize(layout.titleWidth, layout.titleHeight);
    titleNode.setPosition(0, layout.titleY, 0);
    label.string = 'Qwq\u8fde\u7ebf';
    label.fontSize = layout.titleFontSize;
    label.lineHeight = layout.titleLineHeight;
    label.color = new Color(255, 244, 205, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    this.node.addChild(titleNode);

    const subtitleNode = new Node('Subtitle');
    const subtitleTransform = subtitleNode.addComponent(UITransform);
    const subtitle = subtitleNode.addComponent(Label);

    subtitleTransform.setContentSize(layout.subtitleWidth, layout.subtitleHeight);
    subtitleNode.setPosition(0, layout.subtitleY, 0);
    subtitle.string = '\u6700\u591a\u4e24\u6b21\u8f6c\u5f2f\uff0c\u8fde\u63a5\u76f8\u540c\u96c0\u724c';
    subtitle.fontSize = layout.subtitleFontSize;
    subtitle.lineHeight = layout.subtitleLineHeight;
    subtitle.color = new Color(208, 231, 205, 255);
    subtitle.horizontalAlign = Label.HorizontalAlign.CENTER;
    subtitle.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(subtitleNode);
  }

  private createModeButtons(difficulties: readonly DifficultyConfig[], layout: MenuLayout): void {
    difficulties.forEach((difficulty, index) => {
      const buttonNode = this.createModeButton(difficulty, layout);
      const callback = (): void => this.handleModeSelected(difficulty.id);
      const pressCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'pressed');
      const releaseCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'default');
      const hoverCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'hover');
      const leaveCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'default');

      buttonNode.setPosition(0, layout.firstButtonY - index * layout.buttonGap, 0);
      buttonNode.on(Node.EventType.TOUCH_START, pressCallback, this);
      buttonNode.on(Node.EventType.TOUCH_END, callback, this);
      buttonNode.on(Node.EventType.TOUCH_END, releaseCallback, this);
      buttonNode.on(Node.EventType.TOUCH_CANCEL, releaseCallback, this);
      buttonNode.on(Node.EventType.MOUSE_ENTER, hoverCallback, this);
      buttonNode.on(Node.EventType.MOUSE_LEAVE, leaveCallback, this);
      this.buttonBindings.push({
        node: buttonNode,
        callback,
        pressCallback,
        releaseCallback,
        hoverCallback,
        leaveCallback,
        difficultyId: difficulty.id,
        difficulty,
      });
      this.node.addChild(buttonNode);
    });
  }

  private createRuleHint(layout: MenuLayout): void {
    const hintNode = new Node('RuleHint');
    const transform = hintNode.addComponent(UITransform);
    const label = hintNode.addComponent(Label);

    transform.setContentSize(layout.hintWidth, layout.hintHeight);
    hintNode.setPosition(0, layout.hintY, 0);
    label.string = '\u9009\u62e9\u4e24\u5f20\u76f8\u540c\u96c0\u724c\n\u8fde\u7ebf\u8def\u5f84\u6700\u591a\u8f6c\u5f2f\u4e24\u6b21';
    label.fontSize = layout.hintFontSize;
    label.lineHeight = layout.hintLineHeight;
    label.color = new Color(225, 239, 211, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    this.node.addChild(hintNode);
  }

  private handleModeSelected(id: DifficultyId): void {
    const binding = this.buttonBindings.find((item) => item.difficultyId === id);

    if (binding?.difficulty && this.onStartMode) {
      this.onStartMode(binding.difficulty);
    }
  }

  private createModeButton(config: DifficultyConfig, layout: MenuLayout): Node {
    const width = layout.buttonWidth;
    const height = layout.buttonHeight;
    const buttonNode = new Node(`${config.id}ModeButton`);
    const transform = buttonNode.addComponent(UITransform);
    const graphics = buttonNode.addComponent(Graphics);

    transform.setContentSize(width, height);
    this.drawModeCard(graphics, width, height, this.getModeAccentColor(config.id), 'default');

    this.addButtonText(
      buttonNode,
      `${config.name}\u6a21\u5f0f`,
      `\u68cb\u76d8\uff1a${config.tileCount}\u5f20   \u65f6\u95f4\uff1a${config.roundTime}\u79d2`,
      width,
      height,
      this.getModeAccentColor(config.id),
      layout,
    );

    return buttonNode;
  }

  private addButtonText(
    buttonNode: Node,
    title: string,
    subtitle: string,
    width: number,
    height: number,
    accentColor: Color,
    layout: MenuLayout,
  ): void {
    const titleNode = new Node('Title');
    const titleTransform = titleNode.addComponent(UITransform);
    const titleLabel = titleNode.addComponent(Label);
    titleTransform.setContentSize(width, layout.buttonTitleHeight);
    titleNode.setPosition(0, layout.buttonTitleY, 0);
    titleLabel.string = title;
    titleLabel.fontSize = layout.buttonTitleFontSize;
    titleLabel.lineHeight = layout.buttonTitleLineHeight;
    titleLabel.color = accentColor;
    titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
    buttonNode.addChild(titleNode);

    const detailNode = new Node('Detail');
    const detailTransform = detailNode.addComponent(UITransform);
    const detailLabel = detailNode.addComponent(Label);
    detailTransform.setContentSize(width - 42, layout.buttonDetailHeight);
    detailNode.setPosition(0, layout.buttonDetailY, 0);
    detailLabel.string = subtitle;
    detailLabel.fontSize = layout.buttonDetailFontSize;
    detailLabel.lineHeight = layout.buttonDetailLineHeight;
    detailLabel.color = new Color(69, 58, 42, 255);
    detailLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    detailLabel.verticalAlign = Label.VerticalAlign.CENTER;
    buttonNode.addChild(detailNode);
  }

  private clearButtonEvents(): void {
    for (const binding of this.buttonBindings) {
      this.unbindButton(binding);
      binding.node = null;
    }

    this.buttonBindings.length = 0;
    this.onStartMode = null;
    this.initialized = false;
  }

  private unbindButton(binding: ButtonBinding): void {
    const node = binding.node;

    if (!node || !node.isValid) {
      return;
    }

    node.off(Node.EventType.TOUCH_START, binding.pressCallback, this);
    node.off(Node.EventType.TOUCH_END, binding.callback, this);
    node.off(Node.EventType.TOUCH_END, binding.releaseCallback, this);
    node.off(Node.EventType.TOUCH_CANCEL, binding.releaseCallback, this);
    node.off(Node.EventType.MOUSE_ENTER, binding.hoverCallback, this);
    node.off(Node.EventType.MOUSE_LEAVE, binding.leaveCallback, this);
  }

  private redrawModeButton(node: Node, config: DifficultyConfig, state: ModeButtonState): void {
    const transform = node.getComponent(UITransform);
    const graphics = node.getComponent(Graphics);

    if (!transform || !graphics) {
      return;
    }

    this.drawModeCard(graphics, transform.contentSize.width, transform.contentSize.height, this.getModeAccentColor(config.id), state);
  }

  private drawModeCard(graphics: Graphics, width: number, height: number, accentColor: Color, state: ModeButtonState): void {
    const offsetY = state === 'pressed' ? -2 : 0;
    const fillColor = state === 'hover'
      ? new Color(251, 239, 205, 255)
      : state === 'pressed'
        ? new Color(222, 207, 169, 255)
        : new Color(242, 229, 191, 255);

    graphics.clear();
    graphics.fillColor = new Color(0, 0, 0, state === 'pressed' ? 36 : 58);
    graphics.roundRect(-width / 2 + 5, -height / 2 - 6, width, height, 10);
    graphics.fill();
    graphics.fillColor = fillColor;
    graphics.strokeColor = accentColor;
    graphics.lineWidth = state === 'hover' ? 4 : 3;
    graphics.roundRect(-width / 2, -height / 2 + offsetY, width, height, 10);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = new Color(255, 255, 246, 72);
    graphics.roundRect(-width / 2 + 20, height / 2 - 13 + offsetY, width - 40, 5, 3);
    graphics.fill();
    graphics.fillColor = new Color(accentColor.r, accentColor.g, accentColor.b, 22);
    graphics.roundRect(-width / 2 + 22, -height / 2 + 10 + offsetY, width - 44, 4, 2);
    graphics.fill();
  }

  private getModeAccentColor(id: DifficultyId): Color {
    switch (id) {
      case 'medium':
        return new Color(182, 137, 28, 255);
      case 'hard':
        return new Color(137, 45, 45, 255);
      case 'normal':
      default:
        return new Color(42, 126, 78, 255);
    }
  }

  private getRootSize(): { width: number; height: number } {
    const transform = this.node.getComponent(UITransform);
    const width = transform?.contentSize.width ?? 720;
    const height = transform?.contentSize.height ?? 1280;

    return { width, height };
  }

  private getMenuLayout(width: number, height: number): MenuLayout {
    const widthScale = this.clamp(width / 720, 0.95, 1.22);

    if (height < 900) {
      const buttonHeight = this.clamp(height * 0.118, 82, 102);
      const buttonGap = buttonHeight + this.clamp(height * 0.022, 18, 26);
      const firstButtonY = height * 0.055;
      const hardButtonCenterY = firstButtonY - buttonGap * 2;

      return {
        titleY: height * 0.305,
        titleWidth: 560,
        titleHeight: 58,
        titleFontSize: Math.floor(48 * widthScale),
        titleLineHeight: Math.floor(58 * widthScale),
        subtitleY: height * 0.245,
        subtitleWidth: 620,
        subtitleHeight: 34,
        subtitleFontSize: Math.floor(20 * widthScale),
        subtitleLineHeight: Math.floor(28 * widthScale),
        firstButtonY,
        buttonGap,
        buttonWidth: this.clamp(width * 0.68, 460, 560),
        buttonHeight,
        buttonTitleY: 19,
        buttonTitleHeight: 42,
        buttonTitleFontSize: Math.floor(28 * widthScale),
        buttonTitleLineHeight: Math.floor(35 * widthScale),
        buttonDetailY: -24,
        buttonDetailHeight: 32,
        buttonDetailFontSize: Math.floor(18 * widthScale),
        buttonDetailLineHeight: Math.floor(25 * widthScale),
        hintY: hardButtonCenterY - buttonHeight / 2 - this.clamp(height * 0.06, 42, 56),
        hintWidth: 620,
        hintHeight: 48,
        hintFontSize: Math.floor(17 * widthScale),
        hintLineHeight: Math.floor(24 * widthScale),
      };
    }

    const buttonHeight = this.clamp(height * 0.088, 98, 122);
    const buttonGap = buttonHeight + this.clamp(height * 0.021, 26, 40);
    const firstButtonY = height * 0.055;
    const hardButtonCenterY = firstButtonY - buttonGap * 2;

    return {
      titleY: height * 0.305,
      titleWidth: 620,
      titleHeight: 76,
      titleFontSize: Math.floor(62 * widthScale),
      titleLineHeight: Math.floor(72 * widthScale),
      subtitleY: height * 0.245,
      subtitleWidth: 660,
      subtitleHeight: 42,
      subtitleFontSize: Math.floor(24 * widthScale),
      subtitleLineHeight: Math.floor(33 * widthScale),
      firstButtonY,
      buttonGap,
      buttonWidth: this.clamp(width * 0.68, 500, 620),
      buttonHeight,
      buttonTitleY: 22,
      buttonTitleHeight: 50,
      buttonTitleFontSize: Math.floor(34 * widthScale),
      buttonTitleLineHeight: Math.floor(41 * widthScale),
      buttonDetailY: -29,
      buttonDetailHeight: 42,
      buttonDetailFontSize: Math.floor(22 * widthScale),
      buttonDetailLineHeight: Math.floor(30 * widthScale),
      hintY: hardButtonCenterY - buttonHeight / 2 - this.clamp(height * 0.058, 54, 76),
      hintWidth: 660,
      hintHeight: 72,
      hintFontSize: Math.floor(21 * widthScale),
      hintLineHeight: Math.floor(30 * widthScale),
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }
}

interface ButtonBinding {
  node: Node | null;
  readonly callback: () => void;
  readonly pressCallback: () => void;
  readonly releaseCallback: () => void;
  readonly hoverCallback: () => void;
  readonly leaveCallback: () => void;
  readonly difficultyId: DifficultyId;
  readonly difficulty: DifficultyConfig;
}

type ModeButtonState = 'default' | 'hover' | 'pressed';

interface MenuLayout {
  readonly titleY: number;
  readonly titleWidth: number;
  readonly titleHeight: number;
  readonly titleFontSize: number;
  readonly titleLineHeight: number;
  readonly subtitleY: number;
  readonly subtitleWidth: number;
  readonly subtitleHeight: number;
  readonly subtitleFontSize: number;
  readonly subtitleLineHeight: number;
  readonly firstButtonY: number;
  readonly buttonGap: number;
  readonly buttonWidth: number;
  readonly buttonHeight: number;
  readonly buttonTitleY: number;
  readonly buttonTitleHeight: number;
  readonly buttonTitleFontSize: number;
  readonly buttonTitleLineHeight: number;
  readonly buttonDetailY: number;
  readonly buttonDetailHeight: number;
  readonly buttonDetailFontSize: number;
  readonly buttonDetailLineHeight: number;
  readonly hintY: number;
  readonly hintWidth: number;
  readonly hintHeight: number;
  readonly hintFontSize: number;
  readonly hintLineHeight: number;
}
