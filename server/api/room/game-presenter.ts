import type { GameView } from "../../../shared/game-contract";
import { DecisionType, type GameState } from "../../game-engine/types";

export function presentGameView(
  roomId: number,
  selfPlayerId: number,
  state: GameState,
  debug: boolean,
): GameView {
  const self = state.gamers.find((gamer) => gamer.id === selfPlayerId) ?? null;

  return {
    roomId,
    selfPlayerId,
    phase: state.phase,
    turnPlayerId: state.turnGamer.id || null,
    players: state.gamers.map((gamer) => ({
      id: gamer.id,
      name: gamer.name,
      coin: gamer.coin,
      isAlive: gamer.isAlive,
      influenceCount: gamer.deck.length,
      ...(debug ? { cards: gamer.deck } : {}),
    })),
    private: self
      ? {
          playerId: self.id,
          cards: self.deck,
          ...((state.pendingDecision?.type === DecisionType.EXCHANGE &&
            state.pendingDecision.playerId === self.id &&
            state.pendingDecision.cards)
            ? { decisionCards: state.pendingDecision.cards }
            : {}),
        }
      : null,
    pendingAction: state.pendingAction,
    pendingBlock: state.pendingBlock,
    pendingDecision: state.pendingDecision
      ? {
          type: state.pendingDecision.type,
          playerId: state.pendingDecision.playerId,
          ...(state.pendingDecision.cards
            ? { cardCount: state.pendingDecision.cards.length }
            : {}),
        }
      : null,
    events: state.events,
    winnerId: state.winner?.id ?? null,
  };
}
