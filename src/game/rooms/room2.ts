import type { RoomDefinition } from "./types";

/**
 * Huone 2: koodi on kolmessa osassa. Punainen lappu on kaktusruukun alla,
 * sininen korkealla hyllyllä (pitää kiivetä pienen kaapin päälle) ja vihreä jääkaapissa.
 * Juliste kertoo järjestyksen.
 */
export const room2: RoomDefinition = {
  id: "kolme-numeroa",
  name: "Kolme numeroa",
  code: "583",
  intro: "Koodi on kolmessa osassa. Etsi punainen, sininen ja vihreä lappu.",
  size: { width: 8, depth: 8, height: 3.5 },
  colors: { wall: "#b9c9c4", floor: "#5f6b73", ceiling: "#e6ebea" },
  floorStyle: "tiles",
  wallStyle: "panel",
  start: [-1, -0.5],
  doorX: -1,
  objects: [
    {
      id: "poster",
      shape: "sign",
      at: [0, 2.0, -3.98],
      size: [1.6, 0.8],
      rotate: 180,
      text: "JÄRJESTYS|punainen · sininen · vihreä",
      color: "#e8d9b0",
      textColor: "#3a2a1a",
      onTap: { message: "Julisteessa lukee: punainen, sininen, vihreä. Siinä järjestyksessä." },
    },

    // Punainen lappu: kaktusruukun alla pöydällä.
    { id: "table", shape: "model", model: "table_medium", at: [3.15, 0, 1.5], solid: true, onTap: { message: "Pöytä. Kaktusruukku näyttää painavalta." } },
    {
      id: "pot",
      shape: "model",
      model: "cactus_small_B",
      at: [3.35, 0.78, 1.95],
      onTap: { message: "Ruukun alla oli jotain! Punainen lappu putosi pöydälle.", messageAgain: "Ruukun alla ei ole enää mitään.", reveals: ["redNote"] },
    },
    { id: "chair", shape: "model", model: "chair_A_wood", at: [2.05, 0, 1.3], rotate: -90, solid: true, onTap: { message: "Tuoli." } },
    {
      id: "redNote",
      shape: "sign",
      at: [3.2, 0.79, 1.1],
      size: [0.3, 0.3],
      tilt: 90,
      hidden: true,
      text: "5",
      color: "#d9453b",
      textColor: "#ffffff",
      onTap: { message: "Punainen lappu: 5" },
    },

    // Sininen lappu: hyllyn yläpuolella korkealla länsiseinällä. Pienen kaapin päältä yltää.
    { id: "shelf", shape: "model", model: "shelf_A_big", at: [-3.8, 2.3, 2.5], rotate: -90 },
    {
      id: "blueNote",
      shape: "sign",
      at: [-3.98, 2.82, 2.5],
      size: [0.3, 0.3],
      rotate: -90,
      text: "8",
      color: "#2f62c9",
      textColor: "#ffffff",
      onTap: { message: "Sininen lappu: 8", farMessage: "Liian korkealla. Pääsisikö jonnekin kiipeämään?" },
    },
    { id: "crate", shape: "model", model: "cabinet_small", at: [-3.4, 0, 1.6], rotate: -90, solid: true, onTap: { message: "Pieni kaappi. Aika tukeva. Sen päälle voisi hypätä." } },

    // Vihreä lappu: jääkaapissa pohjoisseinällä.
    {
      id: "fridge",
      shape: "model",
      model: "fridge",
      at: [2.0, 0, 3.45],
      solid: true,
      onTap: { swing: 100, message: "Jääkaapin ovi aukesi.", messageAgain: "Jääkaappi on auki.", reveals: ["greenNote"] },
    },
    {
      id: "greenNote",
      shape: "sign",
      at: [2.0, 0.75, 3.26],
      size: [0.3, 0.3],
      hidden: true,
      text: "3",
      color: "#2f9e44",
      textColor: "#ffffff",
      onTap: { message: "Vihreä lappu: 3" },
    },

    // Sisustus: lipasto eteläseinällä, taulu pöydän yläpuolella, lamppu ja matto.
    { id: "dresser", shape: "model", model: "cabinet_medium_decorated", at: [-2.6, 0, -3.6], rotate: 180, solid: true, onTap: { message: "Lipasto. Laatikoissa on vain sukkia." } },
    { id: "picture", shape: "model", model: "pictureframe_medium", at: [3.92, 1.3, 1.5], rotate: 90, onTap: { message: "Taulu. Sen takana on pelkkää seinää." } },
    { id: "lamp", shape: "model", model: "lamp_standing", at: [3.4, 0, -3.4], onTap: { message: "Jalkalamppu." } },
    { id: "rug", shape: "model", model: "rug_rectangle_stripes_A", at: [0, 0, 0] },
  ],
};
