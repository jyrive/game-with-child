import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { PerfSample } from "./perfMonitor";

export interface AutoQualityOptions {
  /** Paras taso (pienin luku). Esim. 0.5 = kaksi kuvapistettä per CSS-pikseli. */
  best: number;
  /** Huonoin sallittu taso. 2 = puolet CSS-pikseleistä. */
  worst: number;
  /** Tämän alle pudonnut fps laskee laatua. */
  lowFps: number;
  /** Tämän yli pysyvä fps nostaa laatua takaisin. */
  highFps: number;
}

/**
 * Pudottaa renderöintitarkkuutta, jos kuvanopeus laskee, ja nostaa sen takaisin kun peli pyörii sujuvasti.
 * Babylonin "hardware scaling level": 1 = yksi kuvapiste per CSS-pikseli, 0.5 = tuplatarkkuus, 2 = puolet.
 * Resoluutio on puhelimella yleensä tehokkain yksittäinen säätö.
 */
export class AutoQuality {
  enabled = true;
  onChange?: (level: number) => void;

  private slowSeconds = 0;
  private fastSeconds = 0;

  constructor(
    private readonly engine: AbstractEngine,
    private readonly opts: AutoQualityOptions,
  ) {}

  get level(): number {
    return this.engine.getHardwareScalingLevel();
  }

  handle(sample: PerfSample): void {
    if (!this.enabled) return;
    if (sample.fps < this.opts.lowFps) {
      this.slowSeconds++;
      this.fastSeconds = 0;
    } else if (sample.fps > this.opts.highFps) {
      this.fastSeconds++;
      this.slowSeconds = 0;
    } else {
      this.slowSeconds = 0;
      this.fastSeconds = 0;
    }

    if (this.slowSeconds >= 2 && this.level < this.opts.worst) {
      this.set(Math.min(this.opts.worst, this.level * 1.25));
      this.slowSeconds = 0;
    } else if (this.fastSeconds >= 10 && this.level > this.opts.best) {
      this.set(Math.max(this.opts.best, this.level / 1.25));
      this.fastSeconds = 0;
    }
  }

  reset(): void {
    this.set(this.opts.best);
    this.slowSeconds = 0;
    this.fastSeconds = 0;
  }

  private set(level: number): void {
    this.engine.setHardwareScalingLevel(level);
    this.onChange?.(level);
  }
}
