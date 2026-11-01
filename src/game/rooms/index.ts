import { room1 } from "./room1";
import { room2 } from "./room2";
import { room3 } from "./room3";
import type { RoomDefinition } from "./types";

/** Huoneet pelijärjestyksessä. Uusi huone lisätään tähän listaan. */
export const ROOMS: RoomDefinition[] = [room1, room2, room3];
