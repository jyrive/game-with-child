import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
// Lisää scene.pick-toiminnon. Ilman tätä tuontia napautus ei osu mihinkään.
import "@babylonjs/core/Culling/ray";

/** Liikeohjaus: näppäimistö ja virtuaalinen joystick yhdistettynä. */
export class MoveInput {
  private readonly keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private jumpQueued = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === " ") {
        this.jump();
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** x = oikealle (-1..1), y = eteenpäin (-1..1). Pituus enintään 1. */
  get move(): { x: number; y: number } {
    let x = this.joyX;
    let y = this.joyY;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  setJoystick(x: number, y: number): void {
    this.joyX = x;
    this.joyY = y;
  }

  jump(): void {
    this.jumpQueued = true;
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }
}

export interface PickedInteractable {
  id: string;
  point: Vector3;
}

const TAP_PX = 12;
const TAP_MS = 500;

/** Napautuksen ympäriltä kokeillaan muutamaa pistettä, jotta pieniin esineisiin osuu sormellakin. */
const FAT_FINGER: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [-16, 0], [16, 0], [0, -16], [0, 16], [-12, -12], [12, -12], [-12, 12], [12, 12],
];

function isInteractable(mesh: AbstractMesh): boolean {
  return mesh.isPickable && typeof mesh.metadata?.id === "string";
}

/** Etsii napautetun esineen. Koordinaatit ovat selaimen clientX/clientY. */
export function pickInteractable(scene: Scene, clientX: number, clientY: number): PickedInteractable | null {
  const canvas = scene.getEngine().getRenderingCanvas();
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  for (const [ox, oy] of FAT_FINGER) {
    const hit = scene.pick(x + ox, y + oy, isInteractable);
    const id = hit.pickedMesh?.metadata?.id as string | undefined;
    if (id && hit.pickedPoint) return { id, point: hit.pickedPoint };
  }
  return null;
}

/**
 * Erottaa napautuksen kameran vedosta: lyhyt kosketus, joka ei liiku, on napautus.
 * Babylon tekisi osumatarkistuksen jokaisella sormen liikkeellä; teemme sen vain napautuksen lopussa.
 */
export function setupCanvasTap(scene: Scene, onTap: (clientX: number, clientY: number) => void): void {
  scene.skipPointerMovePicking = true;
  scene.skipPointerDownPicking = true;
  scene.skipPointerUpPicking = true;

  let activePointer: number | null = null;
  let downX = 0;
  let downY = 0;
  let downTime = 0;

  scene.onPointerObservable.add((info) => {
    const ev = info.event as unknown as PointerEvent;
    if (info.type === PointerEventTypes.POINTERDOWN) {
      if (activePointer !== null) return;
      activePointer = ev.pointerId;
      downX = ev.clientX;
      downY = ev.clientY;
      downTime = performance.now();
      return;
    }
    if (info.type !== PointerEventTypes.POINTERUP || ev.pointerId !== activePointer) return;
    activePointer = null;
    const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
    if (moved <= TAP_PX && performance.now() - downTime <= TAP_MS) onTap(ev.clientX, ev.clientY);
  });
}
