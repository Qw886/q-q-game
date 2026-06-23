import { _decorator, Color, Component, Graphics, Tween, tween, UIOpacity, UITransform } from 'cc';
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
  private animationId = 0;
  private progressTarget: { progress: number } | null = null;

  public setup(width: number, height: number): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);

    transform.setContentSize(width, height);
    opacity.opacity = 255;
    this.clear();
  }

  public drawPathAnimated(
    points: readonly GridPoint[],
    metrics: BoardGridMetrics,
    onComplete: () => void,
  ): void {
    const graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    const animationId = this.beginAnimation(opacity);

    if (points.length < 2) {
      onComplete();
      return;
    }

    const localPoints = points.map((point) => this.toLocalPoint(point, metrics));
    const minTileSize = Math.min(metrics.tileWidth, metrics.tileHeight);
    const haloWidth = Math.max(8, Math.floor(minTileSize * 0.22));
    const mainWidth = Math.max(3, Math.floor(minTileSize * 0.08));
    const segments = this.calculateSegments(localPoints);
    const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
    const duration = this.clamp(totalLength / 800, 0.28, 0.65);
    const progressTarget = { progress: 0 };

    this.progressTarget = progressTarget;
    this.drawProgress(graphics, localPoints, segments, totalLength, 0, haloWidth, mainWidth);

    tween(progressTarget)
      .to(duration, { progress: 1 }, {
        onUpdate: () => {
          if (animationId !== this.animationId) {
            return;
          }

          this.drawProgress(graphics, localPoints, segments, totalLength, progressTarget.progress, haloWidth, mainWidth);
        },
      })
      .call(() => {
        if (animationId !== this.animationId) {
          return;
        }

        this.drawProgress(graphics, localPoints, segments, totalLength, 1, haloWidth, mainWidth);
        tween(opacity)
          .delay(0.1)
          .to(0.08, { opacity: 0 })
          .call(() => {
            if (animationId !== this.animationId) {
              return;
            }

            this.clear();
            onComplete();
          })
          .start();
      })
      .start();
  }

  public clear(): void {
    const graphics = this.node.getComponent(Graphics);
    const opacity = this.node.getComponent(UIOpacity);

    this.animationId += 1;
    Tween.stopAllByTarget(this.node);
    if (this.progressTarget) {
      Tween.stopAllByTarget(this.progressTarget);
      this.progressTarget = null;
    }

    if (opacity) {
      Tween.stopAllByTarget(opacity);
      opacity.opacity = 255;
    }

    if (graphics) {
      graphics.clear();
    }
  }

  protected onDestroy(): void {
    this.clear();
  }

  private toLocalPoint(point: GridPoint, metrics: BoardGridMetrics): { x: number; y: number } {
    const x = -metrics.boardWidth / 2 + metrics.tileWidth / 2 + point.column * (metrics.tileWidth + metrics.gap);
    const y = metrics.boardHeight / 2 - metrics.tileHeight / 2 - point.row * (metrics.tileHeight + metrics.gap);

    return { x, y };
  }

  private strokePolyline(
    graphics: Graphics,
    points: readonly { x: number; y: number }[],
    color: Color,
    lineWidth: number,
  ): void {
    const first = points[0];

    graphics.strokeColor = color;
    graphics.lineWidth = lineWidth;
    graphics.moveTo(first.x, first.y);

    for (let index = 1; index < points.length; index += 1) {
      const current = points[index];
      graphics.lineTo(current.x, current.y);
    }

    graphics.stroke();
  }

  private drawProgress(
    graphics: Graphics,
    points: readonly LocalPoint[],
    segments: readonly PathSegment[],
    totalLength: number,
    progress: number,
    haloWidth: number,
    mainWidth: number,
  ): void {
    graphics.clear();

    if (points.length < 2 || totalLength <= 0) {
      return;
    }

    const targetLength = totalLength * this.clamp(progress, 0, 1);
    const partialPoints = this.buildPartialPoints(points[0], segments, targetLength);

    if (partialPoints.length < 2) {
      return;
    }

    this.strokePolyline(graphics, partialPoints, new Color(255, 184, 52, 78), haloWidth);
    this.strokePolyline(graphics, partialPoints, new Color(255, 228, 97, 245), mainWidth);
  }

  private buildPartialPoints(
    startPoint: LocalPoint,
    segments: readonly PathSegment[],
    targetLength: number,
  ): LocalPoint[] {
    const points: LocalPoint[] = [{ x: startPoint.x, y: startPoint.y }];
    let remainingLength = targetLength;

    for (const segment of segments) {
      if (remainingLength >= segment.length) {
        points.push({ x: segment.to.x, y: segment.to.y });
        remainingLength -= segment.length;
        continue;
      }

      if (remainingLength > 0) {
        const ratio = remainingLength / segment.length;
        points.push({
          x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
          y: segment.from.y + (segment.to.y - segment.from.y) * ratio,
        });
      }

      break;
    }

    return points;
  }

  private calculateSegments(points: readonly LocalPoint[]): PathSegment[] {
    const segments: PathSegment[] = [];

    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length <= 0) {
        continue;
      }

      segments.push({ from, to, length });
    }

    return segments;
  }

  private beginAnimation(opacity: UIOpacity): number {
    this.animationId += 1;
    Tween.stopAllByTarget(this.node);
    Tween.stopAllByTarget(opacity);
    if (this.progressTarget) {
      Tween.stopAllByTarget(this.progressTarget);
      this.progressTarget = null;
    }

    opacity.opacity = 255;

    const graphics = this.node.getComponent(Graphics);
    if (graphics) {
      graphics.clear();
    }

    return this.animationId;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }
}

interface LocalPoint {
  readonly x: number;
  readonly y: number;
}

interface PathSegment {
  readonly from: LocalPoint;
  readonly to: LocalPoint;
  readonly length: number;
}
