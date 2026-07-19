import {
  Card,
  ActionType,
  type GameState,
  type Player,
  Phase,
  DecisionType,
} from "./types.js";

export type ActionInfo = {
  blockableCard: Card[];
  blockerScope: "anyone" | "target" | "none";
  claimedCard: Card | null;
  isTargetRequired: boolean;
  onSuccess: (state: GameState, targetId?: number) => void;
};
export type ActionMap = Record<ActionType, ActionInfo>;

export const actionMap: ActionMap = {
  [ActionType.INCOME]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: null,
    isTargetRequired: false,
    onSuccess: (state) => {
      state.turnPlayer.coin += 1;
    },
  },
  [ActionType.FOREIGN_AID]: {
    blockableCard: [Card.DUKE],
    blockerScope: "anyone",
    claimedCard: null,
    isTargetRequired: false,
    onSuccess: (state) => {
      state.turnPlayer.coin += 2;
    },
  },
  [ActionType.COUP]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: null,
    isTargetRequired: true,
    onSuccess: (state, targetId) => {
      state.turnPlayer.coin -= 7;
      state.phase = Phase.AWAIT_DECISION;

      if (!targetId) throw new Error("need targetId");

      state.pendingDecision = {
        type: DecisionType.LOSE_CARD,
        playerId: targetId,
      };
    },
  },
  [ActionType.TAX]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: Card.DUKE,
    isTargetRequired: false,
  },
  [ActionType.STEAL]: {
    blockableCard: [Card.AMBASSADOR, Card.CAPTAIN],
    blockerScope: "target",
    claimedCard: Card.CAPTAIN,
    isTargetRequired: true,
  },
  [ActionType.CHANGE]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: Card.AMBASSADOR,
    isTargetRequired: false,
  },
  [ActionType.ASSASSINATE]: {
    blockableCard: [Card.CONTESSA],
    blockerScope: "target",
    claimedCard: Card.ASSASSIN,
    isTargetRequired: true,
  },
};
