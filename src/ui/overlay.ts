import { CONFIG } from "../game/config";

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Elementti #${id} puuttuu index.html:stä`);
  return e as T;
}

export interface OverlayHandlers {
  onRestart: () => void;
}

/** HTML-käyttöliittymä canvasin päällä: viestit, tasku, koodilukko, loppuruutu ja häivytys. */
export class Overlay {
  private readonly message = el<HTMLDivElement>("message");
  private readonly hint = el<HTMLDivElement>("hint");
  private readonly inventory = el<HTMLDivElement>("inventory");
  private readonly roomLabel = el<HTMLButtonElement>("roomLabel");
  private readonly codeLock = el<HTMLDivElement>("codeLock");
  private readonly codeDisplay = el<HTMLDivElement>("codeDisplay");
  private readonly keypad = el<HTMLDivElement>("keypad");
  private readonly win = el<HTMLDivElement>("win");
  private readonly winTitle = el<HTMLDivElement>("winTitle");
  private readonly winTime = el<HTMLDivElement>("winTime");
  private readonly fadeEl = el<HTMLDivElement>("fade");

  private messageTimer = 0;
  private hintTimer = 0;
  private entered = "";
  private codeLength = 3;
  private openedAt = 0;
  private onCode: ((code: string) => boolean) | null = null;

  constructor(handlers: OverlayHandlers) {
    el("codeClose").addEventListener("click", () => this.closeCodeLock());
    el("restart").addEventListener("click", () => {
      this.win.hidden = true;
      handlers.onRestart();
    });
    this.roomLabel.addEventListener("click", () => {
      if (confirm(CONFIG.texts.restartConfirm)) handlers.onRestart();
    });
    this.buildKeypad();
    this.renderCode();
  }

  get modalOpen(): boolean {
    return !this.codeLock.hidden || !this.win.hidden;
  }

  setRoomLabel(text: string): void {
    this.roomLabel.textContent = text;
  }

  setInventory(items: string[]): void {
    this.inventory.replaceChildren(
      ...items.map((item) => {
        const chip = document.createElement("span");
        chip.className = "chipItem";
        chip.textContent = item;
        return chip;
      }),
    );
  }

  showMessage(text: string, ms = 3200): void {
    this.message.textContent = text;
    this.message.hidden = false;
    clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message.hidden = true;
    }, ms);
  }

  /** Ohjevinkki ruudun alalaidassa, esim. ohjaimet alussa. */
  showHint(text: string, ms = 10000): void {
    this.hint.textContent = text;
    this.hint.hidden = false;
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => {
      this.hint.hidden = true;
    }, ms);
  }

  /** Häivyttää ruudun mustaan (true) tai takaisin (false). */
  fade(toBlack: boolean): Promise<void> {
    this.fadeEl.classList.toggle("on", toBlack);
    return new Promise((resolve) => window.setTimeout(resolve, 450));
  }

  /** Avaa koodilukon. onCode palauttaa true, jos koodi oli oikein. */
  openCodeLock(onCode: (code: string) => boolean, codeLength = 3): void {
    this.onCode = onCode;
    this.codeLength = codeLength;
    this.entered = "";
    this.renderCode();
    this.codeLock.hidden = false;
    this.openedAt = performance.now();
  }

  closeCodeLock(): void {
    this.codeLock.hidden = true;
    this.onCode = null;
  }

  showWin(title: string, timeText: string): void {
    this.winTitle.textContent = title;
    this.winTime.textContent = timeText;
    this.win.hidden = false;
  }

  /** Näppäimistösyöttö koodilukkoon. Palauttaa true, jos näppäin käytettiin. */
  handleKey(e: KeyboardEvent): boolean {
    if (this.codeLock.hidden) return false;
    if (/^[0-9]$/.test(e.key)) this.press(e.key);
    else if (e.key === "Backspace") this.press("⌫");
    else if (e.key === "Enter") this.press("OK");
    else if (e.key === "Escape") this.closeCodeLock();
    else return false;
    e.preventDefault();
    return true;
  }

  private buildKeypad(): void {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];
    for (const key of keys) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = key;
      if (key === "OK") b.classList.add("ok");
      b.addEventListener("click", () => this.press(key));
      this.keypad.appendChild(b);
    }
  }

  private press(key: string): void {
    if (performance.now() - this.openedAt < 350) return; // sama kosketus, joka avasi lukon, ei saa painaa nappia
    if (key === "OK") {
      this.submit();
      return;
    }
    if (key === "⌫") this.entered = this.entered.slice(0, -1);
    else if (this.entered.length < this.codeLength) this.entered += key;
    this.renderCode();
  }

  private submit(): void {
    if (this.entered.length < this.codeLength) {
      this.shake();
      return;
    }
    const ok = this.onCode?.(this.entered) ?? false;
    if (!ok) {
      this.shake();
      this.entered = "";
      this.renderCode();
    }
  }

  private shake(): void {
    this.codeDisplay.classList.remove("shake");
    void this.codeDisplay.offsetWidth; // pakottaa animaation alkamaan alusta
    this.codeDisplay.classList.add("shake");
  }

  private renderCode(): void {
    const cells = Array.from({ length: this.codeLength }, (_, i) => {
      const span = document.createElement("span");
      span.textContent = this.entered[i] ?? "·";
      return span;
    });
    this.codeDisplay.replaceChildren(...cells);
  }
}
