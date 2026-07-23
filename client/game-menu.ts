import {
  ActionType,
  Card,
  DecisionType,
  Phase,
} from "../server/game-engine/types";
import type { GameCommand, GameView } from "../shared/game-contract";

export type MenuItem = {
  labelKey: string;
  command: GameCommand;
};

export function buildGameMenu(view: GameView): MenuItem[] {
  if (view.winnerId) {
    return [];
  }

  if (view.phase === Phase.IDLE && view.turnPlayerId === view.selfPlayerId) {
    return buildActionMenu(view);
  }

  if (
    view.phase === Phase.AWAIT_CHALLENGE &&
    view.pendingAction?.actorId !== view.selfPlayerId
  ) {
    return [
      { labelKey: "challenge", command: { type: "CHALLENGE" } },
      { labelKey: "pass", command: { type: "PASS_CHALLENGE" } },
    ];
  }

  if (view.phase === Phase.AWAIT_BLOCK) {
    return buildBlockMenu(view);
  }

  if (
    view.phase === Phase.AWAIT_BLOCK_CHALLENGE &&
    view.pendingBlock?.blockerId !== view.selfPlayerId
  ) {
    return [
      { labelKey: "challengeBlock", command: { type: "CHALLENGE_BLOCK" } },
      { labelKey: "pass", command: { type: "PASS_BLOCK_CHALLENGE" } },
    ];
  }

  if (
    view.phase === Phase.AWAIT_DECISION &&
    view.pendingDecision?.playerId === view.selfPlayerId
  ) {
    return buildDecisionMenu(view);
  }

  return [];
}

function buildActionMenu(view: GameView): MenuItem[] {
  const targets = view.players.filter(
    (player) => player.id !== view.selfPlayerId && player.isAlive,
  );
  const menu: MenuItem[] = [
    {
      labelKey: "action.income",
      command: { type: "ACT", actionType: ActionType.INCOME },
    },
    {
      labelKey: "action.foreignAid",
      command: { type: "ACT", actionType: ActionType.FOREIGN_AID },
    },
    {
      labelKey: "action.tax",
      command: { type: "ACT", actionType: ActionType.TAX },
    },
    {
      labelKey: "action.exchange",
      command: { type: "ACT", actionType: ActionType.EXCHANGE },
    },
  ];

  for (const target of targets) {
    menu.push(
      {
        labelKey: `action.coup:${target.name}`,
        command: {
          type: "ACT",
          actionType: ActionType.COUP,
          targetId: target.id,
        },
      },
      {
        labelKey: `action.steal:${target.name}`,
        command: {
          type: "ACT",
          actionType: ActionType.STEAL,
          targetId: target.id,
        },
      },
      {
        labelKey: `action.assassinate:${target.name}`,
        command: {
          type: "ACT",
          actionType: ActionType.ASSASSINATE,
          targetId: target.id,
        },
      },
    );
  }

  return menu;
}

function buildBlockMenu(view: GameView): MenuItem[] {
  const action = view.pendingAction;
  if (!action || action.actorId === view.selfPlayerId) {
    return [];
  }

  if (
    action.type !== ActionType.FOREIGN_AID &&
    action.targetId !== view.selfPlayerId
  ) {
    return [];
  }

  if (action.type === ActionType.FOREIGN_AID) {
    return [
      { labelKey: "block.duke", command: { type: "BLOCK", card: Card.DUKE } },
      { labelKey: "pass", command: { type: "PASS_BLOCK" } },
    ];
  }
  if (action.type === ActionType.STEAL) {
    return [
      {
        labelKey: "block.ambassador",
        command: { type: "BLOCK", card: Card.AMBASSADOR },
      },
      {
        labelKey: "block.captain",
        command: { type: "BLOCK", card: Card.CAPTAIN },
      },
      { labelKey: "pass", command: { type: "PASS_BLOCK" } },
    ];
  }
  if (action.type === ActionType.ASSASSINATE) {
    return [
      {
        labelKey: "block.contessa",
        command: { type: "BLOCK", card: Card.CONTESSA },
      },
      { labelKey: "pass", command: { type: "PASS_BLOCK" } },
    ];
  }

  return [];
}

function buildDecisionMenu(view: GameView): MenuItem[] {
  if (view.pendingDecision?.type === DecisionType.LOSE_CARD) {
    return (
      view.private?.cards.map((_, index) => ({
        labelKey: `choose.selfCard:${index}`,
        command: { type: "CHOOSE_CARD", cardIndexes: [index] },
      })) ?? []
    );
  }

  const cards = view.private?.decisionCards ?? [];
  const keepCount = view.private?.cards.length ?? 0;
  if (view.pendingDecision?.type !== DecisionType.EXCHANGE || keepCount === 0) {
    return [];
  }

  return combinations(cards.length, keepCount).map((cardIndexes) => ({
    labelKey: `choose.exchange:${cardIndexes.join(",")}`,
    command: { type: "CHOOSE_CARD", cardIndexes },
  }));
}

function combinations(length: number, count: number): number[][] {
  const result: number[][] = [];

  function visit(start: number, selected: number[]): void {
    if (selected.length === count) {
      result.push([...selected]);
      return;
    }

    for (let index = start; index < length; index += 1) {
      selected.push(index);
      visit(index + 1, selected);
      selected.pop();
    }
  }

  visit(0, []);
  return result;
}
