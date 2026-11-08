/**
 * Huoneen kuvaus. Uusi huone on vain lista esineitä: muoto, paikka, koko, väri
 * ja mitä napautuksesta tapahtuu. Katso room1.ts malliksi.
 *
 * Koordinaatit metreinä: x = vasen(-)/oikea(+), y = korkeus, z = etelä(-)/pohjoinen(+).
 * Huoneen keskipiste on (0, 0, 0) lattian tasolla. Ovi on aina pohjoisseinällä.
 */

import type { FurnitureName } from "./furniture";

export type Shape = "box" | "sphere" | "cylinder" | "sign" | "table" | "chair" | "model";

export interface ObjectDef {
  /** Yksilöllinen nimi huoneen sisällä. Tähän viitataan esim. reveals-kentässä. */
  id: string;
  shape: Shape;
  /**
   * Paikka. Laatikolla, pallolla, sylinterillä ja kyltillä keskipiste.
   * Pöydällä, tuolilla ja huonekalumallilla alareunan keskikohta: lattialla y = 0,
   * pöydän päällä y = pöydän korkeus.
   */
  at: [number, number, number];
  /**
   * Koko muodon mukaan:
   * box [leveys, korkeus, syvyys] · sphere [halkaisija] · cylinder [halkaisija, korkeus]
   * sign [leveys, korkeus] · table [leveys, korkeus, syvyys] · chair [leveys]
   * Huonekalumallilla kokoa ei anneta: se on valmiiksi oikea (ks. furniture.ts).
   */
  size?: number[];
  /**
   * Huonekalumallin nimi, kun shape on "model". Kaikki nimet ja koot ovat tiedostossa furniture.ts.
   * Esimerkiksi: { id: "sohva", shape: "model", model: "couch", at: [0, 0, -3.3], rotate: 180 }
   */
  model?: FurnitureName;
  color?: string;
  /** Hohtava väri (lamppu, merkkivalo, ikkuna). */
  glow?: string;
  /**
   * Kiertokulma asteina ylhäältä katsottuna. Kyltin ja huonekalun etupuoli osoittaa etelään (-z),
   * kun rotate = 0. Seinää vasten: eteläseinä 180, pohjoisseinä 0, itäseinä 90, länsiseinä -90.
   */
  rotate?: number;
  /** Kallistus asteina. 90 = kyltti makaa lattialla teksti ylöspäin. */
  tilt?: number;
  /** Kylttiin kirjoitettava teksti. Rivit erotetaan |-merkillä. */
  text?: string;
  textColor?: string;
  /** Valmis kuva kyltin tai laatikon pintaan. */
  texture?: "painting";
  /** Hahmo törmää tähän eikä kävele läpi, ja sen päälle voi hypätä. Pöydät, laatikot, kaapit. */
  solid?: boolean;
  /** Näkymätön, kunnes jokin toinen esine paljastaa sen (reveals). */
  hidden?: boolean;
  /** Mitä tapahtuu, kun esinettä napautetaan. */
  onTap?: TapBehavior;
}

export interface TapBehavior {
  /** Viesti ensimmäisellä kerralla. */
  message?: string;
  /** Viesti toisella ja myöhemmillä kerroilla. */
  messageAgain?: string;
  /** Viesti, jos esine on liian kaukana tai korkealla. */
  farMessage?: string;
  /** Näiden esineiden (id) piilotus poistuu. */
  reveals?: string[];
  /** Esine kääntyy vasemman reunansa saranan ympäri tämän verran asteita (taulu, kaapin ovi, luukku). */
  swing?: number;
  /** Pelaaja saa tämän esineen taskuunsa, ja esine katoaa huoneesta. */
  gives?: string;
  /** Vaatii esineen taskusta. Ilman sitä näytetään lockedMessage. */
  requires?: string;
  lockedMessage?: string;
  /** Avaa koodilukon. (Oven koodilukko tehdään automaattisesti.) */
  keypad?: boolean;
}

export interface RoomDefinition {
  id: string;
  name: string;
  /** Koodi, joka avaa oven. */
  code: string;
  /** Tehtävänanto, näytetään kun huoneeseen tullaan. */
  intro: string;
  size: { width: number; depth: number; height: number };
  colors: { wall: string; floor: string; ceiling: string };
  /** Mihin hahmo ilmestyy (x, z). */
  start: [number, number];
  /** Oven paikka pohjoisseinällä (x). Koodilukko tulee oven oikealle puolelle. */
  doorX: number;
  objects: ObjectDef[];
}
