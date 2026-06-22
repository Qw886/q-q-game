import { _decorator, Color, Component, Label, Node, UITransform, Vec3 } from 'cc';
import { GameSnapshot } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('HudController')
export class HudController extends Component {
  private modeLabel: Label | null = null;
  private remainingLabel: Label | null = null;
  private scoreLabel: Label | null = null;
  private timeLabel: Label | null = null;

  public setup(width: number, height: number): void {
    this.node.removeAllChildren();
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);

    this.modeLabel = this.createLabel('Mode', -width * 0.36, height);
    this.remainingLabel = this.createLabel('Remaining', -width * 0.12, height);
    this.scoreLabel = this.createLabel('Score', width * 0.12, height);
    this.timeLabel = this.createLabel('Time', width * 0.36, height);
  }

  public updateSnapshot(snapshot: GameSnapshot): void {
    if (this.modeLabel) {
      this.modeLabel.string = `模式：${snapshot.modeName}`;
    }

    if (this.remainingLabel) {
      this.remainingLabel.string = `剩余：${snapshot.remainingTiles}`;
    }

    if (this.scoreLabel) {
      this.scoreLabel.string = `分数：${snapshot.score}`;
    }

    if (this.timeLabel) {
      this.timeLabel.string = `时间：${snapshot.remainingSeconds}`;
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

    transform.setContentSize(180, height);
    labelNode.setPosition(x, 0, 0);
    label.fontSize = Math.max(18, Math.floor(height * 0.26));
    label.lineHeight = label.fontSize + 6;
    label.color = new Color(255, 255, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(labelNode);

    return label;
  }
}
