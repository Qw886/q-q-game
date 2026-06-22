import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { GameEndReason, GameSnapshot } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('ResultDialogController')
export class ResultDialogController extends Component {
  private restartButton: Node | null = null;
  private menuButton: Node | null = null;
  private onRestart: (() => void) | null = null;
  private onMenu: (() => void) | null = null;

  public show(
    snapshot: GameSnapshot,
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

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    const graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    transform.setContentSize(width, height);
    graphics.clear();
    graphics.fillColor = new Color(0, 0, 0, 150);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();

    const panel = this.createPanel(Math.min(460, width * 0.78), Math.min(360, height * 0.48));
    const title = reason === 'win' ? '通关成功' : '时间结束';
    const detail = reason === 'win'
      ? `最终分数：${snapshot.score}\n剩余：${snapshot.remainingTiles}`
      : `最终分数：${snapshot.score}\n剩余麻将：${snapshot.remainingTiles}`;

    this.addPanelLabel(panel, 'Title', title, 0, 90, 34);
    this.addPanelLabel(panel, 'Detail', detail, 0, 28, 24);

    this.restartButton = this.createButton('重新开始', 180, 54);
    this.restartButton.setPosition(-100, -92, 0);
    this.restartButton.on(Node.EventType.TOUCH_END, this.handleRestart, this);
    panel.addChild(this.restartButton);

    this.menuButton = this.createButton('返回菜单', 180, 54);
    this.menuButton.setPosition(100, -92, 0);
    this.menuButton.on(Node.EventType.TOUCH_END, this.handleMenu, this);
    panel.addChild(this.menuButton);

    this.node.addChild(panel);
  }

  public hide(): void {
    this.clear();
    this.node.active = false;
  }

  protected onDestroy(): void {
    this.clear();
  }

  private clear(): void {
    this.clearButtonEvents();
    this.node.removeAllChildren();
    const graphics = this.node.getComponent(Graphics);

    if (graphics) {
      graphics.clear();
    }
  }

  private clearButtonEvents(): void {
    if (this.restartButton && this.restartButton.isValid) {
      this.restartButton.off(Node.EventType.TOUCH_END, this.handleRestart, this);
    }

    if (this.menuButton && this.menuButton.isValid) {
      this.menuButton.off(Node.EventType.TOUCH_END, this.handleMenu, this);
    }

    this.restartButton = null;
    this.menuButton = null;
  }

  private createPanel(width: number, height: number): Node {
    const panel = new Node('ResultPanel');
    const transform = panel.addComponent(UITransform);
    const graphics = panel.addComponent(Graphics);
    transform.setContentSize(width, height);
    graphics.fillColor = new Color(245, 236, 211, 255);
    graphics.strokeColor = new Color(80, 62, 38, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-width / 2, -height / 2, width, height, 10);
    graphics.fill();
    graphics.stroke();

    return panel;
  }

  private addPanelLabel(parent: Node, name: string, text: string, x: number, y: number, fontSize: number): void {
    const labelNode = new Node(name);
    const transform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);
    transform.setContentSize(360, 92);
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
}
