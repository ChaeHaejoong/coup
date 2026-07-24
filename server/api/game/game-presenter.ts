import type { GameEventView, GameView } from "../../../shared/game-contract";
import {
  DecisionType,
  type Action,
  type GameState,
  type PendingBlock,
} from "../../game-engine/types";

export function presentGameView(
  roomId: number,
  selfPlayerId: number,
  state: GameState,
  debug: boolean,
  turnTimer: GameView["turnTimer"],
): GameView {
  const self = state.gamers.find((gamer) => gamer.id === selfPlayerId) ?? null;
  const playerNameById = new Map(
    state.gamers.map((gamer) => [gamer.id, gamer.name]),
  );

  return {
    roomId,
    selfPlayerId,
    selfPlayerName: self?.name ?? getPlayerName(playerNameById, selfPlayerId),
    phase: state.phase,
    turnPlayerId: state.turnGamer.id || null,
    turnPlayerName: state.turnGamer.name || null,
    turnTimer,
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
          ...(state.pendingDecision?.type === DecisionType.EXCHANGE &&
          state.pendingDecision.playerId === self.id &&
          state.pendingDecision.cards
            ? { decisionCards: state.pendingDecision.cards }
            : {}),
        }
      : null,
    pendingAction: state.pendingAction
      ? presentPendingAction(state.pendingAction, playerNameById)
      : null,
    pendingBlock: state.pendingBlock
      ? presentPendingBlock(state.pendingBlock, playerNameById)
      : null,
    pendingDecision: state.pendingDecision
      ? {
          type: state.pendingDecision.type,
          playerId: state.pendingDecision.playerId,
          playerName: getPlayerName(
            playerNameById,
            state.pendingDecision.playerId,
          ),
          ...(state.pendingDecision.cards
            ? { cardCount: state.pendingDecision.cards.length }
            : {}),
        }
      : null,
    events: state.events.map((event) =>
      presentGameEvent(event, playerNameById),
    ),
    winnerId: state.winner?.id ?? null,
    winnerName: state.winner?.name ?? null,
  };
}

function presentPendingAction(
  action: Action,
  playerNameById: Map<number, string>,
): GameView["pendingAction"] {
  return {
    ...action,
    actorName: getPlayerName(playerNameById, action.actorId),
    ...(action.targetId
      ? { targetName: getPlayerName(playerNameById, action.targetId) }
      : {}),
  };
}

function presentPendingBlock(
  block: PendingBlock,
  playerNameById: Map<number, string>,
): GameView["pendingBlock"] {
  return {
    ...block,
    blockerName: getPlayerName(playerNameById, block.blockerId),
  };
}

function presentGameEvent(
  event: GameState["events"][number],
  playerNameById: Map<number, string>,
): GameEventView {
  if (event.type === "TURN_STARTED") {
    return {
      ...event,
      playerName: getPlayerName(playerNameById, event.playerId),
    };
  }
  if (event.type === "ACTION_DECLARED") {
    return {
      ...event,
      actorName: getPlayerName(playerNameById, event.actorId),
      ...(event.targetId
        ? { targetName: getPlayerName(playerNameById, event.targetId) }
        : {}),
    };
  }
  if (event.type === "ACTION_BLOCKED") {
    return {
      ...event,
      blockerName: getPlayerName(playerNameById, event.blockerId),
    };
  }
  if (event.type === "INFLUENCE_LOST") {
    return {
      ...event,
      playerName: getPlayerName(playerNameById, event.playerId),
    };
  }
  if (event.type === "GAME_FINISHED") {
    return {
      ...event,
      winnerName: getPlayerName(playerNameById, event.winnerId),
    };
  }
  return event;
}

function getPlayerName(
  playerNameById: Map<number, string>,
  playerId: number,
): string {
  return playerNameById.get(playerId) ?? `${playerId}번 플레이어`;
}
