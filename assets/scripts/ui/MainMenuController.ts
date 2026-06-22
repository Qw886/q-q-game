import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { DifficultyConfig, DifficultyId } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('MainMenuController')
export class MainMenuController extends Component {
  private readonly buttonBindings: ButtonBinding[] = [];
  private readonly hideUnavailableMessageCallback = (): void => this.hideUnavailableMessage();
  private messageNode: Node | null = null;
  private messageLabel: Label | null = null;
  private onStartNormal: (() => void) | null = null;
  private initialized = false;

  public setup(difficulties: readonly DifficultyConfig[], onStartNormal: () => void): void {
    this.onStartNormal = onStartNormal;
    this.hideUnavailableMessage();

    if (this.initialized) {
      return;
    }

    const rootSize = this.getRootSize();
    this.createTitle(rootSize.height);
    this.createModeButtons(difficulties);
    this.createScoreHint(rootSize.height);
    this.createMessage(rootSize.height);
    this.initialized = true;
  }

  protected onDestroy(): void {
    this.cancelUnavailableMessageTimer();
    this.clearButtonEvents();
  }

  protected onDisable(): void {
    this.cancelUnavailableMessageTimer();
  }

  private createTitle(height: number): void {
    const titleNode = new Node('Title');
    const transform = titleNode.addComponent(UITransform);
    const label = titleNode.addComponent(Label);

    transform.setContentSize(520, 92);
    titleNode.setPosition(0, height / 2 - 170, 0);
    label.string = '雀牌连线';
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

      buttonNode.setPosition(0, 110 - index * 110, 0);
      buttonNode.on(Node.EventType.TOUCH_END, callback, this);
      this.buttonBindings.push({ node: buttonNode, callback });
      this.node.addChild(buttonNode);
    });
  }

  private createMessage(height: number): void {
    this.messageNode = new Node('Message');
    const transform = this.messageNode.addComponent(UITransform);
    this.messageLabel = this.messageNode.addComponent(Label);

    transform.setContentSize(560, 48);
    this.messageNode.setPosition(0, Math.max(-height / 2 + 45, -300), 0);
    this.messageNode.active = false;
    this.messageLabel.string = '该模式将在后续阶段开放';
    this.messageLabel.fontSize = 22;
    this.messageLabel.lineHeight = 28;
    this.messageLabel.color = new Color(255, 232, 177, 255);
    this.messageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.messageLabel.verticalAlign = Label.VerticalAlign.CENTER;

    this.node.addChild(this.messageNode);
  }

  private createScoreHint(height: number): void {
    const hintNode = new Node('ScoreHint');
    const transform = hintNode.addComponent(UITransform);
    const label = hintNode.addComponent(Label);

    transform.setContentSize(560, 52);
    hintNode.setPosition(0, Math.max(-height / 2 + 90, -230), 0);
    label.string = '计分：每对基础100分，剩余每秒奖励10分';
    label.fontSize = 20;
    label.lineHeight = 26;
    label.color = new Color(230, 245, 210, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    this.node.addChild(hintNode);
  }

  private handleModeSelected(id: DifficultyId): void {
    if (id === 'normal') {
      this.hideUnavailableMessage();
      if (this.onStartNormal) {
        this.onStartNormal();
      }
      return;
    }

    this.showUnavailableMessage();
  }

  private createModeButton(config: DifficultyConfig): Node {
    const width = 430;
    const height = 82;
    const buttonNode = new Node(`${config.name}ModeButton`);
    const transform = buttonNode.addComponent(UITransform);
    const graphics = buttonNode.addComponent(Graphics);

    transform.setContentSize(width, height);
    graphics.fillColor = new Color(239, 226, 188, 255);
    graphics.strokeColor = new Color(112, 82, 45, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.stroke();

    this.addButtonText(buttonNode, `${config.name}模式`, `${config.tileCount}张麻将 · ${config.roundTime}秒`, width, height);

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
    label.fontSize = 24;
    label.lineHeight = 31;
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
    this.cancelUnavailableMessageTimer();
    this.messageNode = null;
    this.messageLabel = null;
    this.onStartNormal = null;
    this.initialized = false;
  }

  private unbindButton(node: Node | null, callback: () => void): void {
    if (!node || !node.isValid) {
      return;
    }

    node.off(Node.EventType.TOUCH_END, callback, this);
  }

  private showUnavailableMessage(): void {
    this.cancelUnavailableMessageTimer();

    if (!this.messageNode || !this.messageLabel) {
      return;
    }

    this.messageLabel.string = '该模式将在后续阶段开放';
    this.messageNode.active = true;
    this.scheduleOnce(this.hideUnavailableMessageCallback, 2);
  }

  private hideUnavailableMessage(): void {
    this.cancelUnavailableMessageTimer();

    if (this.messageNode && this.messageNode.isValid) {
      this.messageNode.active = false;
    }
  }

  private cancelUnavailableMessageTimer(): void {
    this.unschedule(this.hideUnavailableMessageCallback);
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
}
