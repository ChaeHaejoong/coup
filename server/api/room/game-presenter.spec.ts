import { describe, expect, test } from "vitest";

import { Card, Phase, type GameState } from "../../game-engine/types";
import { presentGameView } from "./game-presenter";

const state: GameState = {
  events: [],
  gamers: [
    {
      id: 1,
      name: "해중",
      coin: 2,
      deck: [Card.DUKE, Card.CAPTAIN],
      isAlive: true,
    },
    {
      id: 2,
      name: "성준",
      coin: 3,
      deck: [Card.ASSASSIN],
      isAlive: true,
    },
  ],
  turnGamer: {
    id: 1,
    name: "해중",
    coin: 2,
    deck: [Card.DUKE, Card.CAPTAIN],
    isAlive: true,
  },
  phase: Phase.IDLE,
  pendingAction: null,
  pendingBlock: null,
  pendingDecision: null,
  challengePasses: [],
  blockPasses: [],
  blockChallengePasses: [],
  winner: null,
};

describe("presentGameView", () => {
  test("shows only self cards in normal mode", () => {
    const view = presentGameView(0, 1, state, false);

    expect(view.private?.cards).toEqual([Card.DUKE, Card.CAPTAIN]);
    expect(view.players[0]?.cards).toBeUndefined();
    expect(view.players[1]?.cards).toBeUndefined();
  });

  test("shows all cards in debug mode", () => {
    const view = presentGameView(0, 1, state, true);

    expect(view.players[0]?.cards).toEqual([Card.DUKE, Card.CAPTAIN]);
    expect(view.players[1]?.cards).toEqual([Card.ASSASSIN]);
  });
});
