import type { RoomDefinition } from "./types";

/**
 * Huone 3: avain on vaatekaapin päällä. Siihen yltää, kun kiipeää viereisen pöydän päälle.
 * Avaimella arkku aukeaa. Arkun lapussa koodi on laskutehtävä: tuolit, kirjat, ikkunat.
 * Huoneessa pitää olla tasan 2 tuolia, 4 kirjaa ja 1 ikkuna. Älä lisää koristeltuja hyllyjä tai
 * kaappeja (niissä on kirjoja), tauluja (näyttävät ikkunoilta) tai muita istuimia.
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
    // Arkku lounaisnurkassa. Kansi on lukossa ilman avainta; lappu on arkussa kannen alla.
    {
      id: "chest",
      shape: "model",
      model: "chest",
      at: [-3.3, 0, -3.4],
      rotate: 180,
      solid: true,
      onTap: {
        requires: "avain",
        lockedMessage: "Vanha arkku. Se on lukossa. Tarvitset avaimen.",
        swing: 100,
        message: "Arkku aukesi! Sisällä on lappu.",
        messageAgain: "Arkku on auki.",
        reveals: ["chestNote"],
      },
    },
    {
      id: "chestNote",
      shape: "sign",
      at: [-3.3, 0.37, -3.4],
      size: [0.66, 0.42],
      rotate: 180,
      tilt: 90,
      hidden: true,
      text: "KOODI =|tuolit · kirjat · ikkunat",
      color: "#f6ecc9",
      textColor: "#2b2b2b",
      onTap: { message: "Lapussa lukee: Koodi = tuolien määrä, kirjojen määrä, ikkunoiden määrä." },
    },

    // Vaatekaappi itäseinällä, avain sen päällä.
    { id: "wardrobe", shape: "model", model: "wardrobe", at: [3.64, 0, 2.5], rotate: 90, solid: true, onTap: { message: "Korkea vaatekaappi. Päällä kiiltää jotain." } },
    {
      id: "key",
      shape: "model",
      model: "key",
      at: [3.6, 2.32, 2.5],
      rotate: 30,
      tilt: 90,
      onTap: { gives: "avain", message: "Sait avaimen!", farMessage: "Kaapin päällä kiiltää jotain. Liian korkealla." },
    },
    { id: "table", shape: "model", model: "table_small", at: [2.2, 0, 2.5], solid: true, onTap: { message: "Pöytä. Sen päälle voisi kiivetä." } },

    // Laskettavat esineet: 2 tuolia, 4 kirjaa, 1 ikkuna.
    { id: "chair1", shape: "model", model: "chair_A", at: [2.2, 0, 1.35], rotate: 180, solid: true, onTap: { message: "Tuoli." } },
    { id: "chair2", shape: "model", model: "chair_B_wood", at: [-1.5, 0, 2.8], rotate: 30, solid: true, onTap: { message: "Tuoli." } },
    { id: "book1", shape: "model", model: "book_single", at: [2.0, 0.78, 2.3], rotate: 10, onTap: { message: "Kirja." } },
    { id: "book2", shape: "model", model: "book_single", at: [2.4, 0.78, 2.7], rotate: -20, onTap: { message: "Kirja." } },
    { id: "book3", shape: "model", model: "book_single", at: [-3.4, 0.78, 1.1], rotate: -70, onTap: { message: "Kirja yöpöydällä." } },
    { id: "book4", shape: "model", model: "book_single", at: [-2.2, 0, -3.7], rotate: -10, onTap: { message: "Kirja lattialla arkun vieressä." } },
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

    // Makuunurkkaus: sänky ja yöpöytä ikkunan alla.
    { id: "bed", shape: "model", model: "bed_single_B", at: [-3.35, 0, 2.8], solid: true, onTap: { message: "Sänky. Patjan alla ei ole mitään." } },
    { id: "nightstand", shape: "model", model: "cabinet_small", at: [-3.4, 0, 1.1], rotate: -90, solid: true, onTap: { message: "Yöpöytä. Laatikko on tyhjä." } },

    // Harhautukset.
    { id: "pot", shape: "model", model: "cactus_medium_A", at: [-1.0, 0, -3.5], onTap: { message: "Kaktus. Mullassa ei ole mitään." } },
    { id: "lamp", shape: "model", model: "lamp_standing", at: [3.4, 0, -3.4], onTap: { message: "Jalkalamppu." } },
    { id: "rug", shape: "model", model: "rug_rectangle_A", at: [0, 0, 0.3], onTap: { message: "Matto. Sen alla ei ole mitään." } },
  ],
};
