import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { FloorStyle, ObjectDef, RoomDefinition, WallStyle } from "./rooms/types";
import { FURNITURE } from "./rooms/furniture";

/**
 * Lattia, seinät ja katto kuvioineen. Kuviot piirretään kerran huoneen rakentamisen yhteydessä
 * kuviksi (tekstuureiksi), joten pelatessa ne eivät maksa mitään. Samalla kuviin piirretään
 * varjot: nurkat ja seinien alaosat ovat vähän tummempia, ja lattialla on pehmeä varjo
 * jokaisen huonekalun alla. Oikeita varjoja ei lasketa, koska ne olisivat puhelimelle raskaita.
 */

/** Kuvapisteitä metriä kohden. Lattia 8 m → 1024 px. */
const PX_PER_M = 128;
/** Kuinka paljon huonekalun varjo ulottuu sen reunojen yli (m). */
const SHADOW_MARGIN = 0.12;
/** Suurin tekstuurin koko (px). Isoissa huoneissa tarkkuus laskee hieman. */
const MAX_PX = 1024;

export function buildSurfaces(scene: Scene, def: RoomDefinition, root: TransformNode): StandardMaterial[] {
  const { width: W, depth: D, height: H } = def.size;
  const materials: StandardMaterial[] = [];
  const surface = (name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, px: number, py: number) => void): StandardMaterial => {
    const pw = Math.min(MAX_PX, pow2(w * PX_PER_M));
    const ph = Math.min(MAX_PX, pow2(h * PX_PER_M));
    const tex = new DynamicTexture(`tex:${name}`, { width: pw, height: ph }, scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    // Piirretään metreinä: (0, 0) on kuvan vasen yläkulma, ja yksikkö on metri.
    ctx.save();
    ctx.scale(pw / w, ph / h);
    draw(ctx, pw / w, ph / h);
    ctx.restore();
    tex.update();
    tex.anisotropicFilteringLevel = 4; // lattia näkyy loivassa kulmassa; pitää kuvion terävänä
    tex.wrapU = tex.wrapV = DynamicTexture.CLAMP_ADDRESSMODE;
    const m = new StandardMaterial(`mat:${name}`, scene);
    m.diffuseTexture = tex;
    m.specularColor = Color3.Black();
    materials.push(m);
    return m;
  };

  // --- Lattia: kuvio, reunojen varjo ja huonekalujen varjot ---------------------------------
  const floorMat = surface(`floor:${def.id}`, W, D, (ctx, sx) => {
    drawFloor(ctx, def.floorStyle ?? "planks", def.colors.floor, W, D, sx);
    // Huonekalujen varjot. Kuvan yläreuna on pohjoisseinä (+z), vasen reuna länsiseinä (-x).
    for (const f of footprints(def.objects)) {
      ctx.save();
      ctx.translate(f.x + W / 2, D / 2 - f.z);
      ctx.rotate((f.rotate * Math.PI) / 180);
      // Varjo on vähän huonekalua isompi, jotta se näkyy reunojen ympäriltä.
      const m = SHADOW_MARGIN;
      softRect(ctx, -f.w / 2 - m, -f.d / 2 - m, f.w + 2 * m, f.d + 2 * m, 0.2, "rgba(0,0,0,0.6)");
      ctx.restore();
    }
    edgeShade(ctx, W, D, 0.45, 0.28);
  });
  const floor = CreatePlane(`floor:${def.id}`, { width: W, height: D }, scene);
  floor.rotation.x = Math.PI / 2; // makaa lattialla, kuvan yläreuna pohjoiseen
  floor.position.y = 0.001;
  floor.material = floorMat;

  // --- Katto -------------------------------------------------------------------------------
  const ceilingMat = surface(`ceiling:${def.id}`, W, D, (ctx) => {
    ctx.fillStyle = def.colors.ceiling;
    ctx.fillRect(0, 0, W, D);
    edgeShade(ctx, W, D, 0.5, 0.18);
  });
  const ceiling = CreatePlane(`ceiling:${def.id}`, { width: W, height: D }, scene);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = H - 0.001;
  ceiling.material = ceilingMat;

  // --- Seinät: pohjois- ja eteläseinä ovat yhtä pitkiä, samoin itä- ja länsiseinä ----------
  const wallStyle = def.wallStyle ?? "plain";
  const wallMat = (length: number): StandardMaterial =>
    surface(`wall:${def.id}:${length}`, length, H, (ctx) => drawWall(ctx, wallStyle, def.colors.wall, length, H));
  const longMat = wallMat(W);
  const sideMat = W === D ? longMat : wallMat(D);
  const walls: [number, number, number, number, StandardMaterial][] = [
    // [x, z, kääntö, pituus, materiaali]; seinän etupuoli osoittaa huoneeseen
    [0, D / 2, 0, W, longMat],
    [0, -D / 2, Math.PI, W, longMat],
    [W / 2, 0, Math.PI / 2, D, sideMat],
    [-W / 2, 0, -Math.PI / 2, D, sideMat],
  ];
  const meshes: Mesh[] = [floor, ceiling];
  walls.forEach(([x, z, yaw, length, mat], i) => {
    const wall = CreatePlane(`wall:${def.id}:${i}`, { width: length, height: H }, scene);
    wall.position.set(x, H / 2, z);
    wall.rotation.y = yaw;
    wall.material = mat;
    meshes.push(wall);
  });

  for (const m of meshes) {
    m.parent = root;
    m.isPickable = false;
    m.freezeWorldMatrix();
  }
  return materials;
}

// --- Lattiakuviot ---------------------------------------------------------------------------

function drawFloor(ctx: CanvasRenderingContext2D, style: FloorStyle, color: string, W: number, D: number, pxPerM: number): void {
  const base = Color3.FromHexString(color);
  const rand = seeded(7);
  const line = 1.5 / pxPerM; // noin 1,5 px viiva
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, D);
  switch (style) {
    case "planks": {
      // Lankut itä–länsisuunnassa, 0,2 m leveitä, vaihtelevan pituisia ja vähän eri sävyisiä.
      const pw = 0.2;
      for (let y = 0, row = 0; y < D; y += pw, row++) {
        let x = -rand() * 1.5;
        while (x < W) {
          const len = 1.2 + rand() * 1.4;
          ctx.fillStyle = shade(base, (rand() - 0.5) * 0.14);
          ctx.fillRect(x, y, len, pw);
          // Vaalea yläreuna ja tumma sauma: lankku näyttää vähän kohollaan olevalta.
          ctx.fillStyle = shade(base, 0.12);
          ctx.fillRect(x, y, len, line);
          ctx.fillStyle = shade(base, -0.35);
          ctx.fillRect(x, y + pw - line, len, line);
          ctx.fillRect(x + len - line, y, line, pw);
          x += len;
        }
      }
      break;
    }
    case "tiles": {
      // Ruutulattia: 0,5 m laatat, joka toinen vaaleampi, vaaleat saumat.
      const t = 0.5;
      for (let y = 0, r = 0; y < D; y += t, r++) {
        for (let x = 0, c = 0; x < W; x += t, c++) {
          ctx.fillStyle = shade(base, (r + c) % 2 === 0 ? 0.16 : -0.04);
          ctx.fillRect(x, y, t, t);
        }
      }
      ctx.fillStyle = shade(base, 0.3);
      for (let y = 0; y <= D; y += t) ctx.fillRect(0, y - line, W, line * 2);
      for (let x = 0; x <= W; x += t) ctx.fillRect(x - line, 0, line * 2, D);
      break;
    }
    case "carpet": {
      // Kokolattiamatto: pieniä pilkkuja, jotka antavat nukkapintaisen vaikutelman.
      for (let i = 0; i < W * D * 220; i++) {
        ctx.fillStyle = shade(base, (rand() - 0.5) * 0.2);
        const s = (1 + rand() * 2) / pxPerM;
        ctx.fillRect(rand() * W, rand() * D, s, s);
      }
      break;
    }
    case "plain":
      break;
  }
}

// --- Seinäkuviot ----------------------------------------------------------------------------

function drawWall(ctx: CanvasRenderingContext2D, style: WallStyle, color: string, L: number, H: number): void {
  const base = Color3.FromHexString(color);
  // Pohjaväri liukuvärinä: ylhäällä vähän vaaleampi, alhaalla tummempi (kuten KayKit-malleissa).
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(base, 0.06));
  g.addColorStop(1, shade(base, -0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, H);

  switch (style) {
    case "stripes": {
      // Pystyraidat, 0,25 m välein.
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      for (let x = 0; x < L; x += 0.5) ctx.fillRect(x, 0, 0.25, H);
      break;
    }
    case "wallpaper": {
      // Pieniä vinoneliöitä ruudukossa, joka toinen rivi siirretty.
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      const s = 0.3;
      for (let y = 0.15, r = 0; y < H; y += s, r++) {
        for (let x = (r % 2) * (s / 2); x < L + s; x += s) {
          ctx.beginPath();
          ctx.moveTo(x, y - 0.045);
          ctx.lineTo(x + 0.035, y);
          ctx.lineTo(x, y + 0.045);
          ctx.lineTo(x - 0.035, y);
          ctx.fill();
        }
      }
      break;
    }
    case "panel": {
      // Alaosassa metrin korkuinen puupaneeli ja sen yläreunassa lista.
      const top = H - 1.0;
      ctx.fillStyle = shade(base, -0.2);
      ctx.fillRect(0, top, L, 1.0);
      ctx.fillStyle = shade(base, -0.32);
      for (let x = 0; x < L; x += 0.2) ctx.fillRect(x, top, 0.012, 1.0);
      ctx.fillStyle = shade(base, 0.1);
      ctx.fillRect(0, top - 0.05, L, 0.05);
      break;
    }
    case "bricks": {
      // Tiilet 0,25 × 0,1 m, limittäin, vaaleat saumat.
      const bw = 0.25;
      const bh = 0.1;
      const rand = seeded(3);
      for (let y = 0, r = 0; y < H; y += bh, r++) {
        for (let x = r % 2 ? -bw / 2 : 0; x < L; x += bw) {
          ctx.fillStyle = shade(base, (rand() - 0.5) * 0.12);
          ctx.fillRect(x + 0.008, y + 0.008, bw - 0.016, bh - 0.016);
        }
      }
      break;
    }
    case "plain":
      break;
  }

  // Jalkalista alareunassa: vaalea lista, jonka yläreunassa on tumma viiva.
  ctx.fillStyle = "#f1ece3";
  ctx.fillRect(0, H - 0.12, L, 0.12);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, H - 0.125, L, 0.008);

  // Varjot: alanurkka tummuu lattiaa kohti, ja seinän sivureunat (huoneen nurkat) tummuvat.
  const bottom = ctx.createLinearGradient(0, H - 0.6, 0, H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H - 0.6, L, 0.6);
  sideShade(ctx, L, H, 0.4, 0.2);
  const ceilingEdge = ctx.createLinearGradient(0, 0, 0, 0.3);
  ceilingEdge.addColorStop(0, "rgba(0,0,0,0.12)");
  ceilingEdge.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ceilingEdge;
  ctx.fillRect(0, 0, L, 0.3);
}

// --- Varjot ---------------------------------------------------------------------------------

/** Huonekalun jalanjälki lattialla: keskikohta, koko ja kierto (metreinä ja asteina). */
interface Footprint {
  x: number;
  z: number;
  w: number;
  d: number;
  rotate: number;
}

/** Lattialla seisovat esineet, joiden alle piirretään varjo. Matot ja seinätaulut eivät varjosta. */
function footprints(objects: ObjectDef[]): Footprint[] {
  const out: Footprint[] = [];
  for (const o of objects) {
    if (o.hidden) continue;
    const [x, y, z] = o.at;
    const rotate = o.rotate ?? 0;
    const s = o.size ?? [];
    if (o.shape === "model" && o.model) {
      const [w, h, d] = FURNITURE[o.model].size;
      if (y < 0.05 && h > 0.2) out.push({ x, z, w, d, rotate });
    } else if (o.shape === "table") {
      out.push({ x, z, w: s[0] ?? 0.8, d: s[2] ?? 1.4, rotate });
    } else if (o.shape === "chair") {
      out.push({ x, z, w: s[0] ?? 0.45, d: s[0] ?? 0.45, rotate });
    } else if (o.shape === "box" && !o.tilt) {
      const [w = 1, h = 1, d = 1] = s;
      if (y - h / 2 < 0.05 && h > 0.2) out.push({ x, z, w, d, rotate });
    }
  }
  return out;
}

/**
 * Pehmeäreunainen suorakaide (varjo). Canvasin oma varjo tekee reunasta sumean. Itse suorakaide
 * piirretään kauas kuvan ulkopuolelle, ja vain sen varjo siirretään oikeaan kohtaan.
 * Varjon siirto ja sumeus ovat kuvapisteinä, joten kulmat muunnetaan ensin kuvapisteiksi.
 */
function softRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, blur: number, color: string): void {
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b);
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ].map(([px, py]) => m.transformPoint(new DOMPoint(px, py)));
  const OFF = 10000;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * scale;
  ctx.shadowOffsetX = OFF;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x - OFF, p.y) : ctx.lineTo(p.x - OFF, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Reunat tummuvat kohti seiniä (lattia, katto). */
function edgeShade(ctx: CanvasRenderingContext2D, W: number, D: number, size: number, alpha: number): void {
  sideShade(ctx, W, D, size, alpha);
  for (const [y0, y1] of [[0, size], [D, D - size]] as const) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(y0, y1), W, size);
  }
}

/** Vasen ja oikea reuna tummuvat (huoneen nurkat). */
function sideShade(ctx: CanvasRenderingContext2D, W: number, H: number, size: number, alpha: number): void {
  for (const [x0, x1] of [[0, size], [W, W - size]] as const) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), 0, size, H);
  }
}

// --- Apufunktiot ----------------------------------------------------------------------------

/** Vaalentaa (amount > 0) tai tummentaa (amount < 0) väriä. */
function shade(c: Color3, amount: number): string {
  const t = amount > 0 ? Color3.White() : Color3.Black();
  return Color3.Lerp(c, t, Math.abs(amount)).toHexString();
}

/** Toistettava satunnaislukusarja: sama huone näyttää aina samalta. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Lähin kahden potenssi (256, 512, 1024): puhelimet piirtävät tällaiset tekstuurit varmimmin. */
function pow2(px: number): number {
  return 2 ** Math.round(Math.log2(Math.max(64, px)));
}
