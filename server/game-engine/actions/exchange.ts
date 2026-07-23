import { DecisionAfter, DecisionType } from "../types";
import type { ActionContext, ActionHandlerResult } from "../action-types";

export function exchangeOnSuccess({
  state,
  drawCard,
}: ActionContext): ActionHandlerResult {
  return {
    pendingDecision: {
      type: DecisionType.EXCHANGE,
      playerId: state.turnGamer.id,
      cards: [...state.turnGamer.deck, drawCard(), drawCard()],
      after: DecisionAfter.END_TURN,
    },
  };
}
