import { Injectable, NotFoundException } from "@nestjs/common";

import {
  GameCommandType,
  GameErrorCode,
  type GameCommand,
  type GameView,
} from "../../../shared/game-contract";
import {
  PlayerRole,
  type CreateRoomResponse,
  type JoinRoomRequest,
  type Room,
  type RoomJoinedResponse,
  type RoomPlayer,
} from "../../../shared/room-contract";
import Game from "../../game-engine";
import { ActionType, Phase, type Gamer } from "../../game-engine/types";
import { presentGameView } from "./game-presenter";

type StoredRoom = {
  roomId: number;
  roomName: string;
  players: RoomPlayer[];
  game: Game | null;
  timer: NodeJS.Timeout | null;
};

export type PlayerGameView = {
  socketId: string;
  playerId: number;
  view: GameView;
};

type GameUpdateListener = (roomId: number, views: PlayerGameView[]) => void;

@Injectable()
export class RoomService {
  private rooms = new Map<number, StoredRoom>();
  private gameUpdateListener: GameUpdateListener | null = null;

  setGameUpdateListener(listener: GameUpdateListener): void {
    this.gameUpdateListener = listener;
  }

  getRooms(): Room[] {
    return [...this.rooms.values()].map((room) => this.toRoom(room));
  }

  joinRoom(body: JoinRoomRequest, socketId: string): RoomJoinedResponse {
    const room = this.getRoomOrThrow(body.roomId);
    const joinedPlayer = room.players.find((roomPlayer) => roomPlayer.socketId === socketId);

    if (joinedPlayer) {
      joinedPlayer.name = body.playerName;

      return {
        room: this.toRoom(room),
        playerId: joinedPlayer.id,
        socketId: joinedPlayer.socketId,
      };
    }

    const playerId = this.generatePlayerId(room);
    room.players.push({
      id: playerId,
      socketId,
      name: body.playerName,
      role: room.players.length === 0 ? PlayerRole.HOST : PlayerRole.PLAYER,
    });

    return {
      room: this.toRoom(room),
      playerId,
      socketId,
    };
  }

  leaveRoom(roomId: number, playerId: number): Room {
    const room = this.getRoomOrThrow(roomId);
    room.players = room.players.filter((player) => player.id !== playerId);

    if (room.players.length > 0 && !room.players.some((player) => player.role === PlayerRole.HOST)) {
      room.players[0]!.role = PlayerRole.HOST;
    }

    return this.toRoom(room);
  }

  create(
    roomName: string,
    playerName: string,
    socketId: string,
  ): CreateRoomResponse {
    const roomId = this.generateRoomId();
    const room: StoredRoom = {
      roomId,
      roomName,
      players: [],
      game: null,
      timer: null,
    };
    this.rooms.set(roomId, room);
    const playerId = this.generatePlayerId(room);
    room.players.push({
      id: playerId,
      socketId,
      name: playerName,
      role: PlayerRole.HOST,
    });

    return {
      room: this.toRoom(room),
      playerId,
      socketId,
    };
  }

  removeRoom(roomId: number): void {
    const room = this.rooms.get(roomId);
    if (room?.timer) {
      clearTimeout(room.timer);
    }
    this.rooms.delete(roomId);
  }

  startGame(roomId: number, playerId: number): PlayerGameView[] {
    const room = this.getRoomOrThrow(roomId);
    const player = this.getRoomPlayerOrThrow(room, playerId);
    if (player.role !== PlayerRole.HOST) {
      throw new Error(GameErrorCode.NOT_HOST);
    }
    if (room.game) {
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
    room.game = game;
    this.scheduleTimer(room);

    return this.getGameViewsForRoom(room);
  }

  submitGameCommand(
    roomId: number,
    playerId: number,
    command: GameCommand,
  ): PlayerGameView[] {
    const room = this.getRoomOrThrow(roomId);
    const game = this.getGameOrThrow(room);
    this.getRoomPlayerOrThrow(room, playerId);

    switch (command.type) {
      case GameCommandType.ACT:
        game.act({
          type: command.actionType,
          actorId: playerId,
          ...(command.targetId ? { targetId: command.targetId } : {}),
        });
        break;
      case GameCommandType.PASS_CHALLENGE:
        game.passChallenge(playerId);
        break;
      case GameCommandType.CHALLENGE:
        game.challenge(playerId);
        break;
      case GameCommandType.PASS_BLOCK:
        game.passBlock(playerId);
        break;
      case GameCommandType.BLOCK:
        game.block(playerId, command.card);
        break;
      case GameCommandType.PASS_BLOCK_CHALLENGE:
        game.passBlockChallenge(playerId);
        break;
      case GameCommandType.CHALLENGE_BLOCK:
        game.challengeBlock(playerId);
        break;
      case GameCommandType.CHOOSE_CARD:
        game.chooseCard(playerId, command.cardIndexes);
        break;
    }

    this.scheduleTimer(room);
    return this.getGameViewsForRoom(room);
  }

  getGameViews(roomId: number): PlayerGameView[] {
    const room = this.getRoomOrThrow(roomId);
    this.getGameOrThrow(room);
    return this.getGameViewsForRoom(room);
  }

  private getRoomOrThrow(roomId: number): StoredRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`room ${roomId} does not exist`);
    }

    return room;
  }

  private getGameOrThrow(room: StoredRoom): Game {
    if (!room.game) {
      throw new Error(GameErrorCode.GAME_NOT_STARTED);
    }
    return room.game;
  }

  private getRoomPlayerOrThrow(
    room: StoredRoom,
    playerId: number,
  ): RoomPlayer {
    const player = room.players.find((roomPlayer) => roomPlayer.id === playerId);
    if (!player) {
      throw new Error(GameErrorCode.NOT_ROOM_MEMBER);
    }
    return player;
  }

  private getGameViewsForRoom(room: StoredRoom): PlayerGameView[] {
    const game = this.getGameOrThrow(room);
    const state = game.getState();
    const debug = process.env.DEBUG_GAME === "true";

    return room.players.map((player) => ({
      socketId: player.socketId,
      playerId: player.id,
      view: presentGameView(room.roomId, player.id, state, debug),
    }));
  }

  private scheduleTimer(room: StoredRoom): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (!room.game) {
      return;
    }

    const phase = room.game.getState().phase;
    if (
      phase !== Phase.AWAIT_CHALLENGE &&
      phase !== Phase.AWAIT_BLOCK &&
      phase !== Phase.AWAIT_BLOCK_CHALLENGE
    ) {
      return;
    }

    room.timer = setTimeout(() => {
      room.timer = null;
      this.autoPass(room);
      this.scheduleTimer(room);
      this.gameUpdateListener?.(room.roomId, this.getGameViewsForRoom(room));
    }, 10_000);
  }

  private autoPass(room: StoredRoom): void {
    const game = this.getGameOrThrow(room);
    const state = game.getState();

    if (state.phase === Phase.AWAIT_CHALLENGE && state.pendingAction) {
      for (const playerId of this.aliveExcept(
        state.gamers,
        state.pendingAction.actorId,
      )) {
        if (!state.challengePasses.includes(playerId)) {
          game.passChallenge(playerId);
        }
      }
      return;
    }

    if (state.phase === Phase.AWAIT_BLOCK && state.pendingAction) {
      for (const playerId of this.blockEligibleIds(state)) {
        if (!state.blockPasses.includes(playerId)) {
          game.passBlock(playerId);
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
          game.passBlockChallenge(playerId);
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

  private generateRoomId(): number {
    let roomId = 0;
    while (this.rooms.has(roomId)) {
      roomId += 1;
    }

    return roomId;
  }

  private generatePlayerId(room: StoredRoom): number {
    let playerId = 1;
    while (room.players.some((player) => player.id === playerId)) {
      playerId += 1;
    }

    return playerId;
  }

  private toRoom(room: StoredRoom): Room {
    return {
      roomId: room.roomId,
      roomName: room.roomName,
      players: room.players.map(({ id, socketId, name, role }) => ({ id, socketId, name, role })),
    };
  }
}
