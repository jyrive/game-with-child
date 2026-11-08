import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { FurnitureName } from "./rooms/furniture";

const URL = "models/furniture.glb";

/**
 * Kääntö, jolla mallin etupuoli saadaan osoittamaan etelään (-z), kun esineen rotate = 0.
 * Sama suunta kuin kylteillä.
 */
const FRONT_YAW = Math.PI;

/**
 * Huonekalumallit (public/models/furniture.glb, tehty komennolla npm run pack-furniture).
 * Tiedosto ladataan kerran. Jokainen huoneen huonekalu on kopio mallista: kopiot jakavat
 * saman geometrian ja saman materiaalin, joten niitä voi olla monta ilman lisäkustannusta.
 */
export class FurnitureLibrary {
  private constructor(
    private readonly templates: Map<string, Mesh>,
    readonly material: StandardMaterial,
  ) {}

  /** Lataa mallit. Palauttaa null, jos lataus epäonnistuu; silloin huonekalut näytetään laatikkoina. */
  static async load(scene: Scene): Promise<FurnitureLibrary | null> {
    try {
      // Sama glTF-lataaja kuin hahmolla (ks. avatar.ts, miksi ei registerBuiltInLoaders).
      await import("@babylonjs/loaders/glTF/2.0/glTFLoader");
      const result = await ImportMeshAsync(`${import.meta.env.BASE_URL}${URL}`, scene);
      const material = new StandardMaterial("mat:furniture", scene);
      material.specularColor = Color3.Black();

      // Kaikilla malleilla on sama tekstuuri. glTF-lataajan PBR-materiaali vaihdetaan tavalliseen
      // materiaaliin ilman kiiltoa, kuten hahmossa ja huoneen esineissä.
      const loaded = new Set(result.meshes.map((m) => m.material).filter((m) => m !== null));
      for (const src of loaded) if (src.getClassName() === "PBRMaterial") material.diffuseTexture ??= (src as PBRMaterial).albedoTexture;

      const templates = new Map<string, Mesh>();
      for (const m of result.meshes) {
        if (!(m instanceof Mesh) || m.getTotalVertices() === 0) continue;
        // glTF-tiedoston oikeakätinen koordinaatisto on lataajan juurisolmussa. Leivotaan se
        // verteksidataan, jolloin kopioita voi siirtää ja kääntää ilman juurisolmua.
        m.setParent(null);
        m.bakeCurrentTransformIntoVertices();
        if (FRONT_YAW !== 0) m.bakeTransformIntoVertices(Matrix.RotationY(FRONT_YAW));
        m.material = material;
        m.isPickable = false;
        m.setEnabled(false);
        templates.set(m.name, m);
      }
      for (const m of result.meshes) if (!templates.has(m.name)) m.dispose(); // lataajan juurisolmu
      for (const src of loaded) src.dispose(); // tekstuuri jää, sitä ei hävitetä oletuksena
      const first = templates.values().next().value;
      if (!first) throw new Error("tiedostossa ei ole yhtään mallia");
      await material.forceCompilationAsync(first);
      material.freeze();
      return new FurnitureLibrary(templates, material);
    } catch (e) {
      console.warn("Huonekalujen malleja ei voitu ladata, käytetään laatikoita.", e);
      return null;
    }
  }

  /** Uusi kopio mallista. Alareunan keskikohta on origossa. null, jos mallia ei ole. */
  create(name: FurnitureName, id: string): Mesh | null {
    const template = this.templates.get(name);
    if (!template) return null;
    const m = template.clone(id, null, true);
    m.setEnabled(true);
    return m;
  }
}
