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

    transform.setContentSize(520, 92);
    titleNode.setPosition(0, height / 2 - 170, 0);
    label.string = '\u96c0\u724c\u8fde\u7ebf';
    label.fontSize = 52;
    label.lineHeight = 60;
    label.color = new Color(255, 255, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    this.node.addChild(titleNode);
  }

  private createModeButtons(difficulties: readonly DifficultyConfig[]): void {
    difficulties.forEach((difficulty, index) => {
      const buttonNode = this.createModeButton(difficulty);
      const callback = (): void => this.handleModeSelected(difficulty.id);

      buttonNode.setPosition(0, 128 - index * 116, 0);
      buttonNode.on(Node.EventType.TOUCH_END, callback, this);
      this.buttonBindings.push({ node: buttonNode, callback, difficultyId: difficulty.id, difficulty });
      this.node.addChild(buttonNode);
    });
  }

  private createScoreHint(height: number): void {
    const hintNode = new Node('ScoreHint');
    const transform = hintNode.addComponent(UITransform);
    const label = hintNode.addComponent(Label);

    transform.setContentSize(620, 64);
    hintNode.setPosition(0, Math.max(-height / 2 + 96, -260), 0);
    label.string = '\u8ba1\u5206\uff1a\u6bcf\u5bf9\u57fa\u7840100\u5206\uff0c\u5269\u4f59\u6bcf\u79d2\u5956\u52b110\u5206\uff0c\u518d\u6309\u6a21\u5f0f\u500d\u7387\u8ba1\u7b97';
    label.fontSize = 19;
    label.lineHeight = 25;
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
    const width = 440;
    const height = 88;
    const buttonNode = new Node(`${config.id}ModeButton`);
    const transform = buttonNode.addComponent(UITransform);
    const graphics = buttonNode.addComponent(Graphics);

    transform.setContentSize(width, height);
    graphics.fillColor = new Color(239, 226, 188, 255);
    graphics.strokeColor = new Color(112, 82, 45, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.stroke();

    this.addButtonText(
      buttonNode,
      `${config.name}\u6a21\u5f0f`,
      `${config.tileCount}\u5f20\u9ebb\u5c06 \u00b7 ${config.roundTime}\u79d2 \u00b7 ${config.scoreMultiplier.toFixed(1)}x`,
      width,
      height,
    );

    return buttonNode;
  }

  private addButtonText(
    buttonNode: Node,
    title: string,
    subtitle: string,
    width: number,
    height: number,
  ): void {
    const labelNode = new Node('Text');
    const transform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);

    transform.setContentSize(width, height);
    label.string = `${title}\n${subtitle}`;
    label.fontSize = 23;
    label.lineHeight = 30;
    label.color = new Color(54, 43, 30, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    buttonNode.addChild(labelNode);
  }

  private clearButtonEvents(): void {
    for (const binding of this.buttonBindings) {
      this.unbindButton(binding.node, binding.callback);
      binding.node = null;
    }

    this.buttonBindings.length = 0;
    this.onStartMode = null;
    this.initialized = false;
  }

  private unbindButton(node: Node | null, callback: () => void): void {
    if (!node || !node.isValid) {
      return;
    }

    node.off(Node.EventType.TOUCH_END, callback, this);
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
  readonly difficultyId: DifficultyId;
  readonly difficulty: DifficultyConfig;
}
