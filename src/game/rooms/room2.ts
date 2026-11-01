import type { RoomDefinition } from "./types";

/**
 * Huone 2: koodi on kolmessa osassa. Punainen lappu on ruukun alla,
 * sininen korkealla hyllyllä (pitää kiivetä laatikon päälle) ja vihreä kaapissa.
 * Juliste kertoo järjestyksen.
 */
export const room2: RoomDefinition = {
  id: "kolme-numeroa",
  name: "Kolme numeroa",
  code: "583",
  intro: "Koodi on kolmessa osassa. Etsi punainen, sininen ja vihreä lappu.",
  size: { width: 8, depth: 8, height: 3.5 },
  colors: { wall: "#b9c9c4", floor: "#5f6b73", ceiling: "#e6ebea" },
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

    // Punainen lappu: ruukun alla pöydällä.
    { id: "table", shape: "table", at: [3.4, 0, 1.5], size: [0.8, 0.75, 1.6], color: "#6f4a2c", solid: true, onTap: { message: "Pöytä. Ruukku näyttää painavalta." } },
    {
      id: "pot",
      shape: "cylinder",
      at: [3.4, 0.9, 1.9],
      size: [0.3, 0.3],
      color: "#b0552f",
      onTap: { message: "Ruukun alla oli jotain! Punainen lappu putosi pöydälle.", messageAgain: "Ruukun alla ei ole enää mitään.", reveals: ["redNote"] },
    },
    { id: "leaves", shape: "sphere", at: [3.4, 1.3, 1.9], size: [0.55], color: "#3f8a45", onTap: { message: "Kasvi. Kokeile ruukkua." } },
    {
      id: "redNote",
      shape: "sign",
      at: [3.4, 0.76, 1.1],
      size: [0.3, 0.3],
      tilt: 90,
      hidden: true,
      text: "5",
      color: "#d9453b",
      textColor: "#ffffff",
      onTap: { message: "Punainen lappu: 5" },
    },

    // Sininen lappu: hyllyllä korkealla länsiseinällä. Laatikon päältä yltää.
    { id: "shelf", shape: "box", at: [-3.75, 2.5, 2.5], size: [0.5, 0.05, 1.2], color: "#5a3d28", solid: true },
    {
      id: "blueNote",
      shape: "sign",
      at: [-3.98, 2.7, 2.5],
      size: [0.3, 0.3],
      rotate: -90,
      text: "8",
      color: "#2f62c9",
      textColor: "#ffffff",
      onTap: { message: "Sininen lappu: 8", farMessage: "Liian korkealla. Pääsisikö jonnekin kiipeämään?" },
    },
    { id: "crate", shape: "box", at: [-3.2, 0.4, 1.4], size: [0.8, 0.8, 0.8], color: "#a67c52", solid: true, onTap: { message: "Puulaatikko. Aika tukeva. Sen päälle voisi hypätä." } },

    // Vihreä lappu: kaapissa pohjoisseinällä.
    { id: "cabinetBack", shape: "box", at: [2.0, 0.9, 3.8], size: [1.0, 1.8, 0.3], color: "#5a3d28", solid: true },
    { id: "cabinetLeft", shape: "box", at: [1.525, 0.9, 3.675], size: [0.05, 1.8, 0.55], color: "#5a3d28", solid: true },
    { id: "cabinetRight", shape: "box", at: [2.475, 0.9, 3.675], size: [0.05, 1.8, 0.55], color: "#5a3d28", solid: true },
    { id: "cabinetTop", shape: "box", at: [2.0, 1.775, 3.675], size: [1.0, 0.05, 0.55], color: "#5a3d28", solid: true },
    { id: "cabinetBottom", shape: "box", at: [2.0, 0.025, 3.675], size: [1.0, 0.05, 0.55], color: "#5a3d28", solid: true },
    {
      id: "cabinetDoor",
      shape: "box",
      at: [2.0, 0.9, 3.42],
      size: [0.9, 1.6, 0.04],
      color: "#7a5438",
      onTap: { swing: 100, message: "Kaapin ovi aukesi.", messageAgain: "Kaappi on auki.", reveals: ["greenNote"] },
    },
    {
      id: "greenNote",
      shape: "sign",
      at: [2.0, 1.2, 3.62],
      size: [0.3, 0.3],
      hidden: true,
      text: "3",
      color: "#2f9e44",
      textColor: "#ffffff",
      onTap: { message: "Vihreä lappu: 3" },
    },

    { id: "rug", shape: "box", at: [0, 0.005, 0], size: [2.4, 0.01, 1.6], color: "#3b5a8a" },
  ],
};
