import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import type { GameSnapshot } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('HudController')
export class HudController extends Component {
  private modeValueLabel: Label | null = null;
  private remainingValueLabel: Label | null = null;
  private scoreValueLabel: Label | null = null;
  private timeValueLabel: Label | null = null;

  public setup(width: number, height: number): void {
    this.destroyChildNodes();
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);

    const blockWidth = this.clamp(width * 0.235, 132, 218);
    const blockHeight = this.clamp(height * 0.74, 56, 88);
    const spacing = this.clamp(width * 0.018, 8, 18);
    const totalWidth = blockWidth * 4 + spacing * 3;
    const startX = -totalWidth / 2 + blockWidth / 2;

    this.modeValueLabel = this.createInfoBlock('ModeBlock', '\u6a21\u5f0f', startX, blockWidth, blockHeight, false);
    this.remainingValueLabel = this.createInfoBlock('RemainingBlock', '\u5269\u4f59', startX + (blockWidth + spacing), blockWidth, blockHeight, false);
    this.scoreValueLabel = this.createInfoBlock('ScoreBlock', '\u5206\u6570', startX + (blockWidth + spacing) * 2, blockWidth, blockHeight, false);
    this.timeValueLabel = this.createInfoBlock('TimeBlock', '\u65f6\u95f4', startX + (blockWidth + spacing) * 3, blockWidth, blockHeight, true);
  }

  protected onDestroy(): void {
    this.clearLabelReferences();
  }

  public updateSnapshot(snapshot: GameSnapshot): void {
    if (this.modeValueLabel) {
      this.modeValueLabel.string = snapshot.modeName;
    }

    if (this.remainingValueLabel) {
      this.remainingValueLabel.string = `${snapshot.remainingTiles}`;
    }

    if (this.scoreValueLabel) {
      this.scoreValueLabel.string = `${snapshot.score}`;
    }

    if (this.timeValueLabel) {
      this.timeValueLabel.string = `${snapshot.remainingSeconds}`;
      this.timeValueLabel.color = snapshot.remainingSeconds <= 5
        ? new Color(255, 96, 78, 255)
        : new Color(255, 255, 255, 255);
    }
  }

  private createInfoBlock(name: string, title: string, x: number, width: number, height: number, highlighted: boolean): Label {
    const blockNode = new Node(name);
    const blockTransform = blockNode.addComponent(UITransform);
    const graphics = blockNode.addComponent(Graphics);
    const titleNode = new Node('Title');
    const titleTransform = titleNode.addComponent(UITransform);
    const titleLabel = titleNode.addComponent(Label);
    const valueNode = new Node('Value');
    const valueTransform = valueNode.addComponent(UITransform);
    const valueLabel = valueNode.addComponent(Label);

    blockTransform.setContentSize(width, height);
    blockNode.setPosition(x, 0, 0);
    graphics.fillColor = highlighted
      ? new Color(82, 56, 42, 222)
      : new Color(12, 30, 25, 210);
    graphics.strokeColor = highlighted
      ? new Color(216, 180, 88, 230)
      : new Color(142, 190, 137, 206);
    graphics.lineWidth = highlighted ? 3 : 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.stroke();

    titleTransform.setContentSize(width, height * 0.36);
    titleNode.setPosition(0, height * 0.19, 0);
    titleLabel.string = title;
    titleLabel.fontSize = Math.max(14, Math.floor(height * 0.21));
    titleLabel.lineHeight = titleLabel.fontSize + 3;
    titleLabel.color = new Color(187, 215, 185, 255);
    titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    titleLabel.verticalAlign = Label.VerticalAlign.CENTER;

    valueTransform.setContentSize(width, height * 0.54);
    valueNode.setPosition(0, -height * 0.15, 0);
    valueLabel.string = '';
    valueLabel.fontSize = Math.max(23, Math.floor(height * 0.42));
    valueLabel.lineHeight = valueLabel.fontSize + 6;
    valueLabel.color = new Color(255, 255, 255, 255);
    valueLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    valueLabel.verticalAlign = Label.VerticalAlign.CENTER;

    blockNode.addChild(titleNode);
    blockNode.addChild(valueNode);
    this.node.addChild(blockNode);

    return valueLabel;
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

    this.clearLabelReferences();
  }

  private clearLabelReferences(): void {
    this.modeValueLabel = null;
    this.remainingValueLabel = null;
    this.scoreValueLabel = null;
    this.timeValueLabel = null;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }
}
