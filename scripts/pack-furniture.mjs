// Pakkaa huonekalumallit yhdeksi tiedostoksi public/models/furniture.glb ja kirjoittaa
// luettelon src/game/rooms/furniture.ts, josta huoneiden tekijä näkee nimet ja koot.
//
// Käyttö:  npm run pack-furniture -- <kansio>
// Kansiossa pitää olla nämä KayKit-paketit (git clone https://github.com/KayKit-Game-Assets/<nimi>):
//   KayKit-Furniture-Bits-1.0      kaikki huonekalut
//   KayKit-Dungeon-Remastered-1.0  arkku ja avain
//   KayKit-Restaurant-Bits-1.0     jääkaappi
// Vaatekaappi tehdään tässä itse laatikoista, koska yhdessäkään paketissa ei ole sellaista.
//
// Jokainen malli skaalataan pelin mittoihin ja siirretään niin, että mallin alareunan keskikohta
// on origossa. Silloin huoneen esineen "at" on se kohta lattialla (tai pöydällä), jolle malli asetetaan.
//
// Liikkuva osa (arkun kansi, jääkaapin ovi) jää mallin alle omaksi solmukseen, jonka nimi on
// "<malli>:lid" tai "<malli>:door". Solmun paikka on saranan kohta, joten osaa voi kääntää sen ympäri.
import { stat, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { Document, NodeIO, getBounds } from "@gltf-transform/core";
import { dedup, mergeDocuments, prune, transformMesh, unpartition } from "@gltf-transform/functions";

/** KayKit-hahmo on mallissa 2,187 yksikköä pitkä ja pelissä 1,7 m. Huonekalut skaalataan samassa suhteessa. */
const SCALE = 1.7 / 2.187;

/** Suomenkieliset nimet luetteloon. */
const LABELS = {
  armchair: "Nojatuoli",
  armchair_pillows: "Nojatuoli tyynyillä",
  bed_double_A: "Parisänky A",
  bed_double_B: "Parisänky B",
  bed_single_A: "Sänky A",
  bed_single_B: "Sänky B",
  book_set: "Kirjarivi",
  book_single: "Kirja pystyssä",
  cabinet_medium: "Lipasto",
  cabinet_medium_decorated: "Lipasto tavaroilla",
  cabinet_small: "Pieni kaappi",
  cabinet_small_decorated: "Pieni kaappi tavaroilla",
  cactus_medium_A: "Kaktus A",
  cactus_medium_B: "Kaktus B",
  cactus_small_A: "Pieni kaktus A",
  cactus_small_B: "Pieni kaktus B",
  chair_A: "Tuoli A",
  chair_A_wood: "Tuoli A, puu",
  chair_B: "Tuoli B",
  chair_B_wood: "Tuoli B, puu",
  chair_C: "Tuoli C",
  chair_stool: "Jakkara",
  chair_stool_wood: "Jakkara, puu",
  couch: "Sohva",
  couch_pillows: "Sohva tyynyillä",
  lamp_standing: "Jalkalamppu",
  lamp_table: "Pöytälamppu",
  pictureframe_large_A: "Iso taulu A",
  pictureframe_large_B: "Iso taulu B",
  pictureframe_medium: "Taulu",
  pictureframe_small_A: "Pieni taulu A",
  pictureframe_small_B: "Pieni taulu B",
  pictureframe_small_C: "Pieni taulu C",
  pictureframe_standing_A: "Pöytäkehys A",
  pictureframe_standing_B: "Pöytäkehys B",
  pillow_A: "Tyyny A",
  pillow_B: "Tyyny B",
  rug_oval_A: "Soikea matto A",
  rug_oval_B: "Soikea matto B",
  rug_rectangle_A: "Matto A",
  rug_rectangle_B: "Matto B",
  rug_rectangle_stripes_A: "Raitamatto A",
  rug_rectangle_stripes_B: "Raitamatto B",
  shelf_A_big: "Seinähylly A, iso",
  shelf_A_small: "Seinähylly A, pieni",
  shelf_B_large: "Seinähylly B, iso",
  shelf_B_large_decorated: "Seinähylly B tavaroilla, iso",
  shelf_B_small: "Seinähylly B, pieni",
  shelf_B_small_decorated: "Seinähylly B tavaroilla, pieni",
  table_low: "Sohvapöytä",
  table_medium: "Pöytä",
  table_medium_long: "Pitkä pöytä",
  table_small: "Pieni pöytä",
  // Muista paketeista ja itse tehdyt:
  chest: "Arkku (kansi aukeaa)",
  key: "Avain",
  fridge: "Jääkaappi (ovi aukeaa)",
  wardrobe: "Vaatekaappi",
};

const [, , kaykit] = process.argv;
if (!kaykit) {
  console.error("Käyttö: npm run pack-furniture -- <kansio, jossa KayKit-paketit ovat>");
  process.exit(1);
}
const FURNITURE_DIR = join(kaykit, "KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf");
const DUNGEON_DIR = join(kaykit, "KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf");
const RESTAURANT_DIR = join(kaykit, "KayKit-Restaurant-Bits-1.0/addons/kaykit_restaurant_bits/Assets/gltf");

/**
 * Muiden pakettien mallit. scale on lisäkerroin SCALE:n päälle (Dungeon-paketin arkku ja avain
 * ovat huonekaluihin verrattuna isoja). parts: mallin liikkuva osa ja sen uusi nimi.
 */
const EXTRAS = [
  { name: "chest", file: join(DUNGEON_DIR, "chest.glb"), scale: 0.75, parts: { chest_lid: "lid" } },
  { name: "key", file: join(DUNGEON_DIR, "key.gltf.glb"), scale: 0.55 },
  { name: "fridge", file: join(RESTAURANT_DIR, "fridge_B.gltf"), scale: 0.6, parts: { fridge_B_door: "door" } },
];

const OUT_GLB = "public/models/furniture.glb";
const OUT_TS = "src/game/rooms/furniture.ts";

const io = new NodeIO();
const target = new Document();
target.createBuffer();
const sizes = {};

const sources = [
  ...readdirSync(FURNITURE_DIR)
    .filter((f) => f.endsWith(".gltf"))
    .sort()
    .map((f) => ({ name: basename(f, ".gltf"), file: join(FURNITURE_DIR, f), scale: 1, parts: {} })),
  ...EXTRAS.map((e) => ({ parts: {}, ...e })),
];

for (const { name, file, scale, parts } of sources) {
  const doc = await io.read(file);
  const scene = doc.getRoot().listScenes()[0];
  const nodes = scene.listChildren();
  const bodies = nodes.filter((n) => !(n.getName() in parts));
  if (bodies.length !== 1 || !bodies[0].getMesh()) throw new Error(`${file}: odotettiin yksi runko-mesh`);
  const body = bodies[0];
  const bt = body.getTranslation();
  if (bt.some((v) => Math.abs(v) > 1e-6) || body.getScale().some((v) => Math.abs(v - 1) > 1e-6)) throw new Error(`${file}: rungon muunnos ei ole nolla`);
  const s = SCALE * scale;
  const { min, max } = getBounds(scene);
  // Uusi origo: alareunan keskikohta (mallin omissa yksiköissä).
  const o = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  // Skaalaus ja siirto suoraan verteksidataan. Solmun oma muunnos nollataan.
  // prettier-ignore
  transformMesh(body.getMesh(), [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -o[0] * s, -o[1] * s, -o[2] * s, 1]);
  body.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setName(name);
  body.getMesh().setName(name);
  for (const part of doc.getRoot().listNodes().filter((n) => n.getName() in parts)) {
    // Lähdemallissa osa voi olla rungon lapsi; rungon oma muunnos on nolla, joten paikka on sama.
    if (part.getParentNode() && part.getParentNode() !== body) throw new Error(`${file}: osan pitää olla rungon lapsi tai juuressa`);
    // Osan paikka on sarana: se siirretään samalla tavalla kuin runko, ja osa tulee rungon lapseksi.
    const t = part.getTranslation();
    // prettier-ignore
    transformMesh(part.getMesh(), [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
    const partName = `${name}:${parts[part.getName()]}`;
    part.setTranslation([(t[0] - o[0]) * s, (t[1] - o[1]) * s, (t[2] - o[2]) * s]).setScale([1, 1, 1]).setName(partName);
    part.getMesh().setName(partName);
    if (!part.getParentNode()) scene.removeChild(part);
    body.addChild(part);
  }
  sizes[name] = [0, 1, 2].map((i) => round((max[i] - min[i]) * s));
  mergeDocuments(target, doc);
}

// Kaikki solmut samaan näkymään.
const root = target.getRoot();
const [main, ...rest] = root.listScenes();
for (const sc of rest) {
  for (const n of sc.listChildren()) main.addChild(n);
  sc.dispose();
}

// Vaatekaappi tehdään laatikoista huonekalujen omilla väreillä (sama tekstuuri ja materiaali).
const furnitureMaterial = root.listMeshes().find((m) => m.getName() === "cabinet_small").listPrimitives()[0].getMaterial();
const wardrobe = buildWardrobe(target, furnitureMaterial);
main.addChild(target.createNode("wardrobe").setMesh(wardrobe.mesh));
sizes.wardrobe = wardrobe.size;

// Yksi materiaali kutakin pakettia kohti, yksi puskuri.
await target.transform(dedup(), prune(), unpartition());
await io.write(OUT_GLB, target);

const names = Object.keys(sizes).sort();
const missingLabels = names.filter((n) => !LABELS[n]);
const ts = `// Tämä tiedosto on tehty komennolla npm run pack-furniture. Älä muokkaa käsin.
//
// Huonekalut, joita huoneeseen voi laittaa: { shape: "model", model: "couch", ... }
// Koko on [leveys, korkeus, syvyys] metreinä, kun rotate = 0. Etupuoli osoittaa silloin etelään (-z).
// Arkun kansi ja jääkaapin ovi aukeavat, kun esineellä on onTap.swing (esim. swing: 100).
// Mallit: KayKit Furniture Bits, Dungeon Remastered ja Restaurant Bits, Kay Lousberg (CC0-lisenssi).
// Vaatekaappi on tehty itse samoilla väreillä.

export const FURNITURE = {
${names.map((n) => `  ${n}: { label: ${JSON.stringify(LABELS[n] ?? n)}, size: [${sizes[n].join(", ")}] },`).join("\n")}
} as const satisfies Record<string, { label: string; size: readonly [number, number, number] }>;

export type FurnitureName = keyof typeof FURNITURE;
`;
await writeFile(OUT_TS, ts);

const kib = Math.round((await stat(OUT_GLB)).size / 1024);
console.log(`${names.length} mallia → ${OUT_GLB} (${kib} KiB), luettelo → ${OUT_TS}`);
if (missingLabels.length) console.log(`Ei suomenkielistä nimeä: ${missingLabels.join(", ")}`);

/**
 * Vaatekaappi metreinä: runko, jalusta, kruunu, kaksi ovea ja kahvat. Etupuoli osoittaa +z:aan
 * kuten KayKit-malleissa. Värit otetaan huonekalutekstuurista: jokainen väri on pystysuuntainen
 * liukuväri (ylhäällä vaaleampi), ja v-koordinaatti seuraa korkeutta kuten paketin omissa malleissa.
 */
function buildWardrobe(doc, material) {
  const H = 2.32;
  // Väriruudut tekstuurissa: u-koordinaatti ja v-alue (ylä..ala).
  const DARK = { u: 0.05, v: [0.02, 0.23] };
  const LIGHT = { u: 0.42, v: [0.02, 0.23] };
  const METAL = { u: 0.8, v: [0.04, 0.2] };
  // [minX, minY, minZ, maxX, maxY, maxZ, väri]
  const boxes = [
    [-0.6, 0.08, -0.3, 0.6, 2.24, 0.27, DARK], // runko
    [-0.58, 0, -0.28, 0.58, 0.08, 0.25, DARK], // jalusta
    [-0.64, 2.24, -0.33, 0.64, H, 0.33, LIGHT], // kruunu
    [-0.57, 0.14, 0.27, -0.01, 2.18, 0.31, LIGHT], // vasen ovi
    [0.01, 0.14, 0.27, 0.57, 2.18, 0.31, LIGHT], // oikea ovi
    [-0.09, 1.0, 0.31, -0.05, 1.3, 0.35, METAL], // kahvat
    [0.05, 1.0, 0.31, 0.09, 1.3, 0.35, METAL],
  ];
  const pos = [], nrm = [], uv = [], idx = [];
  // Kuusi sivua: normaali ja sivun neljä kulmaa (0 = min, 1 = max kullakin akselilla).
  const FACES = [
    [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
    [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
    [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
  ];
  for (const [x0, y0, z0, x1, y1, z1, color] of boxes) {
    for (const [n, corners] of FACES) {
      const base = pos.length / 3;
      for (const [cx, cy, cz] of corners) {
        const y = cy ? y1 : y0;
        pos.push(cx ? x1 : x0, y, cz ? z1 : z0);
        nrm.push(...n);
        uv.push(color.u, color.v[0] + (1 - y / H) * (color.v[1] - color.v[0]));
      }
      // Vastapäivään ulkoa katsottuna (glTF).
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", acc("VEC3", new Float32Array(pos)))
    .setAttribute("NORMAL", acc("VEC3", new Float32Array(nrm)))
    .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(uv)))
    .setIndices(acc("SCALAR", new Uint16Array(idx)))
    .setMaterial(material);
  const xs = boxes.flatMap((b) => [b[0], b[3]]);
  const zs = boxes.flatMap((b) => [b[2], b[5]]);
  const size = [Math.max(...xs) - Math.min(...xs), H, Math.max(...zs) - Math.min(...zs)].map(round);
  return { mesh: doc.createMesh("wardrobe").addPrimitive(prim), size };
}

function round(v) {
  return Math.round(v * 100) / 100;
}
