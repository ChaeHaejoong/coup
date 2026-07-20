import type { Gamer } from "./types";

export function getGamerById(gamers: Gamer[], targetId: number): Gamer {
  const foundGamer = gamers.find((gamer) => gamer.id === targetId);

  if (!foundGamer) throw new Error("can not found player");

  return foundGamer;
}
