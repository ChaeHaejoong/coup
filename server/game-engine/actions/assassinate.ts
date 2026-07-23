import { DecisionAfter, DecisionType } from "../types";
import type { ActionContext, ActionHandlerResult } from "../action-types";

export function assassinateOnSuccess({
  action,
}: ActionContext): ActionHandlerResult {
  const targetId = action.targetId;

  if (!targetId) throw new Error("no targetId");

  return {
    pendingDecision: {
      type: DecisionType.LOSE_CARD,
      playerId: targetId,
      after: DecisionAfter.END_TURN,
    },
  };
}
