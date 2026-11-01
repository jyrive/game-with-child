import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";

/** Yhteenveto yhdestä sekunnista. */
export interface PerfSample {
  fps: number;
  /** Kehysajan keskiarvo millisekunteina. 16.7 ms = 60 fps. */
  avgMs: number;
  /** 95 % kehyksistä oli tätä nopeampia. Kertoo tökkimisestä paremmin kuin keskiarvo. */
  p95Ms: number;
  maxMs: number;
  drawCalls: number;
  activeMeshes: number;
  renderWidth: number;
  renderHeight: number;
  scaling: number;
  /** Rajan ylittäneiden kehysten määrä tämän sekunnin aikana. */
  spikes: number;
}

/** Yksi tökkäys: milloin, kuinka pitkä kehys ja missä näkymässä. */
export interface LagEvent {
  t: number;
  ms: number;
  view: string;
}

export interface PerfOptions {
  /** Kehys, joka kestää tätä pidempään, kirjataan tökkäykseksi. 33 ms = alle 30 fps. */
  spikeMs?: number;
  /** Alussa shaderit käännetään ja kaikki on hidasta. Sitä ei lasketa. */
  warmupMs?: number;
  /** Mikä näkymä on auki; tallennetaan tökkäyksen yhteyteen. */
  context?: () => string;
  storageKey?: string;
  maxLog?: number;
}

const DEFAULTS = {
  spikeMs: 33,
  warmupMs: 3000,
  context: () => "",
  storageKey: "pakohuone.laglog",
  maxLog: 300,
};

/**
 * Mittaa jokaisen kehyksen keston ja kokoaa sekunnin välein yhteenvedon.
 * Pitkät kehykset tallennetaan lokiin selaimen muistiin, jotta puhelimella pelatun
 * testin voi käydä läpi jälkikäteen.
 */
export class PerfMonitor {
  readonly log: LagEvent[];
  lastSample: PerfSample | null = null;

  private readonly opts: Required<PerfOptions>;
  private readonly instrumentation: SceneInstrumentation;
  private readonly startedAt = performance.now();
  private frames: number[] = [];
  private windowStart = performance.now();
  private lastFrameAt = performance.now();
  private saveTimer = 0;
  private readonly listeners: Array<(s: PerfSample) => void> = [];

  constructor(
    private readonly engine: AbstractEngine,
    private readonly scene: Scene,
    opts: PerfOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...opts };
    this.instrumentation = new SceneInstrumentation(scene);
    this.log = this.loadLog();
    scene.onAfterRenderObservable.add(() => this.onFrame());
    document.addEventListener("visibilitychange", () => this.resetWindow());
  }

  onSample(listener: (s: PerfSample) => void): void {
    this.listeners.push(listener);
  }

  clearLog(): void {
    this.log.length = 0;
    try {
      localStorage.removeItem(this.opts.storageKey);
    } catch {
      /* yksityinen tila tms. */
    }
  }

  /** Loki tekstinä laitetietojen kanssa. Tämän voi liittää viestiin tai tallentaa tiedostoon. */
  exportLog(): string {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        device: {
          userAgent: navigator.userAgent,
          devicePixelRatio: window.devicePixelRatio,
          screen: `${screen.width}x${screen.height}`,
          cores: navigator.hardwareConcurrency ?? null,
          memoryGb: nav.deviceMemory ?? null,
        },
        spikeThresholdMs: this.opts.spikeMs,
        lastSample: this.lastSample,
        spikes: this.log,
      },
      null,
      2,
    );
  }

  private onFrame(): void {
    const now = performance.now();
    const dt = now - this.lastFrameAt;
    this.lastFrameAt = now;

    if (now - this.startedAt < this.opts.warmupMs) {
      this.windowStart = now;
      return;
    }
    if (dt > 1000) return; // välilehti oli piilossa tai laite nukkui

    this.frames.push(dt);
    if (dt > this.opts.spikeMs) this.recordSpike(now, dt);
    if (now - this.windowStart >= 1000) this.flush(now);
  }

  private flush(now: number): void {
    const n = this.frames.length;
    if (n === 0) return;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const sum = this.frames.reduce((a, b) => a + b, 0);
    const sample: PerfSample = {
      fps: Math.round((n * 1000) / (now - this.windowStart)),
      avgMs: sum / n,
      p95Ms: sorted[Math.floor((n - 1) * 0.95)] ?? 0,
      maxMs: sorted[n - 1] ?? 0,
      drawCalls: this.instrumentation.drawCallsCounter.current,
      activeMeshes: this.scene.getActiveMeshes().length,
      renderWidth: this.engine.getRenderWidth(),
      renderHeight: this.engine.getRenderHeight(),
      scaling: this.engine.getHardwareScalingLevel(),
      spikes: this.frames.filter((f) => f > this.opts.spikeMs).length,
    };
    this.frames = [];
    this.windowStart = now;
    this.lastSample = sample;
    for (const l of this.listeners) l(sample);
  }

  private resetWindow(): void {
    this.lastFrameAt = performance.now();
    this.windowStart = this.lastFrameAt;
    this.frames = [];
  }

  private recordSpike(now: number, dt: number): void {
    this.log.push({
      t: Math.round((now - this.startedAt) / 100) / 10,
      ms: Math.round(dt),
      view: this.opts.context(),
    });
    if (this.log.length > this.opts.maxLog) this.log.splice(0, this.log.length - this.opts.maxLog);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = 0;
      try {
        localStorage.setItem(this.opts.storageKey, JSON.stringify(this.log));
      } catch {
        /* ei tilaa tai yksityinen tila */
      }
    }, 2000);
  }

  private loadLog(): LagEvent[] {
    try {
      const raw = localStorage.getItem(this.opts.storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as LagEvent[]) : [];
    } catch {
      return [];
    }
  }
}
