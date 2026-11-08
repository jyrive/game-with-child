import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Material } from "@babylonjs/core/Materials/material";
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
 * Mallin liikkuva osa (arkun kansi, jääkaapin ovi). Osan origo on saranan kohdalla.
 * axis: minkä akselin ympäri osa kääntyy. sign: kumpaan suuntaan, jotta osa aukeaa ulospäin tai ylös.
 */
export interface MovingPart {
  mesh: Mesh;
  axis: "x" | "y";
  sign: number;
}

interface Template {
  mesh: Mesh;
  /** Liikkuvan osan nimi ja kääntösuunta. Kopioissa osa löytyy nimen perusteella. */
  part?: { name: string; axis: "x" | "y"; sign: number };
}

/**
 * Huonekalumallit (public/models/furniture.glb, tehty komennolla npm run pack-furniture).
 * Tiedosto ladataan kerran. Jokainen huoneen huonekalu on kopio mallista: kopiot jakavat
 * saman geometrian ja materiaalin, joten niitä voi olla monta ilman lisäkustannusta.
 */
export class FurnitureLibrary {
  private constructor(
    private readonly templates: Map<string, Template>,
    /** Kaikkien mallien yhteiset materiaalit (yksi kutakin KayKit-pakettia kohti). */
    readonly materials: ReadonlySet<Material>,
  ) {}

  /** Lataa mallit. Palauttaa null, jos lataus epäonnistuu; silloin huonekalut näytetään laatikoina. */
  static async load(scene: Scene): Promise<FurnitureLibrary | null> {
    try {
      // Sama glTF-lataaja kuin hahmolla (ks. avatar.ts, miksi ei registerBuiltInLoaders).
      await import("@babylonjs/loaders/glTF/2.0/glTFLoader");
      const result = await ImportMeshAsync(`${import.meta.env.BASE_URL}${URL}`, scene);
      const [loaderRoot] = result.meshes;
      if (!loaderRoot) throw new Error("tiedostossa ei ole yhtään mallia");

      // glTF-lataajan PBR-materiaalit vaihdetaan tavallisiin materiaaleihin ilman kiiltoa, kuten
      // hahmossa ja huoneen esineissä. Tekstuuri otetaan talteen.
      const converted = new Map<Material, StandardMaterial>();
      for (const src of new Set(result.meshes.map((m) => m.material))) {
        if (!src) continue;
        const std = new StandardMaterial(`mat:furniture:${converted.size}`, scene);
        std.specularColor = Color3.Black();
        if (src.getClassName() === "PBRMaterial") std.diffuseTexture = (src as PBRMaterial).albedoTexture;
        converted.set(src, std);
      }

      // glTF-tiedoston oikeakätinen koordinaatisto on lataajan juurisolmussa. Lisätään siihen kääntö,
      // jolla etupuoli osoittaa etelään, ja leivotaan kaikki verteksidataan. Sen jälkeen kopioita voi
      // siirtää ja kääntää ilman juurisolmua.
      const yaw = Matrix.RotationY(FRONT_YAW);
      loaderRoot.computeWorldMatrix(true);

      const templates = new Map<string, Template>();
      for (const node of loaderRoot.getChildren()) {
        if (!(node instanceof Mesh)) continue;
        const parts = node.getChildMeshes(true).filter((c): c is Mesh => c instanceof Mesh);
        const template: Template = { mesh: node };

        // Liikkuva osa: sarana on osan origossa. Leivotaan osa maailman koordinaatteihin ja siirretään
        // se takaisin saranan ympärille, niin kääntö toimii osan omalla rotation-arvolla.
        for (const part of parts) {
          part.computeWorldMatrix(true);
          const pivot = Vector3.TransformCoordinates(part.getAbsolutePosition(), yaw);
          part.setParent(null);
          part.bakeCurrentTransformIntoVertices();
          part.bakeTransformIntoVertices(yaw.multiply(Matrix.Translation(-pivot.x, -pivot.y, -pivot.z)));
          part.refreshBoundingInfo();
          part.position.copyFrom(pivot);
          const kind = part.name.split(":")[1];
          template.part = { name: part.name, ...openDirection(part, kind === "lid" ? "x" : "y") };
        }
        node.setParent(null);
        node.bakeCurrentTransformIntoVertices();
        node.bakeTransformIntoVertices(yaw);
        for (const part of parts) part.parent = node; // rungon muunnos on nyt nolla
        for (const m of [node, ...parts]) {
          m.rotationQuaternion = null; // glTF-solmuilla on kvaternio; ilman tätä rotation-arvoa ei huomioitaisi
          if (m.material) m.material = converted.get(m.material) ?? m.material;
          m.isPickable = false;
        }
        node.setEnabled(false);
        templates.set(node.name, template);
      }
      loaderRoot.dispose();
      for (const src of converted.keys()) src.dispose(); // tekstuurit jäävät, niitä ei hävitetä oletuksena

      const materials = new Set<Material>(converted.values());
      await Promise.all(
        [...materials].map((mat) => {
          const user = [...templates.values()].find((t) => t.mesh.material === mat)?.mesh;
          return user ? mat.forceCompilationAsync(user) : undefined;
        }),
      );
      for (const mat of materials) mat.freeze();
      return new FurnitureLibrary(templates, materials);
    } catch (e) {
      console.warn("Huonekalujen malleja ei voitu ladata, käytetään laatikoita.", e);
      return null;
    }
  }

  /**
   * Uusi kopio mallista. Alareunan keskikohta on origossa. Jos mallissa on liikkuva osa, se on
   * kopion lapsi ja palautetaan myös erikseen. null, jos mallia ei ole.
   */
  create(name: FurnitureName, id: string): { mesh: Mesh; part: MovingPart | null } | null {
    const template = this.templates.get(name);
    if (!template) return null;
    const mesh = template.mesh.clone(id, null, false);
    mesh.setEnabled(true);
    let part: MovingPart | null = null;
    const info = template.part;
    if (info) {
      const p = mesh.getChildMeshes(true).find((c) => c.name.endsWith(info.name));
      if (p instanceof Mesh) part = { mesh: p, axis: info.axis, sign: info.sign };
    }
    return { mesh, part };
  }
}

/**
 * Kumpaan suuntaan osaa käännetään, jotta se aukeaa: ovi kääntyy niin, että sen vapaa reuna
 * liikkuu eteenpäin (-z), ja kansi niin, että sen etureuna nousee ylös.
 */
function openDirection(part: Mesh, axis: "x" | "y"): { axis: "x" | "y"; sign: number } {
  const { minimum, maximum } = part.getBoundingInfo().boundingBox; // sarana on origossa
  const c = Vector3.Center(minimum, maximum);
  // Babylonin kierto: y-akselin ympäri z muuttuu -x·kulma, x-akselin ympäri y muuttuu -z·kulma.
  if (axis === "y") return { axis, sign: c.x >= 0 ? 1 : -1 };
  return { axis, sign: c.z >= 0 ? -1 : 1 };
}
