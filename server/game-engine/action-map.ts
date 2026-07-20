import {
  changeOnSuccess,
  coupOnSuccess,
  foreignAidOnSuccess,
  incomeOnSuccess,
  assassinateOnSuccess,
  stealOnSuccess,
  taxOnSuccess,
} from "./actions.js";
import {
  Card,
  ActionType,
  type GameState,
} from "./types.js";

export type ActionInfo = {
  blockableCard: Card[];
  blockerScope: "anyone" | "target" | "none";
  claimedCard: Card | null;
  isTargetRequired: boolean;
  onSuccess: (state: GameState) => void;
};
export type ActionMap = Record<ActionType, ActionInfo>;

export const actionMap: ActionMap = {
  [ActionType.INCOME]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: null,
    isTargetRequired: false,
    onSuccess: incomeOnSuccess
  },
  [ActionType.FOREIGN_AID]: {
    blockableCard: [Card.DUKE],
    blockerScope: "anyone",
    claimedCard: null,
    isTargetRequired: false,
    onSuccess: foreignAidOnSuccess
  },
  [ActionType.COUP]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: null,
    isTargetRequired: true,
    onSuccess: coupOnSuccess
  },
  [ActionType.TAX]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: Card.DUKE,
    isTargetRequired: false,
    onSuccess: taxOnSuccess
  },
  [ActionType.STEAL]: {
    blockableCard: [Card.AMBASSADOR, Card.CAPTAIN],
    blockerScope: "target",
    claimedCard: Card.CAPTAIN,
    isTargetRequired: true,
    onSuccess: stealOnSuccess
  },
  [ActionType.CHANGE]: {
    blockableCard: [],
    blockerScope: "none",
    claimedCard: Card.AMBASSADOR,
    isTargetRequired: false,
    onSuccess: changeOnSuccess
  },
  [ActionType.ASSASSINATE]: {
    blockableCard: [Card.CONTESSA],
    blockerScope: "target",
    claimedCard: Card.ASSASSIN,
    isTargetRequired: true,
    onSuccess: assassinateOnSuccess
  },
};
