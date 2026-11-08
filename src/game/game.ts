import type { Scene } from "@babylonjs/core/scene";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CONFIG } from "./config";
import { ROOMS } from "./rooms";
import type { RoomDefinition, TapBehavior } from "./rooms/types";
import { buildRoom, DOOR_ID, KEYPAD_ID, type BuiltRoom } from "./roomBuilder";
import { tween } from "./tween";
import type { Avatar } from "./avatar";
import type { FurnitureLibrary } from "./furnitureLibrary";
import type { CharacterController } from "./characterController";
import { resetCamera } from "./followCamera";
import type { Overlay } from "../ui/overlay";

const PROGRESS_KEY = "pakohuone.progress";
const DOOR_OPEN_DEG = 110;

interface Progress {
  room: number;
  elapsedBefore: number;
}

/** Pelin säännöt: huoneet järjestyksessä, tasku, mitä napautuksista tapahtuu. */
export class Game {
  private built: BuiltRoom | null = null;
  private roomIndex = 0;
  private readonly inventory = new Set<string>();
  private readonly tapped = new Set<string>();
  private unlocked = false;
  private doorOpen = false;
  private busy = false;
  private finished = false;
  private roomStartedAt = performance.now();
  private elapsedBefore = 0;
  private furniture: FurnitureLibrary | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly ui: Overlay,
    private readonly avatar: Avatar,
    private readonly controller: CharacterController,
    private readonly camera: ArcRotateCamera,
    /** Huonekalumallit. Ensimmäinen huone rakennetaan vasta, kun ne on ladattu (tai lataus epäonnistui). */
    private readonly furnitureLoading: Promise<FurnitureLibrary | null>,
  ) {}

  get roomName(): string {
    return this.built ? `${this.roomIndex + 1}: ${this.built.def.name}` : "-";
  }

  get currentRoom(): RoomDefinition | null {
    return this.built?.def ?? null;
  }

  /** Jatkaa tallennetusta huoneesta tai aloittaa alusta. */
  async start(): Promise<void> {
    this.furniture = await this.furnitureLoading;
    const saved = this.loadProgress();
    this.elapsedBefore = saved?.elapsedBefore ?? 0;
    this.loadRoom(Math.min(saved?.room ?? 0, ROOMS.length - 1));
  }

  restart(): void {
    this.clearProgress();
    this.elapsedBefore = 0;
    this.finished = false;
    this.controller.enabled = true;
    this.loadRoom(0);
  }

  /** Joka kehyksellä: huomaa, kun hahmo kävelee avoimesta ovesta. */
  update(): void {
    if (!this.built || !this.doorOpen || this.busy || this.finished) return;
    const { depth } = this.built.def.size;
    const p = this.avatar.position;
    if (Math.abs(p.x - this.built.def.doorX) < 0.55 && p.z > depth / 2 - 0.75) void this.leaveRoom();
  }

  /** Pelaaja napautti esinettä. point on kohta, johon napautus osui. */
  onTap(id: string, point: Vector3): void {
    if (!this.built || this.finished || this.busy) return;
    const behavior = this.behaviorOf(id);
    if (!behavior) return;

    if (!this.withinReach(point)) {
      this.ui.showMessage(behavior.farMessage ?? CONFIG.texts.tooFar);
      return;
    }
    if (id === DOOR_ID) {
      this.tapDoor();
      return;
    }
    if (behavior.keypad) {
      this.tapKeypad();
      return;
    }
    if (behavior.requires && !this.inventory.has(behavior.requires)) {
      this.ui.showMessage(behavior.lockedMessage ?? CONFIG.texts.lockedDefault);
      return;
    }

    const first = !this.tapped.has(id);
    this.tapped.add(id);
    if (first && (behavior.swing !== undefined || behavior.reveals || behavior.gives)) this.avatar.playOnce("Interact");
    if (first && behavior.swing !== undefined) this.swing(id, behavior.swing);
    if (first && behavior.reveals) for (const r of behavior.reveals) this.setVisible(r, true);
    if (first && behavior.gives) {
      this.inventory.add(behavior.gives);
      this.ui.setInventory([...this.inventory]);
      this.setVisible(id, false);
    }
    const text = first ? behavior.message : (behavior.messageAgain ?? behavior.message);
    if (text) this.ui.showMessage(text);
  }

  private behaviorOf(id: string): TapBehavior | undefined {
    if (id === DOOR_ID) return {};
    if (id === KEYPAD_ID) return { keypad: true };
    return this.built?.def.objects.find((o) => o.id === id)?.onTap;
  }

  private withinReach(point: Vector3): boolean {
    const p = this.avatar.position;
    const horizontal = Math.hypot(point.x - p.x, point.z - p.z);
    const dy = point.y - p.y;
    const r = CONFIG.reach;
    return horizontal <= r.horizontal && dy <= r.up && dy >= -r.down;
  }

  private tapDoor(): void {
    if (!this.built) return;
    if (this.doorOpen) {
      this.ui.showMessage(CONFIG.texts.doorOpenAlready);
      return;
    }
    if (!this.unlocked) {
      this.ui.showMessage(CONFIG.texts.doorLocked);
      return;
    }
    this.doorOpen = true;
    for (const m of this.built.door.meshes) m.checkCollisions = false;
    this.swing(DOOR_ID, DOOR_OPEN_DEG);
    this.ui.showMessage(CONFIG.texts.doorOpening, 4000);
  }

  private tapKeypad(): void {
    if (this.unlocked) this.ui.showMessage(CONFIG.texts.keypadUnlocked);
    else this.ui.openCodeLock((code) => this.tryCode(code));
  }

  private tryCode(code: string): boolean {
    if (!this.built) return false;
    if (code !== this.built.def.code) {
      this.ui.showMessage(CONFIG.texts.codeWrong);
      return false;
    }
    this.unlocked = true;
    this.built.door.led.emissiveColor = Color3.FromHexString("#20ff50");
    this.ui.closeCodeLock();
    this.ui.showMessage(CONFIG.texts.codeRight);
    return true;
  }

  private swing(id: string, degrees: number): void {
    const s = this.built?.swingables.get(id);
    if (!s) return;
    const target = (degrees * Math.PI) / 180;
    void tween(this.scene, 900, (e) => {
      s.node.rotation.y = s.baseYaw + target * e;
    });
  }

  private setVisible(id: string, visible: boolean): void {
    for (const m of this.built?.meshes.get(id) ?? []) {
      m.isVisible = visible;
      m.isPickable = visible;
    }
  }

  private loadRoom(index: number): void {
    this.built?.dispose();
    const def = ROOMS[index];
    if (!def) return;
    this.roomIndex = index;
    this.built = buildRoom(this.scene, def, this.furniture);
    this.inventory.clear();
    this.tapped.clear();
    this.unlocked = false;
    this.doorOpen = false;
    this.busy = false;
    this.ui.setInventory([]);
    this.controller.teleport(def.start[0], def.start[1]);
    this.avatar.root.rotation.y = 0;
    resetCamera(this.camera);
    this.ui.setRoomLabel(`Huone ${index + 1}/${ROOMS.length} · ${def.name}`);
    this.ui.showMessage(def.intro, 6000);
    this.roomStartedAt = performance.now();
    this.saveProgress();
  }

  private async leaveRoom(): Promise<void> {
    this.busy = true;
    this.controller.enabled = false;
    this.avatar.playOnce("Cheer");
    const elapsed = this.elapsedBefore + (performance.now() - this.roomStartedAt);
    if (this.roomIndex >= ROOMS.length - 1) {
      this.finished = true;
      this.clearProgress();
      this.ui.showWin(CONFIG.texts.finalTitle, `Aika: ${formatTime(elapsed)}`);
      return;
    }
    this.ui.showMessage(CONFIG.texts.roomDone, 1500);
    await this.ui.fade(true);
    this.elapsedBefore = elapsed;
    this.loadRoom(this.roomIndex + 1);
    await this.ui.fade(false);
    this.controller.enabled = true;
  }

  private loadProgress(): Progress | null {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw) as Partial<Progress>;
      return typeof p.room === "number" ? { room: p.room, elapsedBefore: p.elapsedBefore ?? 0 } : null;
    } catch {
      return null;
    }
  }

  private saveProgress(): void {
    try {
      const p: Progress = { room: this.roomIndex, elapsedBefore: this.elapsedBefore };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    } catch {
      /* ei tilaa tai yksityinen tila */
    }
  }

  private clearProgress(): void {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch {
      /* ei haittaa */
    }
  }
}

function formatTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}
