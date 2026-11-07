/**
 * Pelin yleiset tekstit ja säädöt. Huoneiden sisältö on kansiossa rooms/.
 */
export const CONFIG = {
  texts: {
    controlsTouch: "Liiku vasemmalla peukalolla. Käännä kameraa vetämällä oikealta. Hyppää nurkan napista. Napauta esineitä.",
    controlsKeyboard: "Liiku WASD- tai nuolinäppäimillä. Käännä kameraa hiirellä vetämällä. Hyppää välilyönnillä. Klikkaa esineitä.",
    tooFar: "Mene lähemmäs.",
    doorLocked: "Ovi on lukossa. Vieressä on koodilukko.",
    doorOpening: "Ovi aukeaa! Kävele läpi.",
    doorOpenAlready: "Ovi on auki. Kävele läpi!",
    keypadUnlocked: "Lukko on jo auki.",
    codeWrong: "Väärä koodi.",
    codeRight: "Lukko avautui!",
    lockedDefault: "Lukossa.",
    roomDone: "Huone läpäisty!",
    finalTitle: "Pääsit ulos kaikista huoneista!",
    restartConfirm: "Aloitetaanko alusta huoneesta 1?",
  },

  /** Kuinka kaukaa esineisiin ylettyy: vaakasuunnassa metreinä, ja kuinka korkealle tai alas jalkojen tasosta. */
  reach: { horizontal: 1.6, up: 2.2, down: 0.9 },

  /** Hahmon liike. Hyppykorkeus on jumpSpeed² / (2 · gravity) eli noin 1,1 m. */
  move: { speed: 3.5, jumpSpeed: 5.6, gravity: 14 },

  /**
   * Pelaajan hahmon 3D-malli kansiossa public/models. Malli on KayKit-paketin Rogue (CC0-lisenssi).
   * Toisen hahmon saa komennolla: npm run trim-character -- polku/Knight.glb (ks. README).
   * Kunnes malli on ladattu, tai jos lataus epäonnistuu, näytetään vanha palikkahahmo.
   * height: mallin pituus metreinä. animSpeed: suurenna, jos jalat liukuvat kävellessä; pienennä, jos ne tepsuttavat.
   */
  avatar: { model: "models/rogue.glb", height: 1.7, animSpeed: 1.0 },
};
