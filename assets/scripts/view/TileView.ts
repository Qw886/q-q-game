import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { TileData } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('TileView')
export class TileView extends Component {
  private readonly backgroundColor = new Color(248, 239, 211, 255);
  private readonly borderColor = new Color(126, 91, 43, 255);
  private readonly textColor = new Color(64, 50, 32, 255);

  public setup(tile: TileData, width: number, height: number): void {
    const transform = this.ensureComponent(this.node, UITransform);
    transform.setContentSize(width, height);

    this.drawTile(width, height);
    this.createLabel(tile.label, width, height);
  }

  private drawTile(width: number, height: number): void {
    const graphics = this.ensureComponent(this.node, Graphics);
    const radius = 6;
    const left = -width / 2;
    const bottom = -height / 2;

    graphics.clear();
    graphics.fillColor = this.backgroundColor;
    graphics.strokeColor = this.borderColor;
    graphics.lineWidth = 2;

    // 使用圆角矩形占位麻将，后续阶段再替换为正式素材。
    graphics.roundRect(left, bottom, width, height, radius);
    graphics.fill();
    graphics.stroke();
  }

  private createLabel(text: string, width: number, height: number): void {
    const labelNode = new Node('TileLabel');
    const transform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);

    transform.setContentSize(width, height);
    label.string = text;
    label.fontSize = Math.max(14, Math.floor(Math.min(width, height) * 0.38));
    label.lineHeight = label.fontSize + 4;
    label.color = this.textColor;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    this.node.addChild(labelNode);
  }

  private ensureComponent<T extends Component>(
    target: Node,
    ComponentClass: new () => T,
  ): T {
    return target.getComponent(ComponentClass) ?? target.addComponent(ComponentClass);
  }
}

