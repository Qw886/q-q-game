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
    if (this.spriteFrames.has(path)) {
      callback(this.spriteFrames.get(path) ?? null);
      return;
    }

    const pendingLoad = this.pendingLoads.get(path);

    if (pendingLoad) {
      pendingLoad.callbacks.push(callback);
      return;
    }

    this.pendingLoads.set(path, { callbacks: [callback] });
    resources.load(path, SpriteFrame, (error, spriteFrame) => {
      const callbacks = this.pendingLoads.get(path)?.callbacks ?? [];
      this.pendingLoads.delete(path);

      if (error || !spriteFrame) {
        this.spriteFrames.set(path, null);
        this.logMissingPath(path, error);
        callbacks.forEach((item) => item(null));
        return;
      }

      this.spriteFrames.set(path, spriteFrame);
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
}
