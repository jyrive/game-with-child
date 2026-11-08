import "./style.css";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { registerSW } from "virtual:pwa-register";
import { CONFIG } from "./game/config";
import { Avatar } from "./game/avatar";
import { CharacterController } from "./game/characterController";
import { applyOrientation, createFollowCamera, lookFrom, updateFollowCamera } from "./game/followCamera";
import { MoveInput, pickInteractable, setupCanvasTap } from "./game/input";
import { Game } from "./game/game";
import { FurnitureLibrary } from "./game/furnitureLibrary";
import { Overlay } from "./ui/overlay";
import { isTouchDevice, setupTouchControls } from "./ui/joystick";
import { PerfMonitor } from "./perf/perfMonitor";
import { AutoQuality } from "./perf/autoQuality";
import { PerfHud } from "./perf/perfHud";

// Service worker: peli toimii myös ilman verkkoa ja sen voi lisätä aloitusnäyttöön.
registerSW({ immediate: true });

const canvas = document.getElementById("game") as HTMLCanvasElement;
// Kosketuksen jälkeen selain lähettäisi vielä hiiren klikkauksen samaan kohtaan. Se osuisi juuri
// avautuneeseen koodilukkoon. Estetään se, samalla katoaa myös kaksoisnapautuksen zoomaus.
canvas.addEventListener("touchend", (e) => e.preventDefault(), { passive: false });
// Selaimen oma zoomaus pois koko sivulta. Viewport-metan user-scalable=no ei riitä: iOS Safari ei
// noudata sitä, eikä pelkkä touch-action: none ole sielläkään luotettava. Ilman tätä nipistys zoomasi
// välillä koko sivua kameran sijaan, ja pelialue valui ruudun ulkopuolelle.
const stopBrowserZoom = (e: Event): void => e.preventDefault();
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, stopBrowserZoom, { passive: false });
}
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
const engine = new Engine(canvas, true, { powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: false });

// Renderöintitarkkuus: enintään 2 kuvapistettä per CSS-pikseli.
// Uusissa puhelimissa devicePixelRatio on 3, mikä olisi turhan raskasta tähän peliin.
const bestScaling = 1 / Math.min(window.devicePixelRatio || 1, 2);
engine.setHardwareScalingLevel(bestScaling);

const scene = new Scene(engine);
scene.clearColor = new Color4(0.05, 0.07, 0.09, 1);

// Valot ovat yhteiset kaikille huoneille: yksi taivasvalo ja yksi kattolamppu. Ei varjoja.
const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
hemi.intensity = 0.65;
hemi.groundColor = new Color3(0.35, 0.3, 0.28);
const lamp = new PointLight("lamp", new Vector3(0, 3.2, 0), scene);
lamp.intensity = 0.7;
lamp.diffuse = new Color3(1, 0.93, 0.8);

const avatar = new Avatar(scene);
void avatar.loadModel(); // 3D-malli latautuu taustalla; sillä välin näkyy palikkahahmo
const camera = createFollowCamera(scene, canvas, avatar.cameraTarget);
applyOrientation(camera);

const input = new MoveInput();
const controller = new CharacterController(avatar, camera, input);
const overlay = new Overlay({ onRestart: () => game.restart() });
const game = new Game(scene, overlay, avatar, controller, camera, FurnitureLibrary.load(scene));

const handleTap = (clientX: number, clientY: number): void => {
  if (overlay.modalOpen) return;
  const hit = pickInteractable(scene, clientX, clientY);
  if (hit) game.onTap(hit.id, hit.point);
};
setupCanvasTap(scene, handleTap);
setupTouchControls(input, handleTap);

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000;
  if (!overlay.modalOpen) controller.update(dt);
  const forward = controller.enabled && !overlay.modalOpen ? Math.max(0, input.move.y) : 0;
  updateFollowCamera(camera, dt, avatar.root.rotation.y, forward);
  avatar.setHiddenByCamera(camera.radius < 0.8);
  game.update();
});

void game.start(); // huone tulee näkyviin, kun huonekalumallit on ladattu
overlay.showHint(isTouchDevice() ? CONFIG.texts.controlsTouch : CONFIG.texts.controlsKeyboard, 12000);

// --- Suorituskyvyn seuranta ---------------------------------------------------------------
const perf = new PerfMonitor(engine, scene, { context: () => game.roomName });
const autoQuality = new AutoQuality(engine, { best: bestScaling, worst: 2, lowFps: 40, highFps: 57 });
perf.onSample((s) => autoQuality.handle(s));

const devButtons = import.meta.env.DEV ? [{ label: "Inspector", onClick: () => void toggleInspector() }] : [];
const hud = new PerfHud(perf, autoQuality, devButtons);

/** Babylonin oma tarkastustyökalu. Vain kehityksessä; ei päädy julkaistuun peliin. */
async function toggleInspector(): Promise<void> {
  if (!import.meta.env.DEV) return;
  await import("@babylonjs/core/Debug/debugLayer");
  await import("@babylonjs/inspector");
  if (scene.debugLayer.isVisible()) scene.debugLayer.hide();
  else await scene.debugLayer.show({ embedMode: true });
}

window.addEventListener("keydown", (e) => {
  if (overlay.handleKey(e)) return;
  if (e.key === "p" || e.key === "P") hud.toggle();
  else if (e.key === "i" || e.key === "I") void toggleInspector();
});

window.addEventListener("resize", () => {
  engine.resize();
  applyOrientation(camera);
});

// Kehitysapu: selaimen konsolista pääsee käsiksi peliin, esim. __pakohuone.teleport(0, 2).
// Automaattitesti käyttää tätä myös. Ei päädy julkaistuun peliin.
if (import.meta.env.DEV) {
  const screenPointOf = (meshName: string): { x: number; y: number } | null => {
    const mesh = scene.getMeshByName(meshName);
    if (!mesh) return null;
    mesh.computeWorldMatrix(true);
    const center = mesh.getBoundingInfo().boundingBox.centerWorld;
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const p = Vector3.Project(center, Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport);
    const s = engine.getHardwareScalingLevel();
    return { x: p.x * s, y: p.y * s };
  };
  Object.assign(window, {
    __pakohuone: {
      scene,
      camera,
      avatar,
      controller,
      input,
      game,
      perf,
      screenPointOf,
      teleport: (x: number, z: number) => controller.teleport(x, z),
      lookAt: (x: number, z: number, beta?: number) => lookFrom(camera, avatar.position.x, avatar.position.z, x, z, beta),
    },
  });
}

engine.runRenderLoop(() => scene.render());
