import { Injectable } from "@nestjs/common";

import {
  GameCommandType,
  GameErrorCode,
  type GameCommand,
  type GameView,
} from "../../../shared/game-contract";
import { PlayerRole } from "../../../shared/room-contract";
import Game from "../../game-engine";
import { ActionType, Phase, type Gamer } from "../../game-engine/types";
import { RoomService } from "../room/room.service";
import { presentGameView } from "./game-presenter";

type StoredGameSession = {
  roomId: number;
  game: Game;
  timer: NodeJS.Timeout | null;
};

export type PlayerGameView = {
  socketId: string;
  playerId: number;
  view: GameView;
};

type GameUpdateListener = (roomId: number, views: PlayerGameView[]) => void;

@Injectable()
export class GameSessionService {
  private sessions = new Map<number, StoredGameSession>();
  private gameUpdateListener: GameUpdateListener | null = null;

  constructor(private readonly roomService: RoomService) {}

  setGameUpdateListener(listener: GameUpdateListener): void {
    this.gameUpdateListener = listener;
  }

  startGame(roomId: number, playerId: number): PlayerGameView[] {
    const room = this.roomService.getRoom(roomId);
    const player = room.players.find((roomPlayer) => roomPlayer.id === playerId);
    if (!player) {
      throw new Error(GameErrorCode.NOT_ROOM_MEMBER);
    }
    if (player.role !== PlayerRole.HOST) {
      throw new Error(GameErrorCode.NOT_HOST);
    }
    if (this.sessions.has(roomId)) {
      throw new Error(GameErrorCode.GAME_ALREADY_STARTED);
    }
    if (room.players.length < 2 || room.players.length > 6) {
      throw new Error(GameErrorCode.INVALID_PLAYER_COUNT);
    }

    const game = new Game(
      room.players.map((roomPlayer) => ({
        id: roomPlayer.id,
        name: roomPlayer.name,
      })),
    );
    game.start();

    const session: StoredGameSession = { roomId, game, timer: null };
    this.sessions.set(roomId, session);
    this.scheduleTimer(session);

    return this.getGameViewsForSession(session);
  }

  submitGameCommand(
    roomId: number,
    playerId: number,
    command: GameCommand,
  ): PlayerGameView[] {
    const session = this.getSessionOrThrow(roomId);
    this.assertRoomMember(roomId, playerId);

    switch (command.type) {
      case GameCommandType.ACT:
        session.game.act({
          type: command.actionType,
          actorId: playerId,
          ...(command.targetId ? { targetId: command.targetId } : {}),
        });
        break;
      case GameCommandType.PASS_CHALLENGE:
        session.game.passChallenge(playerId);
        break;
      case GameCommandType.CHALLENGE:
        session.game.challenge(playerId);
        break;
      case GameCommandType.PASS_BLOCK:
        session.game.passBlock(playerId);
        break;
      case GameCommandType.BLOCK:
        session.game.block(playerId, command.card);
        break;
      case GameCommandType.PASS_BLOCK_CHALLENGE:
        session.game.passBlockChallenge(playerId);
        break;
      case GameCommandType.CHALLENGE_BLOCK:
        session.game.challengeBlock(playerId);
        break;
      case GameCommandType.CHOOSE_CARD:
        session.game.chooseCard(playerId, command.cardIndexes);
        break;
    }

    this.scheduleTimer(session);
    return this.getGameViewsForSession(session);
  }

  getGameViews(roomId: number): PlayerGameView[] {
    return this.getGameViewsForSession(this.getSessionOrThrow(roomId));
  }

  private getSessionOrThrow(roomId: number): StoredGameSession {
    const session = this.sessions.get(roomId);
    if (!session) {
      throw new Error(GameErrorCode.GAME_NOT_STARTED);
    }
    return session;
  }

  private assertRoomMember(roomId: number, playerId: number): void {
    const room = this.roomService.getRoom(roomId);
    if (!room.players.some((player) => player.id === playerId)) {
      throw new Error(GameErrorCode.NOT_ROOM_MEMBER);
    }
  }

  private getGameViewsForSession(session: StoredGameSession): PlayerGameView[] {
    const room = this.roomService.getRoom(session.roomId);
    const state = session.game.getState();
    const debug = process.env.DEBUG_GAME === "true";

    return room.players.map((player) => ({
      socketId: player.socketId,
      playerId: player.id,
      view: presentGameView(session.roomId, player.id, state, debug),
    }));
  }

  private scheduleTimer(session: StoredGameSession): void {
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    const phase = session.game.getState().phase;
    if (
      phase !== Phase.AWAIT_CHALLENGE &&
      phase !== Phase.AWAIT_BLOCK &&
      phase !== Phase.AWAIT_BLOCK_CHALLENGE
    ) {
      return;
    }

    session.timer = setTimeout(() => {
      session.timer = null;
      this.autoPass(session);
      this.scheduleTimer(session);
      this.gameUpdateListener?.(
        session.roomId,
        this.getGameViewsForSession(session),
      );
    }, 10_000);
  }

  private autoPass(session: StoredGameSession): void {
    const state = session.game.getState();

    if (state.phase === Phase.AWAIT_CHALLENGE && state.pendingAction) {
      for (const playerId of this.aliveExcept(
        state.gamers,
        state.pendingAction.actorId,
      )) {
        if (!state.challengePasses.includes(playerId)) {
          session.game.passChallenge(playerId);
        }
      }
      return;
    }

    if (state.phase === Phase.AWAIT_BLOCK && state.pendingAction) {
      for (const playerId of this.blockEligibleIds(state)) {
        if (!state.blockPasses.includes(playerId)) {
          session.game.passBlock(playerId);
        }
      }
      return;
    }

    if (state.phase === Phase.AWAIT_BLOCK_CHALLENGE && state.pendingBlock) {
      for (const playerId of this.aliveExcept(
        state.gamers,
        state.pendingBlock.blockerId,
      )) {
        if (!state.blockChallengePasses.includes(playerId)) {
          session.game.passBlockChallenge(playerId);
        }
      }
    }
  }

  private blockEligibleIds(state: ReturnType<Game["getState"]>): number[] {
    const action = state.pendingAction;
    if (!action) {
      return [];
    }

    if (action.type === ActionType.FOREIGN_AID) {
      return this.aliveExcept(state.gamers, action.actorId);
    }
    if (
      (action.type === ActionType.STEAL ||
        action.type === ActionType.ASSASSINATE) &&
      action.targetId
    ) {
      const target = state.gamers.find((gamer) => gamer.id === action.targetId);
      return target?.isAlive ? [target.id] : [];
    }
    return [];
  }

  private aliveExcept(gamers: Gamer[], excludedId: number): number[] {
    return gamers
      .filter((gamer) => gamer.isAlive && gamer.id !== excludedId)
      .map((gamer) => gamer.id);
  }
}
