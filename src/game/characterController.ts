import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
// Lisää törmäystarkistuksen (moveWithCollisions). Ilman tätä tuontia hahmo kävelisi seinien läpi.
import "@babylonjs/core/Collisions/collisionCoordinator";
import { CONFIG } from "./config";
import type { Avatar } from "./avatar";
import type { MoveInput } from "./input";

/** Kuinka kauan maakosketus "pätee" sen jälkeen, kun se viimeksi havaittiin. */
const GROUND_GRACE_MS = 120;
/** Kuinka kauan hyppypyyntö odottaa maakosketusta. */
const JUMP_BUFFER_MS = 150;

/**
 * Liikuttaa hahmoa ohjauksen mukaan: kävely kameran suuntaan, painovoima, hyppy ja törmäykset.
 * Ei fysiikkamoottoria: Babylonin moveWithCollisions riittää, ja se on kevyt puhelimelle.
 */
export class CharacterController {
  enabled = true;
  grounded = false;
  private vy = 0;
  /** Milloin jalat viimeksi koskettivat maata (ms). Pieni armonaika, koska kosketus välkkyy kehyksittäin. */
  private lastGroundContact = -Infinity;
  /** Milloin hyppyä pyydettiin (ms). Pyyntö odottaa hetken, jos hahmo on juuri laskeutumassa. */
  private jumpRequestedAt = -Infinity;
  private readonly displacement = new Vector3();

  constructor(
    private readonly avatar: Avatar,
    private readonly camera: ArcRotateCamera,
    private readonly input: MoveInput,
  ) {}

  /** Siirtää hahmon suoraan paikkaan (huoneen vaihto, testit). */
  teleport(x: number, z: number, y = 0.02): void {
    this.avatar.position.set(x, y, z);
    this.vy = 0;
    this.grounded = false;
    this.lastGroundContact = -Infinity;
  }

  update(dtSeconds: number): void {
    const dt = Math.min(dtSeconds, 0.05); // iso hyppäys ajassa (välilehti piilossa) ei saa lennättää hahmoa
    const move = this.enabled ? this.input.move : { x: 0, y: 0 };
    const { speed, jumpSpeed, gravity } = CONFIG.move;

    // Kameran katsesuunta lattian tasossa. alpha on kameran kulma kohteen ympäri.
    const forwardX = -Math.cos(this.camera.alpha);
    const forwardZ = -Math.sin(this.camera.alpha);
    // Oikealle = ylös × eteen (vasenkätinen koordinaatisto).
    const rightX = forwardZ;
    const rightZ = -forwardX;

    const mx = forwardX * move.y + rightX * move.x;
    const mz = forwardZ * move.y + rightZ * move.x;
    const len = Math.hypot(mx, mz);
    const amount = Math.min(1, len);

    const now = performance.now();
    if (this.enabled && this.input.consumeJump()) this.jumpRequestedAt = now;
    const canJump = now - this.lastGroundContact < GROUND_GRACE_MS && this.vy <= 0.01;
    if (now - this.jumpRequestedAt < JUMP_BUFFER_MS && canJump) {
      this.vy = jumpSpeed;
      this.jumpRequestedAt = -Infinity;
      this.lastGroundContact = -Infinity;
    }
    this.vy -= gravity * dt;
    const dy = this.vy * dt;

    const scale = len > 0 ? (amount * speed * dt) / len : 0;
    this.displacement.set(mx * scale, dy, mz * scale);

    const beforeY = this.avatar.position.y;
    this.avatar.root.moveWithCollisions(this.displacement);
    const actualDy = this.avatar.position.y - beforeY;

    if (dy < 0 && actualDy > dy + 0.0005) {
      // Jokin esti putoamisen: seisomme lattialla tai esineen päällä.
      this.lastGroundContact = now;
      this.vy = 0;
    } else if (dy > 0 && actualDy < dy - 0.0005) {
      // Pää osui kattoon.
      this.vy = 0;
    }
    this.grounded = now - this.lastGroundContact < GROUND_GRACE_MS;

    if (amount > 0.05) this.avatar.faceTowards(Math.atan2(mx, mz), dt);
    this.avatar.animate(dt, amount, this.grounded);
  }
}
