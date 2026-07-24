import { describe, expect, test } from "vitest";

import {
  ActionType,
  Card,
  Phase,
  type GameState,
} from "../../game-engine/types";
import { presentGameView } from "./game-presenter";

const state: GameState = {
  events: [
    { type: "TURN_STARTED", playerId: 1 },
    {
      type: "ACTION_DECLARED",
      actorId: 1,
      actionType: ActionType.STEAL,
      targetId: 2,
    },
  ],
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
    const view = presentGameView(0, 1, state, false, null);

    expect(view.private?.cards).toEqual([Card.DUKE, Card.CAPTAIN]);
    expect(view.players[0]?.cards).toBeUndefined();
    expect(view.players[1]?.cards).toBeUndefined();
  });

  test("shows all cards in debug mode", () => {
    const view = presentGameView(0, 1, state, true, null);

    expect(view.players[0]?.cards).toEqual([Card.DUKE, Card.CAPTAIN]);
    expect(view.players[1]?.cards).toEqual([Card.ASSASSIN]);
  });

  test("adds player names to id-based game events", () => {
    const view = presentGameView(0, 1, state, false, null);

    expect(view.turnPlayerName).toBe("해중");

    expect(view.events).toEqual([
      { type: "TURN_STARTED", playerId: 1, playerName: "해중" },
      {
        type: "ACTION_DECLARED",
        actorId: 1,
        actorName: "해중",
        actionType: ActionType.STEAL,
        targetId: 2,
        targetName: "성준",
      },
    ]);
  });

  test("includes turn timer metadata when provided", () => {
    const turnTimer = { deadlineAt: 1_000, durationMs: 10_000 };

    const view = presentGameView(0, 1, state, false, turnTimer);

    expect(view.turnTimer).toEqual(turnTimer);
  });
});
