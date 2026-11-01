import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { ObjectDef, RoomDefinition } from "./rooms/types";

export const DOOR_ID = "door";
export const KEYPAD_ID = "keypad";

export interface Swingable {
  node: TransformNode;
  baseYaw: number;
}

export interface BuiltRoom {
  def: RoomDefinition;
  root: TransformNode;
  /** Esineen id → sen meshit (pöydällä on monta osaa). */
  meshes: Map<string, Mesh[]>;
  /** Esineet, jotka voivat kääntyä saranan ympäri. */
  swingables: Map<string, Swingable>;
  door: { meshes: Mesh[]; led: StandardMaterial };
  dispose(): void;
}

const rad = (deg: number | undefined): number => ((deg ?? 0) * Math.PI) / 180;

/** Rakentaa huoneen meshit kuvauksen perusteella. */
export function buildRoom(scene: Scene, def: RoomDefinition): BuiltRoom {
  const { width: W, depth: D, height: H } = def.size;
  const root = new TransformNode(`room:${def.id}`, scene);
  const meshes = new Map<string, Mesh[]>();
  const swingables = new Map<string, Swingable>();
  const materials = new Map<string, StandardMaterial>();
  const frozen: StandardMaterial[] = [];

  const material = (color: string, glow?: string): StandardMaterial => {
    const key = `${color}|${glow ?? ""}`;
    let m = materials.get(key);
    if (!m) {
      m = new StandardMaterial(`mat:${key}`, scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.specularColor = new Color3(0.05, 0.05, 0.05);
      if (glow) m.emissiveColor = Color3.FromHexString(glow);
      materials.set(key, m);
      frozen.push(m);
    }
    return m;
  };

  const register = (id: string, mesh: Mesh, o?: ObjectDef): void => {
    const list = meshes.get(id) ?? [];
    list.push(mesh);
    meshes.set(id, list);
    mesh.isPickable = !!o?.onTap && !o.hidden;
    mesh.metadata = o?.onTap ? { id } : null;
    mesh.checkCollisions = !!o?.solid;
    if (o?.hidden) mesh.isVisible = false;
  };

  // --- Kuori: yksi laatikko sisältäpäin. Seinät, lattia ja katto yhdellä piirtokutsulla. ---
  // Sivut: 0 = +z, 1 = -z, 2 = +x, 3 = -x, 4 = katto, 5 = lattia.
  const wall = Color3.FromHexString(def.colors.wall).toColor4(1);
  const ceiling = Color3.FromHexString(def.colors.ceiling).toColor4(1);
  const floor = Color3.FromHexString(def.colors.floor).toColor4(1);
  const shell = CreateBox("shell", { width: W, height: H, depth: D, sideOrientation: Mesh.BACKSIDE, faceColors: [wall, wall, wall, wall, ceiling, floor] }, scene);
  shell.position.y = H / 2;
  shell.parent = root;
  const shellMat = new StandardMaterial("mat:shell", scene);
  shellMat.specularColor = Color3.Black();
  shell.material = shellMat;
  frozen.push(shellMat);
  shell.isPickable = false;
  shell.checkCollisions = true;
  shell.freezeWorldMatrix();

  // Kattolamppu keskellä.
  const bulb = CreateSphere("bulb", { diameter: 0.3, segments: 8 }, scene);
  bulb.position.set(0, H - 0.3, 0);
  bulb.parent = root;
  bulb.material = material("#ffffff", "#fff2cc");
  bulb.isPickable = false;

  // --- Ovi, karmi, "ulkona" ja koodilukko pohjoisseinälle -----------------------------------
  const doorX = def.doorX;
  const frame = CreateBox("doorFrame", { width: 1.1, height: 2.25, depth: 0.05 }, scene);
  frame.position.set(doorX, 1.125, D / 2 - 0.025);
  frame.parent = root;
  frame.material = material("#3b2a1e");
  frame.isPickable = false;

  const outside = CreateBox("outside", { width: 0.9, height: 2.05, depth: 0.02 }, scene);
  outside.position.set(doorX, 1.03, D / 2 - 0.07);
  outside.parent = root;
  outside.material = material("#000000", "#dceaf5");
  outside.isPickable = false;

  const doorPivot = new TransformNode("doorPivot", scene);
  doorPivot.parent = root;
  doorPivot.position.set(doorX - 0.475, 0, D / 2 - 0.1);
  const door = CreateBox("door", { width: 0.95, height: 2.1, depth: 0.08 }, scene);
  door.parent = doorPivot;
  door.position.set(0.475, 1.05, 0);
  door.material = material("#8a5a33");
  const knob = CreateSphere("knob", { diameter: 0.1, segments: 8 }, scene);
  knob.parent = doorPivot;
  knob.position.set(0.85, 1.0, -0.06);
  knob.material = material("#2c3238");
  for (const m of [door, knob]) {
    m.isPickable = true;
    m.metadata = { id: DOOR_ID };
  }
  door.checkCollisions = true;
  swingables.set(DOOR_ID, { node: doorPivot, baseYaw: 0 });

  const keypad = CreateBox("keypad", { width: 0.28, height: 0.38, depth: 0.05 }, scene);
  keypad.position.set(doorX + 0.9, 1.4, D / 2 - 0.025);
  keypad.parent = root;
  keypad.material = material("#2c3238");
  const ledMat = new StandardMaterial("mat:led", scene);
  ledMat.diffuseColor = Color3.FromHexString("#330000");
  ledMat.emissiveColor = Color3.FromHexString("#ff2020");
  const led = CreateBox("led", { width: 0.08, height: 0.08, depth: 0.02 }, scene);
  led.position.set(doorX + 0.9, 1.52, D / 2 - 0.06);
  led.parent = root;
  led.material = ledMat;
  for (const m of [keypad, led]) {
    m.isPickable = true;
    m.metadata = { id: KEYPAD_ID };
    m.freezeWorldMatrix();
  }

  // --- Huoneen omat esineet -------------------------------------------------------------------
  for (const o of def.objects) {
    const parts = createShape(scene, o, material);
    const [x, y, z] = o.at;
    const swing = o.onTap?.swing;

    if (swing !== undefined) {
      // Sarana esineen vasemmassa reunassa: esine on saranan lapsi ja siirretty puolen leveyden verran oikealle.
      const halfWidth = (o.size[0] ?? 0) / 2;
      const pivot = new TransformNode(`pivot:${o.id}`, scene);
      pivot.parent = root;
      const yaw = rad(o.rotate);
      pivot.position.set(x - Math.cos(yaw) * halfWidth, y, z + Math.sin(yaw) * halfWidth);
      pivot.rotation.y = yaw;
      for (const p of parts) {
        p.parent = pivot;
        p.position.x += halfWidth;
      }
      swingables.set(o.id, { node: pivot, baseYaw: yaw });
    } else {
      const holder = new TransformNode(`obj:${o.id}`, scene);
      holder.parent = root;
      holder.position.set(x, y, z);
      holder.rotation.set(rad(o.tilt), rad(o.rotate), 0);
      for (const p of parts) p.parent = holder;
    }
    for (const p of parts) {
      register(o.id, p, o);
      if (swing === undefined) p.freezeWorldMatrix();
    }
  }

  for (const m of frozen) m.freeze();

  return {
    def,
    root,
    meshes,
    swingables,
    door: { meshes: [door, knob], led: ledMat },
    dispose: () => root.dispose(false, true),
  };
}

type MaterialFn = (color: string, glow?: string) => StandardMaterial;

/** Luo esineen osat paikallisessa koordinaatistossa (keskipiste origossa, pöydällä ja tuolilla lattia origossa). */
function createShape(scene: Scene, o: ObjectDef, material: MaterialFn): Mesh[] {
  const color = o.color ?? "#999999";
  const s = o.size;
  switch (o.shape) {
    case "box": {
      const m = CreateBox(o.id, { width: s[0] ?? 1, height: s[1] ?? 1, depth: s[2] ?? 1 }, scene);
      m.material = o.texture === "painting" ? textureMaterial(scene, `${o.id}:tex`, paintingTexture(scene, o.id)) : material(color, o.glow);
      return [m];
    }
    case "sphere": {
      const m = CreateSphere(o.id, { diameter: s[0] ?? 1, segments: 8 }, scene);
      m.material = material(color, o.glow);
      return [m];
    }
    case "cylinder": {
      const m = CreateCylinder(o.id, { diameter: s[0] ?? 1, height: s[1] ?? 1, tessellation: 12 }, scene);
      m.material = material(color, o.glow);
      return [m];
    }
    case "sign": {
      const m = CreatePlane(o.id, { width: s[0] ?? 1, height: s[1] ?? 1 }, scene);
      if (o.text) {
        const tex = textTexture(scene, `${o.id}:tex`, o.text.split("|"), color, o.textColor ?? "#222222");
        m.material = textureMaterial(scene, `${o.id}:mat`, tex, o.glow);
      } else {
        m.material = material(color, o.glow);
      }
      return [m];
    }
    case "table": {
      const [w = 0.8, h = 0.75, d = 1.4] = s;
      const mat = material(color, o.glow);
      const top = CreateBox(`${o.id}:top`, { width: w, height: 0.05, depth: d }, scene);
      top.position.y = h - 0.025;
      top.material = mat;
      const parts = [top];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = CreateBox(`${o.id}:leg`, { width: 0.06, height: h - 0.05, depth: 0.06 }, scene);
        leg.position.set(sx! * (w / 2 - 0.05), (h - 0.05) / 2, sz! * (d / 2 - 0.05));
        leg.material = mat;
        parts.push(leg);
      }
      return parts;
    }
    case "chair": {
      const [w = 0.45] = s;
      const seatH = 0.5;
      const mat = material(color, o.glow);
      const seat = CreateBox(`${o.id}:seat`, { width: w, height: 0.06, depth: w }, scene);
      seat.position.y = seatH - 0.03;
      seat.material = mat;
      const back = CreateBox(`${o.id}:back`, { width: w, height: 0.5, depth: 0.05 }, scene);
      back.position.set(0, seatH + 0.25, w / 2 - 0.025);
      back.material = mat;
      const parts = [seat, back];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = CreateBox(`${o.id}:leg`, { width: 0.05, height: seatH - 0.06, depth: 0.05 }, scene);
        leg.position.set(sx! * (w / 2 - 0.04), (seatH - 0.06) / 2, sz! * (w / 2 - 0.04));
        leg.material = mat;
        parts.push(leg);
      }
      return parts;
    }
  }
}

function textureMaterial(scene: Scene, name: string, tex: DynamicTexture, glow?: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  if (glow) m.emissiveColor = Color3.FromHexString(glow);
  return m;
}

/** Piirtää tekstirivit tekstuuriin. Fonttikoko valitaan niin, että pisin rivi mahtuu. */
function textTexture(scene: Scene, name: string, lines: string[], bg: string, fg: string): DynamicTexture {
  const width = 512;
  const height = 256;
  const tex = new DynamicTexture(name, { width, height }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const px = Math.min(Math.floor((height / (lines.length + 1)) * 0.95), Math.floor((width * 1.75) / longest), 200);
  ctx.font = `bold ${px}px sans-serif`;
  const lineHeight = height / (lines.length + 1);
  lines.forEach((line, i) => ctx.fillText(line, width / 2, lineHeight * (i + 1)));
  tex.update();
  return tex;
}

/** Maisemataulu kehyksineen: taivas, aurinko ja kukkulat. */
function paintingTexture(scene: Scene, name: string): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture(`${name}:painting`, { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#4a3620";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#8fc3e8";
  ctx.fillRect(16, 16, size - 32, size - 32);
  ctx.fillStyle = "#ffd86b";
  ctx.beginPath();
  ctx.arc(190, 70, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a9a4a";
  ctx.beginPath();
  ctx.ellipse(70, 230, 120, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4c8640";
  ctx.beginPath();
  ctx.ellipse(210, 250, 110, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a3620";
  ctx.fillRect(0, 0, size, 16);
  ctx.fillRect(0, size - 16, size, 16);
  ctx.fillRect(0, 0, 16, size);
  ctx.fillRect(size - 16, 0, 16, size);
  tex.update();
  return tex;
}

