import { describe, expect, test } from "vitest";

import { ActionType, Phase } from "../server/game-engine/types";
import type { GameView } from "../shared/game-contract";
import { buildGameMenu } from "./game-menu";

const baseView: GameView = {
  roomId: 0,
  selfPlayerId: 1,
  phase: Phase.IDLE,
  turnPlayerId: 1,
  players: [
    { id: 1, name: "me", coin: 2, isAlive: true, influenceCount: 2 },
    { id: 2, name: "you", coin: 2, isAlive: true, influenceCount: 2 },
  ],
  private: { playerId: 1, cards: [] },
  pendingAction: null,
  pendingBlock: null,
  pendingDecision: null,
  events: [],
  winnerId: null,
};

describe("buildGameMenu", () => {
  test("shows actions on my idle turn", () => {
    const menu = buildGameMenu(baseView);

    expect(
      menu.some(
        (item) =>
          item.command.type === "ACT" &&
          item.command.actionType === ActionType.INCOME,
      ),
    ).toBe(true);
    expect(
      menu.some(
        (item) =>
          item.command.type === "ACT" &&
          item.command.actionType === ActionType.COUP,
      ),
    ).toBe(true);
  });

  test("shows no action menu when it is not my turn", () => {
    const menu = buildGameMenu({ ...baseView, selfPlayerId: 2 });

    expect(menu).toEqual([]);
  });
});
