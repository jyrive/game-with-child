import type { PerfMonitor, PerfSample } from "./perfMonitor";
import type { AutoQuality } from "./autoQuality";

/** Pieni mittari ruudun kulmassa. Avataan FPS-napista tai P-näppäimellä. */
export class PerfHud {
  private readonly root: HTMLElement;
  private readonly text = document.createElement("pre");
  private readonly autoButton = document.createElement("button");
  private readonly note = document.createElement("div");

  constructor(
    private readonly perf: PerfMonitor,
    private readonly auto: AutoQuality,
    extraButtons: Array<{ label: string; onClick: () => void }> = [],
  ) {
    const root = document.getElementById("perfHud");
    if (!root) throw new Error("Elementti #perfHud puuttuu index.html:stä");
    this.root = root;
    this.text.textContent = "Odotetaan ensimmäistä mittausta...";
    root.appendChild(this.text);

    const row = document.createElement("div");
    row.className = "row";
    row.appendChild(this.button("Kopioi loki", () => void this.copyLog()));
    row.appendChild(this.button("Tyhjennä loki", () => this.clearLog()));
    this.autoButton.addEventListener("click", () => this.toggleAuto());
    row.appendChild(this.autoButton);
    for (const b of extraButtons) row.appendChild(this.button(b.label, b.onClick));
    root.appendChild(row);

    this.note.className = "note";
    root.appendChild(this.note);

    this.renderAuto();
    perf.onSample((s) => this.render(s));
    document.getElementById("perfToggle")?.addEventListener("click", () => this.toggle());
  }

  toggle(): void {
    this.root.hidden = !this.root.hidden;
    if (!this.root.hidden && this.perf.lastSample) this.render(this.perf.lastSample);
  }

  private render(s: PerfSample): void {
    if (this.root.hidden) return;
    const lines = [
      `FPS         ${s.fps}`,
      `Kehys ka.   ${s.avgMs.toFixed(1)} ms`,
      `Kehys p95   ${s.p95Ms.toFixed(1)} ms`,
      `Kehys max   ${s.maxMs.toFixed(1)} ms`,
      `Piirtoja    ${s.drawCalls}`,
      `Meshejä     ${s.activeMeshes}`,
      `Resoluutio  ${s.renderWidth}×${s.renderHeight}`,
      `Skaalaus    ${s.scaling.toFixed(2)}`,
      `Tökkäyksiä  ${this.perf.log.length} (nyt ${s.spikes})`,
    ];
    this.text.textContent = lines.join("\n");
    this.text.classList.toggle("warn", s.fps < 50 || s.p95Ms > 25);
  }

  private renderAuto(): void {
    this.autoButton.textContent = `Auto-laatu: ${this.auto.enabled ? "päällä" : "pois"}`;
  }

  private toggleAuto(): void {
    this.auto.enabled = !this.auto.enabled;
    if (!this.auto.enabled) this.auto.reset();
    this.renderAuto();
  }

  private async copyLog(): Promise<void> {
    const text = this.perf.exportLog();
    try {
      await navigator.clipboard.writeText(text);
      this.flash("Loki kopioitu leikepöydälle.");
    } catch {
      // Leikepöytä ei ole käytettävissä (esim. http-osoite puhelimella): tarjotaan tiedosto.
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pakohuone-laglog.json";
      a.click();
      URL.revokeObjectURL(a.href);
      this.flash("Loki ladattiin tiedostona.");
    }
  }

  private clearLog(): void {
    this.perf.clearLog();
    if (this.perf.lastSample) this.render(this.perf.lastSample);
    this.flash("Loki tyhjennetty.");
  }

  private flash(text: string): void {
    this.note.textContent = text;
    window.setTimeout(() => {
      if (this.note.textContent === text) this.note.textContent = "";
    }, 2500);
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }
}
