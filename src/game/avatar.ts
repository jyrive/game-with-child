import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Material } from "@babylonjs/core/Materials/material";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { CONFIG } from "./config";

/** Palikkahahmon mitat metreinä. Yhteensä 1,7 m. */
const LEG = 0.7;
const TORSO = 0.6;
const HEAD = 0.4;

/** Mallin animaatioiden nimet. Nämä ovat KayKit-hahmojen nimiä; kaikilla paketin hahmoilla on samat. */
const CLIPS = { idle: "Idle", walk: "Walking_A", run: "Running_A", jump: "Jump_Idle" };
/** Kuinka lujaa (m/s) hahmo "luonnostaan" etenee, kun kävely- tai juoksuanimaatio pyörii nopeudella 1. */
const WALK_CLIP_MPS = 1.0;
const RUN_CLIP_MPS = 2.5;
/** Alle tämän nopeuden (m/s) kävellään, yli tämän + 1 m/s juostaan; välissä sekoitetaan. */
const RUN_FROM_MPS = 1.2;

/** Yksi toistuva animaatio ja sen paino sekoituksessa (0..1). */
interface LoopClip {
  group: AnimationGroup;
  weight: number;
  target: number;
}

interface LoadedModel {
  idle: LoopClip;
  walk: LoopClip;
  run: LoopClip;
  jump: LoopClip;
  loops: LoopClip[];
  /** Kaikki mallin animaatiot nimen mukaan (myös kertaluonteiset kuten Cheer). */
  all: Map<string, AnimationGroup>;
}

/**
 * Pelaajan hahmo. root on näkymätön laatikko, jota liikutetaan; siinä on törmäysellipsoidi.
 * Aluksi näytetään palikkahahmo (pää, vartalo, kädet ja jalat). Kun 3D-malli on ladattu
 * (ks. CONFIG.avatar), palikat piilotetaan ja mallia animoidaan sen omilla animaatioilla.
 */
export class Avatar {
  readonly root: Mesh;
  /** Kameran kohde rinnan korkeudella. */
  readonly cameraTarget: TransformNode;

  /** Palikkahahmon osat yhden solmun alla, jotta ne voi piilottaa kerralla. */
  private readonly blocky: TransformNode;
  private readonly limbs: { node: TransformNode; sign: number; amp: number }[] = [];
  private phase = 0;
  private swing = 0;

  private model: LoadedModel | null = null;
  /** Kertaluonteinen animaatio (esim. tuuletus), joka ajaa toistuvien yli kunnes se loppuu. */
  private oneShot: AnimationGroup | null = null;

  constructor(scene: Scene) {
    this.root = CreateBox("avatar", { size: 0.1 }, scene);
    this.root.isVisible = false;
    this.root.isPickable = false;
    this.root.ellipsoid = new Vector3(0.3, 0.85, 0.3);
    this.root.ellipsoidOffset = new Vector3(0, 0.85, 0);

    this.cameraTarget = new TransformNode("avatarCameraTarget", scene);
    this.cameraTarget.parent = this.root;
    this.cameraTarget.position.set(0, 1.25, 0);

    this.blocky = new TransformNode("avatar:blocky", scene);
    this.blocky.parent = this.root;
    this.buildBlocky(scene);
  }

  get position(): Vector3 {
    return this.root.position;
  }

  /**
   * Piilottaa hahmon, kun kamera on niin lähellä, että se olisi hahmon pään sisällä
   * (selkä seinää vasten). Näkymä on silloin kuin hahmon silmistä.
   */
  setHiddenByCamera(hidden: boolean): void {
    if (hidden === this.hiddenByCamera) return;
    this.hiddenByCamera = hidden;
    for (const m of this.root.getChildMeshes()) m.isVisible = !hidden;
  }
  private hiddenByCamera = false;

  /** Onko 3D-malli käytössä (vai palikkahahmo). */
  get hasModel(): boolean {
    return this.model !== null;
  }

  /**
   * Lataa 3D-mallin taustalla. Palikkahahmo näkyy sillä välin, ja jää käyttöön, jos lataus epäonnistuu.
   * Mallin materiaalit vaihdetaan samanlaisiin kevyisiin materiaaleihin kuin huoneessa, ja aseet poistetaan.
   */
  async loadModel(): Promise<void> {
    const scene = this.root.getScene();
    const url = `${import.meta.env.BASE_URL}${CONFIG.avatar.model}`;
    try {
      // Vain glTF-lataaja, ja sen koodi haetaan erillisenä palana vasta nyt. Babylonin oma
      // registerBuiltInLoaders toisi mukaan kaikki muodot (FBX, USD, splat...) ja kaikki glTF-laajennukset,
      // mikä kasvattaisi julkaistun pelin kokoa useilla megatavuilla. Siksi mallissa ei saa käyttää
      // glTF-laajennuksia (Blenderin oletusvienti ilman pakkausta on ok).
      await import("@babylonjs/loaders/glTF/2.0/glTFLoader");
      const result = await ImportMeshAsync(url, scene);
      const modelRoot = result.meshes[0];
      if (!modelRoot) throw new Error("mallissa ei ole yhtään meshiä");
      modelRoot.setEnabled(false); // pidetään piilossa, kunnes kaikki on valmista
      for (const g of result.animationGroups) g.stop(); // lataaja käynnistää ensimmäisen itse

      // Aseet ja muut kädessä pidettävät esineet roikkuvat "handslot"-solmuissa. Pakohuoneessa ei tarvita.
      for (const mesh of result.meshes) if (hasAncestorNamed(mesh, "handslot")) mesh.dispose();
      const meshes = result.meshes.filter((m) => !m.isDisposed());
      for (const mesh of meshes) mesh.isPickable = false;

      // Skaalataan hahmo oikean pituiseksi ja laitetaan jalat lattian tasolle.
      const { min, max } = modelRoot.getHierarchyBoundingVectors(true);
      const scale = CONFIG.avatar.height / Math.max(0.01, max.y - min.y);
      modelRoot.scaling.scaleInPlace(scale);
      modelRoot.position.y = -min.y * scale;
      modelRoot.parent = this.root;

      const materials = toStandardMaterials(meshes, scene);
      // Käännetään varjostimet valmiiksi, ettei ensimmäinen kuva mallin kanssa tökkää.
      await Promise.all(meshes.filter((m) => m.material).map((m) => m.material!.forceCompilationAsync(m)));
      for (const m of materials) m.freeze();

      const all = new Map(result.animationGroups.map((g) => [g.name, g]));
      const loop = (name: string): LoopClip => {
        const group = all.get(name);
        if (!group) throw new Error(`animaatio "${name}" puuttuu mallista`);
        group.play(true);
        group.setWeightForAllAnimatables(0);
        return { group, weight: 0, target: 0 };
      };
      const idle = loop(CLIPS.idle);
      const walk = loop(CLIPS.walk);
      const run = loop(CLIPS.run);
      const jump = loop(CLIPS.jump);
      idle.weight = idle.target = 1;
      idle.group.setWeightForAllAnimatables(1);

      this.model = { idle, walk, run, jump, loops: [idle, walk, run, jump], all };
      modelRoot.setEnabled(true);
      this.blocky.setEnabled(false);
    } catch (e) {
      console.warn("Hahmon 3D-mallia ei voitu ladata, käytetään palikkahahmoa.", e);
    }
  }

  /** speed on 0..1 (kuinka kovaa kävellään). Kutsutaan joka kehyksellä. */
  animate(dtSeconds: number, speed: number, grounded: boolean): void {
    if (!this.model) {
      this.animateBlocky(dtSeconds, speed, grounded);
      return;
    }
    const m = this.model;
    // Kertaluonteinen animaatio loppuu itsestään, tai keskeytetään, jos pelaaja lähtee liikkeelle.
    if (this.oneShot && (speed > 0.05 || !grounded || !this.oneShot.isPlaying)) this.stopOneShot();
    const busy = this.oneShot !== null;

    const velocity = speed * CONFIG.move.speed; // m/s
    const air = grounded ? 0 : 1;
    const moving = clamp01(speed / 0.15); // pienikin liike vaihtaa kävelyyn
    const runMix = clamp01(velocity - RUN_FROM_MPS);
    m.idle.target = busy ? 0 : (1 - air) * (1 - moving);
    m.walk.target = busy ? 0 : (1 - air) * moving * (1 - runMix);
    m.run.target = busy ? 0 : (1 - air) * moving * runMix;
    m.jump.target = busy ? 0 : air;

    // Askelten tahti seuraa hahmon oikeaa nopeutta, ettei jalat liu'u.
    m.walk.group.speedRatio = CONFIG.avatar.animSpeed * Math.max(0.5, velocity / WALK_CLIP_MPS);
    m.run.group.speedRatio = CONFIG.avatar.animSpeed * Math.max(0.5, velocity / RUN_CLIP_MPS);

    // Pehmeä siirtymä (noin 0,1 s). Painojen summa pidetään vähintään yhdessä, ettei malli välähdä perusasentoon.
    const k = Math.min(1, dtSeconds * 12);
    let sum = busy ? 1 : 0;
    for (const c of m.loops) {
      c.weight += (c.target - c.weight) * k;
      sum += c.weight;
    }
    for (const c of m.loops) this.applyWeight(c, sum > 0 ? c.weight / sum : 0);
  }

  /**
   * Soittaa yhden mallin animaation kerran (esim. "Cheer" tai "Interact") ja palaa sitten
   * tavalliseen animointiin. Ei tee mitään palikkahahmolla tai jos animaatiota ei ole.
   */
  playOnce(name: string): void {
    const group = this.model?.all.get(name);
    if (!group) return;
    this.stopOneShot();
    group.play(false);
    group.setWeightForAllAnimatables(1);
    this.oneShot = group;
  }

  /** Kääntää hahmon pehmeästi katsomaan annettuun suuntaan. */
  faceTowards(yaw: number, dtSeconds: number): void {
    let delta = (yaw - this.root.rotation.y) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.root.rotation.y += delta * Math.min(1, dtSeconds * 12);
  }

  private stopOneShot(): void {
    const group = this.oneShot;
    if (!group) return;
    this.oneShot = null;
    group.stop();
    // Palataan heti lepoasentoon täydellä painolla, ettei painojen summa putoa hetkeksi alle yhden.
    for (const c of this.model?.loops ?? []) this.applyWeight(c, (c.weight = c === this.model?.idle ? 1 : 0));
  }

  /** Nollapainoiset animaatiot pysäytetään, ettei niitä lasketa turhaan joka kehyksellä. */
  private applyWeight(c: LoopClip, weight: number): void {
    if (weight < 0.001) {
      if (c.group.isPlaying) c.group.pause();
      return;
    }
    if (!c.group.isPlaying) c.group.play(true); // jatkaa siitä, mihin jäi
    c.group.setWeightForAllAnimatables(weight);
  }

  // --- Palikkahahmo ---------------------------------------------------------------------------

  private buildBlocky(scene: Scene): void {
    const mat = (name: string, hex: string): StandardMaterial => {
      const m = new StandardMaterial(`avatar:${name}`, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(0.1, 0.1, 0.1);
      m.freeze();
      return m;
    };
    const skin = mat("skin", "#f3c84b");
    const shirt = mat("shirt", "#2d6fd6");
    const pants = mat("pants", "#3aa655");

    const part = (name: string, w: number, h: number, d: number, material: StandardMaterial): Mesh => {
      const m = CreateBox(`avatar:${name}`, { width: w, height: h, depth: d }, scene);
      m.material = material;
      m.isPickable = false;
      return m;
    };

    const torso = part("torso", 0.6, TORSO, 0.3, shirt);
    torso.parent = this.blocky;
    torso.position.y = LEG + TORSO / 2;

    const head = part("head", HEAD, HEAD, HEAD, skin);
    head.parent = this.blocky;
    head.position.y = LEG + TORSO + HEAD / 2;

    // Silmät, jotta näkee mihin suuntaan hahmo katsoo (eteenpäin = +z).
    const eyes = mat("eyes", "#222222");
    for (const sx of [-1, 1]) {
      const eye = part("eye", 0.06, 0.06, 0.02, eyes);
      eye.parent = head;
      eye.position.set(sx * 0.09, 0.05, HEAD / 2);
    }

    // Raajat roikkuvat saranasta (olkapää tai lonkka), joten niitä voi heiluttaa kiertämällä saranaa.
    const limb = (name: string, x: number, y: number, w: number, len: number, material: StandardMaterial, sign: number, amp: number): void => {
      const hinge = new TransformNode(`avatar:${name}:hinge`, scene);
      hinge.parent = this.blocky;
      hinge.position.set(x, y, 0);
      const m = part(name, w, len, w, material);
      m.parent = hinge;
      m.position.y = -len / 2;
      this.limbs.push({ node: hinge, sign, amp });
    };
    limb("legL", -0.15, LEG, 0.25, LEG, pants, 1, 0.7);
    limb("legR", 0.15, LEG, 0.25, LEG, pants, -1, 0.7);
    limb("armL", -0.4, LEG + TORSO - 0.05, 0.2, 0.6, skin, -1, 0.6);
    limb("armR", 0.4, LEG + TORSO - 0.05, 0.2, 0.6, skin, 1, 0.6);
  }

  private animateBlocky(dtSeconds: number, speed: number, grounded: boolean): void {
    // Askelrytmi etenee vain kun liikutaan; muuten raajat palaavat rauhallisesti alas.
    this.phase += dtSeconds * speed * 11;
    const target = grounded ? speed : 0.3;
    this.swing += (target - this.swing) * Math.min(1, dtSeconds * 10);
    const s = Math.sin(this.phase) * this.swing;
    for (const l of this.limbs) l.node.rotation.x = l.sign * l.amp * s;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hasAncestorNamed(mesh: AbstractMesh, part: string): boolean {
  for (let p = mesh.parent; p; p = p.parent) if (p.name.includes(part)) return true;
  return false;
}

/**
 * glTF-lataaja tekee PBR-materiaaleja. Ne vaihdetaan tavallisiin materiaaleihin ilman kiiltoa:
 * kevyempiä puhelimelle ja samannäköisiä kuin huoneen esineet. Tekstuuri otetaan talteen.
 */
function toStandardMaterials(meshes: AbstractMesh[], scene: Scene): StandardMaterial[] {
  const converted = new Map<Material, StandardMaterial>();
  for (const mesh of meshes) {
    const src = mesh.material;
    if (!src) continue;
    let std = converted.get(src);
    if (!std) {
      std = new StandardMaterial(`avatar:${src.name}`, scene);
      if (src.getClassName() === "PBRMaterial") std.diffuseTexture = (src as PBRMaterial).albedoTexture;
      std.specularColor = Color3.Black();
      converted.set(src, std);
    }
    mesh.material = std;
  }
  for (const src of converted.keys()) src.dispose(); // tekstuurit jäävät, niitä ei hävitetä oletuksena
  return [...converted.values()];
}
