import type { ActionContext } from "../action-types";

export function stealOnSuccess({
  state,
  action,
  getGamer,
}: ActionContext): void {
  const targetId = action.targetId;

  if (!targetId) throw new Error("no targetId");

  const targetPlayer = getGamer(targetId);
  const stolenCoin = targetPlayer.coin >= 2 ? 2 : targetPlayer.coin;

  targetPlayer.coin -= stolenCoin;
  state.turnGamer.coin += stolenCoin;
}
