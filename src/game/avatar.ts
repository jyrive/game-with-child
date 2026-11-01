import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/** Hahmon mitat metreinä. Yhteensä 1,7 m. */
const LEG = 0.7;
const TORSO = 0.6;
const HEAD = 0.4;

/**
 * Palikkahahmo: pää, vartalo, kädet ja jalat. Raajat heiluvat kävellessä.
 * root on näkymätön laatikko, jota liikutetaan; siinä on törmäysellipsoidi.
 */
export class Avatar {
  readonly root: Mesh;
  /** Kameran kohde rinnan korkeudella. */
  readonly cameraTarget: TransformNode;

  private readonly limbs: { node: TransformNode; sign: number; amp: number }[] = [];
  private phase = 0;
  private swing = 0;

  constructor(scene: Scene) {
    this.root = CreateBox("avatar", { size: 0.1 }, scene);
    this.root.isVisible = false;
    this.root.isPickable = false;
    this.root.ellipsoid = new Vector3(0.3, 0.85, 0.3);
    this.root.ellipsoidOffset = new Vector3(0, 0.85, 0);

    this.cameraTarget = new TransformNode("avatarCameraTarget", scene);
    this.cameraTarget.parent = this.root;
    this.cameraTarget.position.set(0, 1.25, 0);

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
    torso.parent = this.root;
    torso.position.y = LEG + TORSO / 2;

    const head = part("head", HEAD, HEAD, HEAD, skin);
    head.parent = this.root;
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
      hinge.parent = this.root;
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

  get position(): Vector3 {
    return this.root.position;
  }

  /** speed on 0..1 (kuinka kovaa kävellään). Kutsutaan joka kehyksellä. */
  animate(dtSeconds: number, speed: number, grounded: boolean): void {
    // Askelrytmi etenee vain kun liikutaan; muuten raajat palaavat rauhallisesti alas.
    this.phase += dtSeconds * speed * 11;
    const target = grounded ? speed : 0.3;
    this.swing += (target - this.swing) * Math.min(1, dtSeconds * 10);
    const s = Math.sin(this.phase) * this.swing;
    for (const l of this.limbs) l.node.rotation.x = l.sign * l.amp * s;
  }

  /** Kääntää hahmon pehmeästi katsomaan annettuun suuntaan. */
  faceTowards(yaw: number, dtSeconds: number): void {
    let delta = (yaw - this.root.rotation.y) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.root.rotation.y += delta * Math.min(1, dtSeconds * 12);
  }
}
