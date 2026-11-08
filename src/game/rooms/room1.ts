import type { RoomDefinition } from "./types";

/** Huone 1: koodi on lapussa taulun takana. */
export const room1: RoomDefinition = {
  id: "alku",
  name: "Alku",
  code: "427",
  intro: "Olet lukitussa huoneessa. Etsi koodi ja avaa ovi.",
  size: { width: 8, depth: 8, height: 3.5 },
  colors: { wall: "#cfc4ad", floor: "#7a5a3c", ceiling: "#ece6d8" },
  floorStyle: "planks",
  wallStyle: "wallpaper",
  start: [0, -0.5],
  doorX: 0,
  objects: [
    // Itäseinä: taulu, jonka takana on lappu.
    {
      id: "painting",
      shape: "model",
      model: "pictureframe_large_A",
      at: [3.92, 1.15, 0],
      rotate: 90,
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
    // Länsiseinä: pöytä, kaktus ja kirjat, hylly pöydän yläpuolella.
    { id: "table", shape: "model", model: "table_medium", at: [-3.1, 0, 0], solid: true, onTap: { message: "Pöytä. Ei mitään erikoista." } },
    { id: "cactus", shape: "model", model: "cactus_small_A", at: [-3.3, 0.78, -0.4], onTap: { message: "Ihan tavallinen kaktus. Piikikäs!" } },
    { id: "book", shape: "model", model: "book_set", at: [-3.4, 0.78, 0.35], rotate: -90, onTap: { message: "Kirjoja: Pakohuoneen salaisuudet 1, 2 ja 3. Sivut ovat tyhjiä." } },
    { id: "shelf", shape: "model", model: "shelf_B_small_decorated", at: [-3.75, 1.7, 0], rotate: -90 },

    // Eteläseinä: sohva julisteen alla, sohvapöytä edessä.
    { id: "couch", shape: "model", model: "couch_pillows", at: [0, 0, -3.35], rotate: 180, solid: true, onTap: { message: "Pehmeä sohva. Tyynyjen alla ei ole mitään." } },
    { id: "coffeeTable", shape: "model", model: "table_low", at: [0, 0, -1.9], solid: true, onTap: { message: "Sohvapöytä." } },

    // Nurkat: lamppu, nojatuoli ja kaktus.
    { id: "lamp", shape: "model", model: "lamp_standing", at: [-3.4, 0, 3.4], onTap: { message: "Jalkalamppu. Valo on päällä." } },
    { id: "armchair", shape: "model", model: "armchair", at: [3.1, 0, -3.1], rotate: 135, solid: true, onTap: { message: "Nojatuoli. Siinä olisi mukava istua." } },
    { id: "bigCactus", shape: "model", model: "cactus_medium_A", at: [3.4, 0, 3.4], onTap: { message: "Iso kaktus. Älä koske!" } },

    // Matto keskellä lattiaa.
    { id: "rug", shape: "model", model: "rug_oval_A", at: [0, 0, 0.3] },
  ],
};
