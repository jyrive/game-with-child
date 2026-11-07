// Karsii hahmomallista (.glb) pois animaatiot, joita peli ei käytä, ja tiivistää tiedoston.
// KayKit-hahmoissa on 76 animaatiota ja tiedosto on 3,5 Mt; peli tarvitsee vain muutaman.
//
// Käyttö:  npm run trim-character -- <lähde.glb> [kohde.glb]
// Oletuskohde on public/models/<nimi pienillä kirjaimilla>.glb
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { dedup, prune, resample } from "@gltf-transform/functions";

/** Animaatiot, jotka jätetään tiedostoon. Nimet ovat KayKit-pakettien nimiä. */
const KEEP = new Set(["Idle", "Walking_A", "Running_A", "Jump_Idle", "Interact", "Cheer"]);
/** Solmut, joiden alla roikkuvat esineet (aseet) poistetaan. KayKit kiinnittää ne käsien "handslot"-solmuihin. */
const DROP_UNDER = /handslot/i;

const [, , source, target] = process.argv;
if (!source) {
  console.error("Käyttö: npm run trim-character -- <lähde.glb> [kohde.glb]");
  process.exit(1);
}
const out = target ?? `public/models/${basename(source).toLowerCase()}`;

const io = new NodeIO();
const doc = await io.read(source);
const root = doc.getRoot();

const before = root.listAnimations().map((a) => a.getName());
for (const anim of root.listAnimations()) {
  if (KEEP.has(anim.getName())) continue;
  // Kanavat ja samplerit on poistettava erikseen; muuten niiden avainkehykset jäävät tiedostoon.
  for (const channel of anim.listChannels()) channel.dispose();
  for (const sampler of anim.listSamplers()) sampler.dispose();
  anim.dispose();
}
const kept = root.listAnimations().map((a) => a.getName());
const missing = [...KEEP].filter((n) => !before.includes(n));

const dropped = [];
for (const node of root.listNodes()) {
  if (!DROP_UNDER.test(node.getName())) continue;
  for (const child of node.listChildren()) {
    dropped.push(child.getName());
    child.getMesh()?.dispose();
    child.dispose();
  }
}

// resample poistaa turhat avainkehykset, prune käyttämättömät tiedot, dedup kaksoiskappaleet.
// keepLeaves: luurangon luut ovat tyhjiä solmuja, eikä niitä saa poistaa.
await doc.transform(resample(), prune({ keepLeaves: true }), dedup());
await io.write(out, doc);

const scene = root.listScenes()[0];
const bounds = scene ? getBounds(scene) : null;
const triangles = root
  .listMeshes()
  .flatMap((m) => m.listPrimitives())
  .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")?.getCount() ?? 0) / 3, 0);
const kib = async (p) => Math.round((await stat(p)).size / 1024);

console.log(`${source} -> ${out}`);
console.log(`koko: ${await kib(source)} KiB -> ${await kib(out)} KiB`);
console.log(`kolmioita: ${Math.round(triangles)}, luita: ${root.listSkins()[0]?.listJoints().length ?? 0}`);
if (bounds) {
  const [min, max] = [bounds.min, bounds.max];
  console.log(`mitat (x,y,z): ${(max[0] - min[0]).toFixed(2)} × ${(max[1] - min[1]).toFixed(2)} × ${(max[2] - min[2]).toFixed(2)}, jalat y=${min[1].toFixed(2)}`);
}
console.log(`animaatiot (${kept.length}/${before.length}): ${kept.join(", ")}`);
console.log(`poistetut esineet: ${dropped.join(", ") || "-"}`);
if (missing.length) console.warn(`VAROITUS: mallista puuttuvat animaatiot: ${missing.join(", ")}`);
