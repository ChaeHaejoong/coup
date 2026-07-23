import Game from "./index";
import type { GameState } from "./types";

export function mutateGameForTest(
  game: Game,
  mutator: (state: GameState) => void,
): void {
  const unsafeGame = game as unknown as { gameState: GameState };
  mutator(unsafeGame.gameState);
}
