import type { RoomDefinition } from "./types";

/**
 * Huone 3: avain on vaatekaapin päällä, jonne pääsee kiipeämällä tuolin ja pöydän kautta.
 * Avaimella arkku aukeaa. Arkun lapussa koodi on laskutehtävä: tuolit, kirjat, ikkunat.
 */
export const room3: RoomDefinition = {
  id: "avain-ja-lasku",
  name: "Avain ja lasku",
  code: "241",
  intro: "Tässä huoneessa pitää ensin löytää avain.",
  size: { width: 8, depth: 8, height: 3.5 },
  colors: { wall: "#d6c3b0", floor: "#4f4a45", ceiling: "#efe9e2" },
  start: [1, -0.5],
  doorX: 1,
  objects: [
    // Arkku lounaisnurkassa. Luukku on lukossa ilman avainta.
    { id: "chestBody", shape: "box", at: [-3.5, 0.25, -3.0], size: [0.9, 0.5, 0.45], color: "#6b4423", solid: true, onTap: { message: "Vanha arkku. Edessä on luukku." } },
    {
      id: "chestHatch",
      shape: "box",
      at: [-3.5, 0.25, -2.73],
      size: [0.8, 0.4, 0.04],
      color: "#8a5a33",
      onTap: {
        requires: "avain",
        lockedMessage: "Arkku on lukossa. Tarvitset avaimen.",
        swing: 100,
        message: "Arkku aukesi! Sisällä on lappu.",
        messageAgain: "Arkku on auki.",
        reveals: ["chestNote"],
      },
    },
    {
      id: "chestNote",
      shape: "sign",
      at: [-3.5, 0.28, -2.755],
      size: [0.5, 0.3],
      hidden: true,
      text: "KOODI =|tuolit · kirjat · ikkunat",
      color: "#f6ecc9",
      textColor: "#2b2b2b",
      onTap: { message: "Lapussa lukee: Koodi = tuolien määrä, kirjojen määrä, ikkunoiden määrä." },
    },

    // Vaatekaappi itäseinällä, avain sen päällä.
    { id: "wardrobe", shape: "box", at: [3.4, 1.15, 2.5], size: [1.2, 2.3, 0.6], color: "#4e3524", solid: true, onTap: { message: "Korkea vaatekaappi. Päällä kiiltää jotain." } },
    {
      id: "key",
      shape: "box",
      at: [3.4, 2.34, 2.5],
      size: [0.12, 0.05, 0.28],
      color: "#e0b23a",
      glow: "#5a4210",
      rotate: 30,
      onTap: { gives: "avain", message: "Sait avaimen!", farMessage: "Kaapin päällä kiiltää jotain. Liian korkealla." },
    },
    { id: "table", shape: "table", at: [2.1, 0, 2.6], size: [0.8, 0.75, 1.2], color: "#6f4a2c", solid: true, onTap: { message: "Pöytä. Sen päälle voisi kiivetä." } },

    // Laskettavat esineet: 2 tuolia, 4 kirjaa, 1 ikkuna.
    { id: "chair1", shape: "chair", at: [2.2, 0, 1.2], size: [0.45], color: "#7a5438", solid: true, onTap: { message: "Tuoli." } },
    { id: "chair2", shape: "chair", at: [-1.5, 0, 2.8], size: [0.45], rotate: 30, color: "#7a5438", solid: true, onTap: { message: "Tuoli." } },
    { id: "book1", shape: "box", at: [2.1, 0.78, 2.3], size: [0.35, 0.05, 0.25], color: "#9b2d3a", onTap: { message: "Kirja." } },
    { id: "book2", shape: "box", at: [2.1, 0.78, 2.9], size: [0.35, 0.05, 0.25], rotate: 20, color: "#2d4f9b", onTap: { message: "Kirja." } },
    { id: "book3", shape: "box", at: [0.5, 0.025, -1.0], size: [0.35, 0.05, 0.25], rotate: 40, color: "#2f7a3a", onTap: { message: "Kirja lattialla." } },
    { id: "book4", shape: "box", at: [-3.5, 0.53, -3.0], size: [0.35, 0.05, 0.25], rotate: -10, color: "#d9a53b", onTap: { message: "Kirja arkun päällä." } },
    {
      id: "window",
      shape: "sign",
      at: [-3.98, 2.0, 0.5],
      size: [1.2, 0.9],
      rotate: -90,
      color: "#9fd3f5",
      glow: "#5a7f99",
      onTap: { message: "Ikkuna. Ulkona on kaunis päivä." },
    },
    { id: "windowBarV", shape: "box", at: [-3.97, 2.0, 0.5], size: [0.02, 0.9, 0.04], color: "#f4f4f4" },
    { id: "windowBarH", shape: "box", at: [-3.97, 2.0, 0.5], size: [0.02, 0.04, 1.2], color: "#f4f4f4" },

    // Harhautukset.
    { id: "pot", shape: "cylinder", at: [-1.0, 0.15, -3.5], size: [0.4, 0.3], color: "#b0552f", onTap: { message: "Kasvi. Mullassa ei ole mitään." } },
    { id: "leaves", shape: "sphere", at: [-1.0, 0.6, -3.5], size: [0.7], color: "#3f8a45", onTap: { message: "Kasvi. Mullassa ei ole mitään." } },
    { id: "rug", shape: "box", at: [0, 0.005, 0.5], size: [2.6, 0.01, 1.8], color: "#6a3b5a", onTap: { message: "Matto. Sen alla ei ole mitään." } },
  ],
};
