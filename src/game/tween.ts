import type { Scene } from "@babylonjs/core/scene";

/** Pehmeä liike: hidas alku, nopea keskikohta, hidas loppu. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Kutsuu onUpdate-funktiota joka kehyksellä arvolla 0..1 durationMs:n ajan.
 * Palauttaa lupauksen, joka täyttyy kun liike on valmis.
 */
export function tween(scene: Scene, durationMs: number, onUpdate: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const engine = scene.getEngine();
    let elapsed = 0;
    const observer = scene.onBeforeRenderObservable.add(() => {
      elapsed += engine.getDeltaTime();
      const t = Math.min(1, elapsed / durationMs);
      onUpdate(easeInOut(t));
      if (t >= 1) {
        scene.onBeforeRenderObservable.remove(observer);
        resolve();
      }
    });
  });
}
