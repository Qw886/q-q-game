import { _decorator, Color, Component, Graphics, UITransform } from 'cc';
import { GridPoint } from '../core/GameTypes';

const { ccclass } = _decorator;

export interface BoardGridMetrics {
  readonly rows: number;
  readonly columns: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly gap: number;
  readonly boardWidth: number;
  readonly boardHeight: number;
}

@ccclass('LinkLineView')
export class LinkLineView extends Component {
  public setup(width: number, height: number): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);
    this.clear();
  }

  public drawPath(points: readonly GridPoint[], metrics: BoardGridMetrics): void {
    const graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);

    graphics.clear();

    if (points.length < 2) {
      return;
    }

    const first = this.toLocalPoint(points[0], metrics);
    graphics.strokeColor = new Color(255, 231, 94, 255);
    graphics.lineWidth = Math.max(4, Math.floor(Math.min(metrics.tileWidth, metrics.tileHeight) * 0.12));
    graphics.moveTo(first.x, first.y);

    for (let index = 1; index < points.length; index += 1) {
      const current = this.toLocalPoint(points[index], metrics);
      graphics.lineTo(current.x, current.y);
    }

    graphics.stroke();
  }

  public clear(): void {
    const graphics = this.node.getComponent(Graphics);

    if (graphics) {
      graphics.clear();
    }
  }

  private toLocalPoint(point: GridPoint, metrics: BoardGridMetrics): { x: number; y: number } {
    const x = -metrics.boardWidth / 2 + metrics.tileWidth / 2 + point.column * (metrics.tileWidth + metrics.gap);
    const y = metrics.boardHeight / 2 - metrics.tileHeight / 2 - point.row * (metrics.tileHeight + metrics.gap);

    return { x, y };
  }
}

