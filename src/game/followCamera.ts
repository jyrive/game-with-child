import type { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CONFIG } from "./config";

/** Kameran etäisyys hahmosta ja kulma alussa. Pystyasennossa kamera on kauempana, ettei hahmo peitä näkymää. */
export const CAMERA_HOME = { alpha: -Math.PI / 2, beta: 1.15, radius: 3.2, radiusPortrait: 4.6 };

export function isPortrait(camera: ArcRotateCamera): boolean {
  const engine = camera.getEngine();
  return engine.getRenderWidth() < engine.getRenderHeight();
}

export function homeRadius(camera: ArcRotateCamera): number {
  return isPortrait(camera) ? CAMERA_HOME.radiusPortrait : CAMERA_HOME.radius;
}

/**
 * Näkymä: "behind" = hahmo näkyy ja kamera on sen takana (kuten Robloxissa),
 * "eyes" = katsotaan hahmon silmistä, hahmo on piilossa. Silmistä on helpompi lukea lappuja.
 */
export type CameraMode = "behind" | "eyes";

/** Silmistä-näkymässä kamera on hahmon pään kohdalla, aivan kohteen takana. */
const EYES_RADIUS = 0.05;
const EYE_HEIGHT = 1.45;
/** Pystykulman rajat (beta: pieni = katse alas, π/2 = suoraan eteen). Silmistä saa katsoa myös ylös. */
const BETA_LIMITS: Record<CameraMode, [number, number]> = { behind: [0.3, 1.5], eyes: [0.25, 2.5] };
/** Kulma, johon kamera palaa (huoneen vaihto, näkymän vaihto). */
const HOME_BETA: Record<CameraMode, number> = { behind: CAMERA_HOME.beta, eyes: 1.4 };

/** Kuinka lähelle ja kauas pelaaja voi itse zoomata (metreinä hahmosta). */
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 7;
/** Kuinka lähelle hahmoa kamera saa tulla, kun seinä on tiellä. */
const BLOCKED_MIN = 0.3;
/** Kuinka paljon kamera pysyy irti seinästä tai huonekalusta. */
const WALL_MARGIN = 0.25;
/** Kuinka nopeasti kamera palaa omalle etäisyydelleen, kun este väistyy (suurempi = nopeammin). */
const RETURN_RATE = 4;

/**
 * Kameran oma etäisyys (desired) on se, minkä pelaaja on zoomannut. Kun seinä tai huonekalu on
 * hahmon ja kameran välissä, kamera tulee hetkeksi lähemmäs (applied) ja palaa sitten itse takaisin.
 * Babylonin oma törmäystarkistus ei kelpaa: se jättäisi kameran lähelle, ja pelaajan pitäisi zoomata ulos.
 */
interface Rig {
  target: TransformNode;
  /** Kohteen korkeus takaa-näkymässä (avatar.ts asettaa sen). */
  behindHeight: number;
  mode: CameraMode;
  desired: number;
  applied: number;
  /** Milloin pelaaja viimeksi käänsi kameraa itse (ms). */
  lastManualTurn: number;
}
const rigs = new WeakMap<ArcRotateCamera, Rig>();

function rigOf(camera: ArcRotateCamera): Rig {
  const rig = rigs.get(camera);
  if (!rig) throw new Error("kamera ei ole createFollowCameran tekemä");
  return rig;
}

/**
 * Kamera, joka kiertää hahmon ympärillä kuten Robloxissa: veto kääntää, nipistys tai rulla zoomaa.
 * Seinän läpi kamera ei mene (ks. updateFollowCamera).
 */
export function createFollowCamera(scene: Scene, canvas: HTMLCanvasElement, target: TransformNode): ArcRotateCamera {
  const camera = new ArcRotateCamera("camera", CAMERA_HOME.alpha, CAMERA_HOME.beta, CAMERA_HOME.radius, Vector3.Zero(), scene);
  camera.setTarget(target);
  camera.minZ = 0.05;
  camera.maxZ = 60;
  // Babylonin rajat ovat väljät, koska seinän edessä kamera saa tulla lähemmäs kuin pelaaja voi zoomata.
  // Pelaajan zoomauksen rajat (ZOOM_MIN, ZOOM_MAX) tarkistetaan updateFollowCamerassa.
  camera.lowerRadiusLimit = EYES_RADIUS;
  camera.upperRadiusLimit = ZOOM_MAX;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = 1.5;
  camera.wheelDeltaPercentage = 0.02;
  camera.pinchDeltaPercentage = 0.01;
  camera.angularSensibilityX = 900;
  camera.angularSensibilityY = 900;
  camera.inertia = 0.75;
  camera.panningSensibility = 0; // ei panorointia: kohde on aina hahmo
  // Nuolinäppäimet on varattu hahmon liikuttamiseen.
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  camera.attachControl(canvas, true);
  rigs.set(camera, {
    target,
    behindHeight: target.position.y,
    mode: "behind",
    desired: CAMERA_HOME.radius,
    applied: CAMERA_HOME.radius,
    lastManualTurn: -Infinity,
  });
  return camera;
}

export function getCameraMode(camera: ArcRotateCamera): CameraMode {
  return rigOf(camera).mode;
}

/**
 * Vaihtaa näkymää. Katsesuunta vaakatasossa säilyy, joten hahmon silmistä näkee saman suunnan
 * kuin takaa. Hahmo piilotetaan silmistä-näkymässä (ks. main.ts).
 */
export function setCameraMode(camera: ArcRotateCamera, mode: CameraMode): void {
  const rig = rigOf(camera);
  rig.mode = mode;
  rig.target.position.y = mode === "eyes" ? EYE_HEIGHT : rig.behindHeight;
  [camera.lowerBetaLimit, camera.upperBetaLimit] = BETA_LIMITS[mode];
  camera.beta = HOME_BETA[mode];
  camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
  setRadius(camera, homeRadius(camera));
}

/** Asettaa pelaajan zoomauksen (etäisyys hahmosta metreinä). Silmistä-näkymässä etäisyys on aina sama. */
function setRadius(camera: ArcRotateCamera, radius: number): void {
  const rig = rigOf(camera);
  const r = rig.mode === "eyes" ? EYES_RADIUS : clamp(radius, ZOOM_MIN, ZOOM_MAX);
  rig.desired = rig.applied = camera.radius = r;
}

const ray = new Ray(Vector3.Zero(), Vector3.Forward(), 1);
const blocksCamera = (m: AbstractMesh): boolean => m.checkCollisions && m.isEnabled();

/**
 * Kutsutaan joka kehyksellä hahmon liikuttamisen jälkeen.
 * - Pitää kameran pelaajan valitsemalla etäisyydellä, paitsi kun seinä tai huonekalu on tiellä.
 * - Kääntää kameraa hiljalleen hahmon taakse, kun hahmo kävelee eteenpäin (CONFIG.camera.autoFollow).
 *
 * heading: suunta, johon hahmo kävelee (sama kulma kuin hahmon kierto). forward: kuinka paljon
 * ohjaus osoittaa eteenpäin (0..1); sivuttain tai taaksepäin kävellessä kamera ei käänny.
 */
export function updateFollowCamera(camera: ArcRotateCamera, dtSeconds: number, heading: number, forward: number): void {
  const rig = rigOf(camera);
  const now = performance.now();

  // Silmistä: ei zoomausta, ei automaattista kääntöä (katse on pelaajan omissa käsissä), eikä
  // seinätarkistusta (kamera on hahmon sisällä, ja hahmo pysyy irti seinistä).
  if (rig.mode === "eyes") {
    camera.inertialRadiusOffset = 0;
    rig.desired = rig.applied = camera.radius = EYES_RADIUS;
    return;
  }

  // Pelaajan oma zoomaus (nipistys tai rulla) näkyy muutoksena siihen etäisyyteen, jonka asetimme viimeksi.
  const zoomed = camera.radius - rig.applied;
  if (Math.abs(zoomed) > 1e-4) rig.desired = clamp(rig.desired + zoomed, ZOOM_MIN, ZOOM_MAX);

  // Automaattinen kääntö hahmon taakse. Ei heti sen jälkeen, kun pelaaja on kääntänyt kameraa itse.
  if (camera.inertialAlphaOffset !== 0 || camera.inertialBetaOffset !== 0) rig.lastManualTurn = now;
  const follow = CONFIG.camera;
  if (follow.autoFollow && forward > 0.1 && now - rig.lastManualTurn > follow.delayMs) {
    const behind = Math.atan2(-Math.cos(heading), -Math.sin(heading));
    camera.alpha += wrapAngle(behind - camera.alpha) * Math.min(1, dtSeconds * follow.speed * forward);
  }

  // Onko hahmon ja kameran välissä jotain? Säde kulkee hahmosta kameraa kohti.
  const sinb = Math.max(1e-4, Math.sin(camera.beta));
  ray.origin.copyFrom(rig.target.getAbsolutePosition());
  ray.direction.set(Math.cos(camera.alpha) * sinb, Math.cos(camera.beta), Math.sin(camera.alpha) * sinb);
  ray.length = rig.desired + WALL_MARGIN;
  const hit = camera.getScene().pickWithRay(ray, blocksCamera);
  const free = hit?.hit ? Math.max(BLOCKED_MIN, hit.distance - WALL_MARGIN) : rig.desired;

  // Lähemmäs heti (ettei kamera näy seinän läpi), takaisin pehmeästi.
  if (free < rig.applied) rig.applied = free;
  else rig.applied += (free - rig.applied) * Math.min(1, dtSeconds * RETURN_RATE);
  camera.radius = rig.applied;
}

/** Palauttaa kameran hahmon taakse (huoneen vaihto). */
export function resetCamera(camera: ArcRotateCamera): void {
  camera.alpha = CAMERA_HOME.alpha;
  camera.beta = HOME_BETA[rigOf(camera).mode];
  setRadius(camera, homeRadius(camera));
}

/** Säätää näkökentän ja etäisyyden ruudun asennon mukaan. Kutsutaan alussa ja kun ikkunan koko muuttuu. */
export function applyOrientation(camera: ArcRotateCamera): void {
  // Vaaka-asennossa kapeampi pystykulma; pystyasennossa leveämpi ja kamera kauempana.
  camera.fov = isPortrait(camera) ? 1.25 : 0.9;
  setRadius(camera, homeRadius(camera));
}

/** Kääntää kameran katsomaan hahmosta kohti pistettä (testit, kehitysapu). */
export function lookFrom(camera: ArcRotateCamera, fromX: number, fromZ: number, toX: number, toZ: number, beta = CAMERA_HOME.beta): void {
  camera.alpha = Math.atan2(-(toZ - fromZ), -(toX - fromX));
  camera.beta = beta;
  setRadius(camera, homeRadius(camera));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Kulmaero välille -π..π, jotta kamera kääntyy lyhyintä reittiä. */
function wrapAngle(a: number): number {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
