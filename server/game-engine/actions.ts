import { DecisionAfter, DecisionType, Phase, type GameState } from "./types";
import { getGamerById } from "./utils";

export function incomeOnSuccess(state: GameState): void {
  state.turnGamer.coin += 1;
}

export function foreignAidOnSuccess(state: GameState): void {
  state.turnGamer.coin += 2;
}

export function coupOnSuccess(state: GameState): void {
  const targetId = state.pendingAction?.targetId;

  if (!targetId) throw new Error("no targetId");
  state.phase = Phase.AWAIT_DECISION;

  state.pendingDecision = {
    type: DecisionType.LOSE_CARD,
    playerId: targetId,
    after: DecisionAfter.END_TURN,
  };
}

export function taxOnSuccess(state: GameState): void {
  state.turnGamer.coin += 3;
}

export function stealOnSuccess(state: GameState) {
  const targetId = state.pendingAction?.targetId;

  if (!targetId) throw new Error("no targetId");

  const targetPlayer = getGamerById(state.gamers, targetId);
  const stolenCoin = targetPlayer.coin >= 2 ? 2 : targetPlayer.coin;

  targetPlayer.coin -= stolenCoin;
  state.turnGamer.coin += stolenCoin;
}

export function changeOnSuccess(state: GameState): void {
  state.phase = Phase.AWAIT_DECISION;
  state.pendingDecision = {
    type: DecisionType.EXCHANGE,
    playerId: state.turnGamer.id,
    cards: [...state.turnGamer.deck],
    after: DecisionAfter.END_TURN,
  };
}

export function assassinateOnSuccess(state: GameState): void {
  const targetId = state.pendingAction?.targetId;

  if (!targetId) throw new Error("no targetId");

  state.phase = Phase.AWAIT_DECISION;
  state.pendingDecision = {
    type: DecisionType.LOSE_CARD,
    playerId: targetId,
    after: DecisionAfter.END_TURN,
  };
}
