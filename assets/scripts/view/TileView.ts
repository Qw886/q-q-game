import { _decorator, Color, Component, Graphics, Label, Node, UITransform, Vec3 } from 'cc';
import { TileData } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('TileView')
export class TileView extends Component {
  private readonly backgroundColor = new Color(248, 239, 211, 255);
  private readonly borderColor = new Color(126, 91, 43, 255);
  private readonly selectedBorderColor = new Color(76, 210, 124, 255);
  private readonly failureBorderColor = new Color(231, 82, 70, 255);
  private readonly textColor = new Color(64, 50, 32, 255);
  private tileWidth = 0;
  private tileHeight = 0;
  private removed = false;

  public setup(tile: TileData, width: number, height: number): void {
    this.node.removeAllChildren();
    this.tileWidth = width;
    this.tileHeight = height;
    this.removed = false;
    this.node.active = true;
    this.node.setScale(Vec3.ONE);

    const transform = this.ensureComponent(this.node, UITransform);
    transform.setContentSize(width, height);

    this.drawTile(this.borderColor, 2);
    this.createLabel(tile.label, width, height);
  }

  public setSelected(selected: boolean): void {
    if (this.removed) {
      return;
    }

    this.node.setScale(selected ? new Vec3(1.08, 1.08, 1) : Vec3.ONE);
    this.drawTile(selected ? this.selectedBorderColor : this.borderColor, selected ? 4 : 2);
  }

  public showFailure(): void {
    if (this.removed) {
      return;
    }

    this.node.setScale(new Vec3(1.04, 1.04, 1));
    this.drawTile(this.failureBorderColor, 4);
  }

  public clearFeedback(): void {
    if (this.removed) {
      return;
    }

    this.node.setScale(Vec3.ONE);
    this.drawTile(this.borderColor, 2);
  }

  public markRemoved(): void {
    this.removed = true;
    this.node.setScale(new Vec3(0.82, 0.82, 1));
    this.node.active = false;
  }

  private drawTile(borderColor: Color, lineWidth: number): void {
    const graphics = this.ensureComponent(this.node, Graphics);
    const radius = 6;
    const left = -this.tileWidth / 2;
    const bottom = -this.tileHeight / 2;

    graphics.clear();
    graphics.fillColor = this.backgroundColor;
    graphics.strokeColor = borderColor;
    graphics.lineWidth = lineWidth;

    // 使用圆角矩形占位麻将，后续阶段再替换为正式素材。
    graphics.roundRect(left, bottom, this.tileWidth, this.tileHeight, radius);
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
