import { DecisionType, Phase, type GameState } from "./types.js";

export function incomeOnSuccess(state: GameState): void {
  state.turnPlayer.coin += 1;
}

export function foreignAidOnSuccess(state: GameState): void {
  state.turnPlayer.coin += 2;
}

export function coupOnSuccess(state: GameState, targetId?: number): void {
  state.turnPlayer.coin -= 7;
  state.phase = Phase.AWAIT_DECISION;

  if (!targetId) throw new Error("need targetId");

  state.pendingDecision = {
    type: DecisionType.LOSE_CARD,
    playerId: targetId,
  };
}

export function taxOnSuccess(state: GameState): void {
  state.turnPlayer.coin += 3;
}

export function stealOnSuccess(state: GameState,)
