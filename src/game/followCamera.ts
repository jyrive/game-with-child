import type { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

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
 * Kamera, joka kiertää hahmon ympärillä kuten Robloxissa: veto kääntää, nipistys tai rulla zoomaa.
 * Törmäystarkistus estää kameraa menemästä seinän läpi.
 */
export function createFollowCamera(scene: Scene, canvas: HTMLCanvasElement, target: TransformNode): ArcRotateCamera {
  const camera = new ArcRotateCamera("camera", CAMERA_HOME.alpha, CAMERA_HOME.beta, CAMERA_HOME.radius, Vector3.Zero(), scene);
  camera.setTarget(target);
  camera.minZ = 0.05;
  camera.maxZ = 60;
  camera.lowerRadiusLimit = 1.0;
  camera.upperRadiusLimit = 7;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = 1.5;
  camera.wheelDeltaPercentage = 0.02;
  camera.pinchDeltaPercentage = 0.01;
  camera.angularSensibilityX = 900;
  camera.angularSensibilityY = 900;
  camera.inertia = 0.75;
  camera.panningSensibility = 0; // ei panorointia: kohde on aina hahmo
  camera.checkCollisions = true;
  camera.collisionRadius = new Vector3(0.25, 0.25, 0.25);
  // Nuolinäppäimet on varattu hahmon liikuttamiseen.
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  camera.attachControl(canvas, true);
  return camera;
}

/**
 * Kun kamera hyppää kerralla uuteen paikkaan, törmäystarkistus ei saa "pyyhkäistä" matkaa vanhasta
 * paikasta uuteen: muuten kamera jää matkalla osuvan huonekalun taakse. Ohitetaan se yhden kehyksen ajan.
 */
function snap(camera: ArcRotateCamera): void {
  camera.checkCollisions = false;
  camera.getScene().onAfterRenderObservable.addOnce(() => {
    camera.checkCollisions = true;
  });
}

/** Palauttaa kameran hahmon taakse (huoneen vaihto). */
export function resetCamera(camera: ArcRotateCamera): void {
  camera.alpha = CAMERA_HOME.alpha;
  camera.beta = CAMERA_HOME.beta;
  camera.radius = homeRadius(camera);
  snap(camera);
}

/** Säätää näkökentän ja etäisyyden ruudun asennon mukaan. Kutsutaan alussa ja kun ikkunan koko muuttuu. */
export function applyOrientation(camera: ArcRotateCamera): void {
  // Vaaka-asennossa kapeampi pystykulma; pystyasennossa leveämpi ja kamera kauempana.
  camera.fov = isPortrait(camera) ? 1.25 : 0.9;
  camera.radius = homeRadius(camera);
}

/** Kääntää kameran katsomaan hahmosta kohti pistettä (testit, kehitysapu). */
export function lookFrom(camera: ArcRotateCamera, fromX: number, fromZ: number, toX: number, toZ: number, beta = CAMERA_HOME.beta): void {
  camera.alpha = Math.atan2(-(toZ - fromZ), -(toX - fromX));
  camera.beta = beta;
  camera.radius = homeRadius(camera);
  snap(camera);
}
