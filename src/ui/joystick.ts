import type { MoveInput } from "../game/input";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Elementti #${id} puuttuu index.html:stä`);
  return e;
}

const RADIUS = 50;

/** Onko laitteessa kosketusnäyttö ensisijaisena ohjaimena. */
export function isTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Virtuaalinen joystick ruudun vasempaan alakulmaan ja hyppynappi oikeaan.
 * Joystick ilmestyy siihen, mihin peukalo laskeutuu. Lyhyt napautus alueella
 * tulkitaan esineen napautukseksi, jotta lattialla olevia esineitä voi napauttaa.
 */
export function setupTouchControls(input: MoveInput, onTap: (clientX: number, clientY: number) => void): void {
  document.body.classList.toggle("touch", isTouchDevice());

  const zone = el("joystickZone");
  const base = el("joystickBase");
  const knob = el("joystickKnob");
  const jump = el("jumpBtn");

  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let moved = false;
  let downTime = 0;

  zone.addEventListener("pointerdown", (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    originX = e.clientX;
    originY = e.clientY;
    moved = false;
    downTime = performance.now();
    base.style.left = `${originX}px`;
    base.style.top = `${originY}px`;
    base.classList.add("active");
    knob.style.transform = "translate(0px, 0px)";
    e.preventDefault();
  });

  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    let dx = e.clientX - originX;
    let dy = e.clientY - originY;
    const len = Math.hypot(dx, dy);
    if (len > 8) moved = true;
    if (len > RADIUS) {
      dx *= RADIUS / len;
      dy *= RADIUS / len;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.setJoystick(dx / RADIUS, -dy / RADIUS);
  });

  const end = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    base.classList.remove("active");
    input.setJoystick(0, 0);
    if (!moved && performance.now() - downTime < 500) onTap(e.clientX, e.clientY);
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);

  jump.addEventListener("pointerdown", (e) => {
    input.jump();
    e.preventDefault();
  });
}
