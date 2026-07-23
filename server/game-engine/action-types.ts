import type { Action, Card, GameState, Gamer, PendingDecision } from "./types";

export type BlockerScope = "anyone" | "target";

export type BlockInfo = {
  cards: Card[];
  scope: BlockerScope;
};

export type ActionContext = {
  state: GameState;
  action: Action;
  getGamer: (playerId: number) => Gamer;
  drawCard: () => Card;
  putBackCard: (card: Card) => void;
  putBackCards: (cards: Card[]) => void;
};

export type ActionHandlerResult = {
  pendingDecision: PendingDecision;
};

export type ActionHandler = (
  context: ActionContext,
) => ActionHandlerResult | void;

export type ActionInfo = {
  block?: BlockInfo;
  claimedCard?: Card;
  cost?: number;
  isForcedAction?: boolean;
  targetRequired: boolean;
  onDeclare?: ActionHandler;
  onSuccess: ActionHandler;
  onBlocked?: ActionHandler;
};
