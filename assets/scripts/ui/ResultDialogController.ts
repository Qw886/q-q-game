import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import type { GameEndReason, GameSnapshot } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('ResultDialogController')
export class ResultDialogController extends Component {
  private restartButton: Node | null = null;
  private menuButton: Node | null = null;
  private onRestart: (() => void) | null = null;
  private onMenu: (() => void) | null = null;

  public show(
    _snapshot: GameSnapshot,
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

    const panelWidth = Math.min(460, width * 0.82);
    const panelHeight = Math.min(320, height * 0.42);
    const panel = this.createPanel(panelWidth, panelHeight);
    this.addPanelLabel(panel, 'Title', this.getTitle(reason), 0, 76, 34, panelWidth - 64, 52);
    this.addPanelLabel(panel, 'Detail', this.getDetail(reason), 0, 12, 22, panelWidth - 72, 76);

    this.restartButton = this.createButton('\u91cd\u65b0\u5f00\u59cb', 180, 54);
    this.restartButton.setPosition(-96, -92, 0);
    this.restartButton.on(Node.EventType.TOUCH_END, this.handleRestart, this);
    panel.addChild(this.restartButton);

    this.menuButton = this.createButton('\u8fd4\u56de\u83dc\u5355', 180, 54);
    this.menuButton.setPosition(96, -92, 0);
    this.menuButton.on(Node.EventType.TOUCH_END, this.handleMenu, this);
    panel.addChild(this.menuButton);

    this.node.addChild(panel);
  }

  public hide(): void {
    this.clear();
    this.node.active = false;
  }

  protected onDestroy(): void {
    this.clearButtonEvents();
    this.onRestart = null;
    this.onMenu = null;
  }

  private clear(): void {
    this.clearButtonEvents();
    this.onRestart = null;
    this.onMenu = null;
    this.destroyChildNodes();
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

  private destroyChildNodes(): void {
    const children = [...this.node.children];

    for (const child of children) {
      if (!child.isValid) {
        continue;
      }

      child.removeFromParent();
      child.destroy();
    }
  }

  private createPanel(width: number, height: number): Node {
    const panel = new Node('ResultPanel');
    const transform = panel.addComponent(UITransform);
    const graphics = panel.addComponent(Graphics);
    transform.setContentSize(width, height);
    graphics.fillColor = new Color(244, 236, 213, 255);
    graphics.strokeColor = new Color(75, 63, 44, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-width / 2, -height / 2, width, height, 9);
    graphics.fill();
    graphics.stroke();

    return panel;
  }

  private addPanelLabel(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    width: number,
    height: number,
  ): void {
    const labelNode = new Node(name);
    const transform = labelNode.addComponent(UITransform);
    const label = labelNode.addComponent(Label);
    transform.setContentSize(width, height);
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

  private getTitle(reason: GameEndReason): string {
    if (reason === 'win') {
      return '\u606d\u559c\u901a\u5173';
    }

    if (reason === 'deadlock') {
      return '\u65e0\u53ef\u6d88\u9664\u7ec4\u5408';
    }

    return '\u65f6\u95f4\u8017\u5c3d';
  }

  private getDetail(reason: GameEndReason): string {
    if (reason === 'win') {
      return '\u6240\u6709\u96c0\u724c\u5df2\u6210\u529f\u6d88\u9664';
    }

    if (reason === 'deadlock') {
      return '\u672c\u5c40\u5df2\u5f62\u6210\u6b7b\u5c40\uff0c\u8bf7\u91cd\u65b0\u6311\u6218';
    }

    return '\u8bf7\u5728\u5012\u8ba1\u65f6\u7ed3\u675f\u524d\u5b8c\u6210\u4e00\u6b21\u6d88\u9664';
  }
}
