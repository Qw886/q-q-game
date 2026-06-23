import { _decorator, Color, Component, Label, Node, UITransform, Vec3 } from 'cc';
import type { GameSnapshot } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('HudController')
export class HudController extends Component {
  private modeLabel: Label | null = null;
  private remainingLabel: Label | null = null;
  private scoreLabel: Label | null = null;
  private timeLabel: Label | null = null;

  public setup(width: number, height: number): void {
    this.destroyChildNodes();
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);

    this.modeLabel = this.createLabel('Mode', -width * 0.36, height);
    this.remainingLabel = this.createLabel('Remaining', -width * 0.12, height);
    this.scoreLabel = this.createLabel('Score', width * 0.12, height);
    this.timeLabel = this.createLabel('Time', width * 0.36, height);
  }

  protected onDestroy(): void {
    this.clearLabelReferences();
  }

  public updateSnapshot(snapshot: GameSnapshot): void {
    if (this.modeLabel) {
      this.modeLabel.string = `\u6a21\u5f0f\uff1a${snapshot.modeName}`;
    }

    if (this.remainingLabel) {
      this.remainingLabel.string = `\u5269\u4f59\uff1a${snapshot.remainingTiles}`;
    }

    if (this.scoreLabel) {
      this.scoreLabel.string = `\u5206\u6570\uff1a${snapshot.score}`;
    }

    if (this.timeLabel) {
      this.timeLabel.string = `\u65f6\u95f4\uff1a${snapshot.remainingSeconds}`;
      this.timeLabel.color = snapshot.remainingSeconds <= 5
        ? new Color(255, 96, 78, 255)
        : new Color(255, 255, 255, 255);
      this.timeLabel.node.setScale(snapshot.remainingSeconds <= 5 ? new Vec3(1.12, 1.12, 1) : Vec3.ONE);
    }
  }

  private createLabel(name: string, x: number, height: number): Label {
    const labelNode = new Node(name);
    const transform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);

    transform.setContentSize(190, height);
    labelNode.setPosition(x, 0, 0);
    label.fontSize = Math.max(16, Math.floor(height * 0.24));
    label.lineHeight = label.fontSize + 6;
    label.color = new Color(255, 255, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(labelNode);

    return label;
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
    this.modeLabel = null;
    this.remainingLabel = null;
    this.scoreLabel = null;
    this.timeLabel = null;
  }
}
