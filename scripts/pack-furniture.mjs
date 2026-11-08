// Pakkaa KayKit Furniture Bits -paketin huonekalut yhdeksi tiedostoksi public/models/furniture.glb
// ja kirjoittaa luettelon src/game/rooms/furniture.ts, josta huoneiden tekijä näkee nimet ja koot.
//
// Käyttö:  npm run pack-furniture -- <kansio, jossa paketin .gltf-tiedostot ovat>
// Paketti: https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
//          (tiedostot ovat kansiossa addons/kaykit_furniture_bits/Assets/gltf)
//
// Jokainen malli skaalataan pelin mittoihin ja siirretään niin, että mallin alareunan keskikohta
// on origossa. Silloin huoneen esineen "at" on se kohta lattialla (tai pöydällä), jolle malli asetetaan.
import { readdir, stat, writeFile } from "node:fs/promises";
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
};

const [, , folder] = process.argv;
if (!folder) {
  console.error("Käyttö: npm run pack-furniture -- <kansio, jossa .gltf-tiedostot ovat>");
  process.exit(1);
}
const OUT_GLB = "public/models/furniture.glb";
const OUT_TS = "src/game/rooms/furniture.ts";

const io = new NodeIO();
const target = new Document();
target.createBuffer();
const sizes = {};

const files = (await readdir(folder)).filter((f) => f.endsWith(".gltf")).sort();
for (const file of files) {
  const name = basename(file, ".gltf");
  const doc = await io.read(join(folder, file));
  const scene = doc.getRoot().listScenes()[0];
  const nodes = scene.listChildren();
  if (nodes.length !== 1 || !nodes[0].getMesh()) throw new Error(`${file}: odotettiin yksi mesh`);
  const node = nodes[0];
  const { min, max } = getBounds(scene);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  // Skaalaus ja siirto suoraan verteksidataan. Solmun oma muunnos nollataan.
  // prettier-ignore
  transformMesh(node.getMesh(), [SCALE, 0, 0, 0, 0, SCALE, 0, 0, 0, 0, SCALE, 0, -cx * SCALE, -min[1] * SCALE, -cz * SCALE, 1]);
  node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setName(name);
  node.getMesh().setName(name);
  sizes[name] = [0, 1, 2].map((i) => round((max[i] - min[i]) * SCALE));
  mergeDocuments(target, doc);
}

// Kaikki solmut samaan näkymään.
const root = target.getRoot();
const [main, ...rest] = root.listScenes();
for (const s of rest) {
  for (const n of s.listChildren()) main.addChild(n);
  s.dispose();
}
// Yksi yhteinen tekstuuri ja materiaali, yksi puskuri.
await target.transform(dedup(), prune(), unpartition());
await io.write(OUT_GLB, target);

const names = Object.keys(sizes);
const missingLabels = names.filter((n) => !LABELS[n]);
const ts = `// Tämä tiedosto on tehty komennolla npm run pack-furniture. Älä muokkaa käsin.
//
// Huonekalut, joita huoneeseen voi laittaa: { shape: "model", model: "couch", ... }
// Koko on [leveys, korkeus, syvyys] metreinä, kun rotate = 0. Etupuoli osoittaa silloin etelään (-z).
// Mallit: KayKit Furniture Bits, Kay Lousberg (CC0-lisenssi).

export const FURNITURE = {
${names.map((n) => `  ${n}: { label: ${JSON.stringify(LABELS[n] ?? n)}, size: [${sizes[n].join(", ")}] },`).join("\n")}
} as const satisfies Record<string, { label: string; size: readonly [number, number, number] }>;

export type FurnitureName = keyof typeof FURNITURE;
`;
await writeFile(OUT_TS, ts);

const kib = Math.round((await stat(OUT_GLB)).size / 1024);
console.log(`${names.length} mallia → ${OUT_GLB} (${kib} KiB), luettelo → ${OUT_TS}`);
if (missingLabels.length) console.log(`Ei suomenkielistä nimeä: ${missingLabels.join(", ")}`);

function round(v) {
  return Math.round(v * 100) / 100;
}
