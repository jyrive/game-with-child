import type { RoomDefinition } from "./types";

/** Huone 1: koodi on lapussa taulun takana. */
export const room1: RoomDefinition = {
  id: "alku",
  name: "Alku",
  code: "427",
  intro: "Olet lukitussa huoneessa. Etsi koodi ja avaa ovi.",
  size: { width: 8, depth: 8, height: 3.5 },
  colors: { wall: "#cfc4ad", floor: "#7a5a3c", ceiling: "#ece6d8" },
  start: [0, -0.5],
  doorX: 0,
  objects: [
    // Itäseinä: taulu, jonka takana on lappu.
    {
      id: "painting",
      shape: "box",
      at: [3.95, 1.6, 0],
      size: [1.0, 0.75, 0.06],
      rotate: 90,
      texture: "painting",
      onTap: {
        swing: 75,
        message: "Taulu heilahti sivuun. Sen takana on lappu!",
        messageAgain: "Taulun takana on lappu.",
      },
    },
    {
      id: "note",
      shape: "sign",
      at: [3.985, 1.6, 0],
      size: [0.5, 0.25],
      rotate: 90,
      text: "4 2 7",
      color: "#f6ecc9",
      textColor: "#2b2b2b",
      onTap: { message: "Lapussa lukee: 4 2 7" },
    },
    // Eteläseinä: juliste.
    {
      id: "poster",
      shape: "sign",
      at: [0, 1.9, -3.98],
      size: [1.4, 0.7],
      rotate: 180,
      text: "VIHJE|Katso taulun taakse",
      color: "#e8d9b0",
      textColor: "#3a2a1a",
      onTap: { message: "Julisteessa lukee: Katso taulun taakse." },
    },
    // Länsiseinä: pöytä, kasvi ja kirja.
    { id: "table", shape: "table", at: [-3.4, 0, 0], size: [0.8, 0.75, 1.6], color: "#6f4a2c", solid: true, onTap: { message: "Pöytä. Ei mitään erikoista." } },
    { id: "pot", shape: "cylinder", at: [-3.4, 0.9, -0.4], size: [0.3, 0.3], color: "#b0552f", onTap: { message: "Ihan tavallinen kasvi." } },
    { id: "leaves", shape: "sphere", at: [-3.4, 1.3, -0.4], size: [0.55], color: "#3f8a45", onTap: { message: "Ihan tavallinen kasvi." } },
    { id: "book", shape: "box", at: [-3.4, 0.78, 0.4], size: [0.4, 0.06, 0.28], rotate: 15, color: "#9b2d3a", onTap: { message: "Kirja: Pakohuoneen salaisuudet. Sivut ovat tyhjiä." } },
    // Matto keskellä lattiaa.
    { id: "rug", shape: "box", at: [0, 0.005, 0], size: [2.4, 0.01, 1.6], color: "#8a3b3b" },
  ],
};
