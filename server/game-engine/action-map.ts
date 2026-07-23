import {
  assassinateOnSuccess,
  coupOnSuccess,
  exchangeOnSuccess,
  foreignAidOnSuccess,
  incomeOnSuccess,
  stealOnSuccess,
  taxOnSuccess,
} from "./actions";
import type { ActionInfo } from "./action-types";
import { Card, ActionType } from "./types";

export type ActionMap = Record<ActionType, ActionInfo>;

export const actionMap: ActionMap = {
  [ActionType.INCOME]: {
    targetRequired: false,
    onSuccess: incomeOnSuccess,
  },
  [ActionType.FOREIGN_AID]: {
    block: {
      cards: [Card.DUKE],
      scope: "anyone",
    },
    targetRequired: false,
    onSuccess: foreignAidOnSuccess,
  },
  [ActionType.COUP]: {
    cost: 7,
    isForcedAction: true,
    targetRequired: true,
    onSuccess: coupOnSuccess,
  },
  [ActionType.TAX]: {
    claimedCard: Card.DUKE,
    targetRequired: false,
    onSuccess: taxOnSuccess,
  },
  [ActionType.STEAL]: {
    claimedCard: Card.CAPTAIN,
    block: {
      cards: [Card.AMBASSADOR, Card.CAPTAIN],
      scope: "target",
    },
    targetRequired: true,
    onSuccess: stealOnSuccess,
  },
  [ActionType.CHANGE]: {
    claimedCard: Card.AMBASSADOR,
    targetRequired: false,
    onSuccess: exchangeOnSuccess,
  },
  [ActionType.ASSASSINATE]: {
    claimedCard: Card.ASSASSIN,
    block: {
      cards: [Card.CONTESSA],
      scope: "target",
    },
    cost: 3,
    targetRequired: true,
    onSuccess: assassinateOnSuccess,
  },
};
