import { beforeEach, describe, expect, test } from "vitest";

import Game from "../index";
import { mutateGameForTest } from "../test-utils";
import { ActionType, Card, Phase, type Player } from "../types";

const players: Player[] = ["해중", "성준", "현서", "기일"].map(
  (name, index) => ({
    id: index + 1,
    name,
  }),
);

let game: Game;

beforeEach(() => {
  game = new Game(players);
  game.start();
});

describe("게임 세팅, 턴 로직", () => {
  test("records structured events for game start and turn start", () => {
    const state = game.getState();

    expect(state.events).toEqual([
      { type: "GAME_STARTED", playerCount: 4 },
      { type: "TURN_STARTED", playerId: 1 },
    ]);
  });

  test("getState returns a snapshot that cannot mutate the running game", () => {
    const snapshot = game.getState();
    snapshot.gamers[0]!.coin = 99;

    expect(game.getState().gamers[0]!.coin).toBe(2);
  });

  test("카드 두장, 코인 두개, 첫번쨰 플레이어 설정이 잘 되는지?", () => {
    const state = game.getState();

    expect(state.phase).toBe(Phase.IDLE);
    expect(state.turnGamer.id).toBe(1);
    expect(state.gamers).toHaveLength(4);
    expect(state.gamers.every((gamer) => gamer.coin === 2)).toBe(true);
    expect(state.gamers.every((gamer) => gamer.deck.length === 2)).toBe(true);
    expect(state.winner).toBeNull();
  });

  test("rejects games with fewer than two players", () => {
    const shortGame = new Game([{ id: 1, name: "solo" }]);

    expect(() => shortGame.start()).toThrow("need 2-6 players");
  });

  test("rejects games with more than six players", () => {
    const manyPlayers = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      name: `p${index + 1}`,
    }));
    const largeGame = new Game(manyPlayers);

    expect(() => largeGame.start()).toThrow("need 2-6 players");
  });

  test("죽은 사람을 스킵하고 다음 턴으로 넘어가는지?", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[1]!.deck = [];
      state.gamers[1]!.isAlive = false;
    });

    game.nextTurn();

    expect(game.getState().turnGamer.id).toBe(3);
  });
});

describe("액션", () => {
  test("income resolves immediately and advances the turn", () => {
    game.act({ type: ActionType.INCOME, actorId: 1 });

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(3);
    expect(state.turnGamer.id).toBe(2);
    expect(state.phase).toBe(Phase.IDLE);
  });

  test("tax can be challenged or passed, then gives three coins", () => {
    game.act({ type: ActionType.TAX, actorId: 1 });

    expect(game.getState().phase).toBe(Phase.AWAIT_CHALLENGE);

    game.passChallenge(2);
    game.passChallenge(3);
    game.passChallenge(4);

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(5);
    expect(state.turnGamer.id).toBe(2);
  });

  test("foreign aid can be blocked by duke", () => {
    game.act({ type: ActionType.FOREIGN_AID, actorId: 1 });

    expect(game.getState().phase).toBe(Phase.AWAIT_BLOCK);

    game.block(2, Card.DUKE);
    game.passBlockChallenge(1);
    game.passBlockChallenge(3);
    game.passBlockChallenge(4);

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(2);
    expect(state.turnGamer.id).toBe(2);
  });

  test("blocked assassinate keeps the declaration cost paid", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[0]!.coin = 3;
    });

    game.act({ type: ActionType.ASSASSINATE, actorId: 1, targetId: 2 });
    game.passChallenge(2);
    game.passChallenge(3);
    game.passChallenge(4);
    game.block(2, Card.CONTESSA);
    game.passBlockChallenge(1);

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(0);
    expect(state.gamers[1]?.deck).toHaveLength(2);
    expect(state.turnGamer.id).toBe(2);
  });

  test("steal takes up to two coins from the target", () => {
    game.act({ type: ActionType.STEAL, actorId: 1, targetId: 2 });
    game.passChallenge(2);
    game.passChallenge(3);
    game.passChallenge(4);
    game.passBlock(2);

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(4);
    expect(state.gamers[1]?.coin).toBe(0);
    expect(state.turnGamer.id).toBe(2);
  });

  test("coup forces the target to lose influence", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[0]!.coin = 7;
    });

    game.act({ type: ActionType.COUP, actorId: 1, targetId: 2 });

    expect(game.getState().phase).toBe(Phase.AWAIT_DECISION);

    game.chooseCard(2, [0]);

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(0);
    expect(state.gamers[1]?.deck).toHaveLength(1);
    expect(state.turnGamer.id).toBe(2);
  });
});

describe("validation", () => {
  test("rejects actions from players who do not have the turn", () => {
    expect(() => game.act({ type: ActionType.INCOME, actorId: 2 })).toThrow(
      "not this player's turn",
    );
  });

  test("forces coup when the turn player has ten or more coins", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[0]!.coin = 10;
    });

    expect(() => game.act({ type: ActionType.INCOME, actorId: 1 })).toThrow(
      "must coup",
    );
  });

  test("rejects missing or dead targets", () => {
    expect(() => game.act({ type: ActionType.STEAL, actorId: 1 })).toThrow(
      "target is required",
    );
  });
});

describe("challenge resolution", () => {
  test("successful challenge cancels the action and makes the claimant lose influence", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[0]!.deck = [Card.CONTESSA, Card.CAPTAIN];
    });

    game.act({ type: ActionType.TAX, actorId: 1 });
    game.challenge(2);
    game.chooseCard(1, [0]);

    const state = game.getState();
    expect(state.gamers[0]?.deck).toHaveLength(1);
    expect(state.gamers[0]?.coin).toBe(2);
    expect(state.turnGamer.id).toBe(2);
  });

  test("failed challenge makes challenger lose influence and action continues", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[0]!.deck = [Card.DUKE, Card.CAPTAIN];
    });

    game.act({ type: ActionType.TAX, actorId: 1 });
    game.challenge(2);
    game.chooseCard(2, [0]);

    const state = game.getState();
    expect(state.gamers[0]?.deck).toHaveLength(2);
    expect(state.gamers[0]?.coin).toBe(5);
    expect(state.gamers[1]?.deck).toHaveLength(1);
    expect(state.turnGamer.id).toBe(2);
  });
});

describe("block challenge resolution", () => {
  test("successful block challenge makes blocker lose influence and action succeeds", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[1]!.deck = [Card.CAPTAIN, Card.ASSASSIN];
    });

    game.act({ type: ActionType.FOREIGN_AID, actorId: 1 });
    game.block(2, Card.DUKE);
    game.challengeBlock(1);
    game.chooseCard(2, [0]);

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(4);
    expect(state.gamers[1]?.deck).toHaveLength(1);
    expect(state.turnGamer.id).toBe(2);
  });

  test("failed block challenge makes challenger lose influence and action stays blocked", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[1]!.deck = [Card.DUKE, Card.ASSASSIN];
    });

    game.act({ type: ActionType.FOREIGN_AID, actorId: 1 });
    game.block(2, Card.DUKE);
    game.challengeBlock(1);
    game.chooseCard(1, [0]);

    const state = game.getState();
    expect(state.gamers[0]?.coin).toBe(2);
    expect(state.gamers[0]?.deck).toHaveLength(1);
    expect(state.gamers[1]?.deck).toHaveLength(2);
    expect(state.turnGamer.id).toBe(2);
  });
});

describe("decisions and winner", () => {
  test("exchange draws two cards and lets the actor keep two", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[0]!.deck = [Card.AMBASSADOR, Card.DUKE];
    });

    game.act({ type: ActionType.EXCHANGE, actorId: 1 });
    game.passChallenge(2);
    game.passChallenge(3);
    game.passChallenge(4);

    const decision = game.getState().pendingDecision;
    expect(decision?.type).toBe("EXCHANGE");
    expect(decision?.cards).toHaveLength(4);

    game.chooseCard(1, [0, 1]);

    const state = game.getState();
    expect(state.gamers[0]?.deck).toHaveLength(2);
    expect(state.turnGamer.id).toBe(2);
  });

  test("sets winner when only one player remains alive", () => {
    mutateGameForTest(game, (state) => {
      state.gamers[1]!.isAlive = false;
      state.gamers[1]!.deck = [];
      state.gamers[2]!.isAlive = false;
      state.gamers[2]!.deck = [];
      state.gamers[3]!.isAlive = false;
      state.gamers[3]!.deck = [];
    });

    game.nextTurn();

    expect(game.getState().phase).toBe(Phase.FINISHED);
    expect(game.getState().winner?.id).toBe(1);
  });
});
