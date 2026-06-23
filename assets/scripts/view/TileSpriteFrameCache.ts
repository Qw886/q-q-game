import { resources, SpriteFrame } from 'cc';

type SpriteFrameCallback = (spriteFrame: SpriteFrame | null) => void;

interface PendingLoad {
  readonly callbacks: SpriteFrameCallback[];
}

export class TileSpriteFrameCache {
  private static readonly spriteFrames = new Map<string, SpriteFrame | null>();
  private static readonly pendingLoads = new Map<string, PendingLoad>();
  private static missingResourceWarningLogged = false;

  public static load(path: string, callback: SpriteFrameCallback): void {
    const spriteFramePath = this.toSpriteFramePath(path);

    if (this.spriteFrames.has(spriteFramePath)) {
      callback(this.spriteFrames.get(spriteFramePath) ?? null);
      return;
    }

    const pendingLoad = this.pendingLoads.get(spriteFramePath);

    if (pendingLoad) {
      pendingLoad.callbacks.push(callback);
      return;
    }

    this.pendingLoads.set(spriteFramePath, { callbacks: [callback] });
    resources.load(spriteFramePath, SpriteFrame, (error, spriteFrame) => {
      const callbacks = this.pendingLoads.get(spriteFramePath)?.callbacks ?? [];
      this.pendingLoads.delete(spriteFramePath);

      if (error || !spriteFrame) {
        this.spriteFrames.set(spriteFramePath, null);
        this.logMissingPath(spriteFramePath, error);
        callbacks.forEach((item) => item(null));
        return;
      }

      this.spriteFrames.set(spriteFramePath, spriteFrame);
      callbacks.forEach((item) => item(spriteFrame));
    });
  }

  public static getStats(): { cachedSuccessCount: number; cachedFailureCount: number; pendingLoadCount: number } {
    let cachedSuccessCount = 0;
    let cachedFailureCount = 0;

    for (const spriteFrame of this.spriteFrames.values()) {
      if (spriteFrame) {
        cachedSuccessCount += 1;
      } else {
        cachedFailureCount += 1;
      }
    }

    return {
      cachedSuccessCount,
      cachedFailureCount,
      pendingLoadCount: this.pendingLoads.size,
    };
  }

  private static logMissingPath(path: string, error: Error | null): void {
    if (this.missingResourceWarningLogged) {
      return;
    }

    this.missingResourceWarningLogged = true;
    console.warn(
      `[TileSpriteFrameCache] Some tile SpriteFrame resources are missing. Fallback text will be used. First missing path: resources/${path}.`,
      error ?? '',
    );
  }

  private static toSpriteFramePath(path: string): string {
    return path.endsWith('/spriteFrame') ? path : `${path}/spriteFrame`;
  }
}
