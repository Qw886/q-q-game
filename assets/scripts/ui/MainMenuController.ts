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
    this.createTitle(rootSize.height);
    this.createModeButtons(difficulties);
    this.createScoreHint(rootSize.height);
    this.initialized = true;
  }

  protected onDestroy(): void {
    this.clearButtonEvents();
  }

  private createTitle(height: number): void {
    const titleNode = new Node('Title');
    const transform = titleNode.addComponent(UITransform);
    const label = titleNode.addComponent(Label);

    transform.setContentSize(560, 74);
    titleNode.setPosition(0, height / 2 - 138, 0);
    label.string = '\u96c0\u724c\u8fde\u7ebf';
    label.fontSize = 58;
    label.lineHeight = 66;
    label.color = new Color(255, 244, 205, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    this.node.addChild(titleNode);

    const subtitleNode = new Node('Subtitle');
    const subtitleTransform = subtitleNode.addComponent(UITransform);
    const subtitle = subtitleNode.addComponent(Label);

    subtitleTransform.setContentSize(600, 42);
    subtitleNode.setPosition(0, height / 2 - 197, 0);
    subtitle.string = '\u6700\u591a\u4e24\u6b21\u8f6c\u5f2f\uff0c\u8fde\u63a5\u76f8\u540c\u96c0\u724c';
    subtitle.fontSize = 23;
    subtitle.lineHeight = 30;
    subtitle.color = new Color(208, 231, 205, 255);
    subtitle.horizontalAlign = Label.HorizontalAlign.CENTER;
    subtitle.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(subtitleNode);
  }

  private createModeButtons(difficulties: readonly DifficultyConfig[]): void {
    difficulties.forEach((difficulty, index) => {
      const buttonNode = this.createModeButton(difficulty);
      const callback = (): void => this.handleModeSelected(difficulty.id);
      const pressCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'pressed');
      const releaseCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'default');
      const hoverCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'hover');
      const leaveCallback = (): void => this.redrawModeButton(buttonNode, difficulty, 'default');

      buttonNode.setPosition(0, 160 - index * 130, 0);
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

  private createScoreHint(height: number): void {
    const hintNode = new Node('ScoreHint');
    const transform = hintNode.addComponent(UITransform);
    const label = hintNode.addComponent(Label);

    transform.setContentSize(620, 72);
    hintNode.setPosition(0, Math.max(-height / 2 + 138, -288), 0);
    label.string = '\u8ba1\u5206\u89c4\u5219\n\u6bcf\u5bf9\u57fa\u7840100\u5206\uff0c\u5269\u4f59\u6bcf\u79d2\u5956\u52b110\u5206\uff0c\u518d\u6309\u6a21\u5f0f\u500d\u7387\u8ba1\u7b97';
    label.fontSize = 18;
    label.lineHeight = 26;
    label.color = new Color(230, 245, 210, 255);
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

  private createModeButton(config: DifficultyConfig): Node {
    const width = 486;
    const height = 106;
    const buttonNode = new Node(`${config.id}ModeButton`);
    const transform = buttonNode.addComponent(UITransform);
    const graphics = buttonNode.addComponent(Graphics);

    transform.setContentSize(width, height);
    this.drawModeCard(graphics, width, height, this.getModeAccentColor(config.id), 'default');

    this.addButtonText(
      buttonNode,
      `${config.name}\u6a21\u5f0f`,
      `\u68cb\u76d8\uff1a${config.tileCount}\u5f20   \u65f6\u95f4\uff1a${config.roundTime}\u79d2   \u500d\u7387\uff1a${config.scoreMultiplier.toFixed(1)}x`,
      width,
      height,
      this.getModeAccentColor(config.id),
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
  ): void {
    const titleNode = new Node('Title');
    const titleTransform = titleNode.addComponent(UITransform);
    const titleLabel = titleNode.addComponent(Label);
    titleTransform.setContentSize(width, 44);
    titleNode.setPosition(0, 20, 0);
    titleLabel.string = title;
    titleLabel.fontSize = 28;
    titleLabel.lineHeight = 34;
    titleLabel.color = accentColor;
    titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
    buttonNode.addChild(titleNode);

    const detailNode = new Node('Detail');
    const detailTransform = detailNode.addComponent(UITransform);
    const detailLabel = detailNode.addComponent(Label);
    detailTransform.setContentSize(width - 42, 36);
    detailNode.setPosition(0, -24, 0);
    detailLabel.string = subtitle;
    detailLabel.fontSize = 19;
    detailLabel.lineHeight = 26;
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
    graphics.fillColor = new Color(0, 0, 0, state === 'pressed' ? 38 : 56);
    graphics.roundRect(-width / 2 + 5, -height / 2 - 5, width, height, 10);
    graphics.fill();
    graphics.fillColor = fillColor;
    graphics.strokeColor = accentColor;
    graphics.lineWidth = state === 'hover' ? 4 : 3;
    graphics.roundRect(-width / 2, -height / 2 + offsetY, width, height, 10);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = new Color(accentColor.r, accentColor.g, accentColor.b, 34);
    graphics.rect(-width / 2 + 12, height / 2 - 12 + offsetY, width - 24, 6);
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
