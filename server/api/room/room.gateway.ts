import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import {
  GameErrorCode,
  GameRequestEvent,
  GameResponseEvent,
  type ChatReceivedResponse,
  type ChatRequest,
  type GameCommandRequest,
  type GameCommandResult,
  type GameStateRequest,
  type GameView,
  type StartGameRequest,
} from "../../../shared/game-contract";
import {
  RoomRequestEvent,
  RoomResponseEvent,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type LeaveRoomRequest,
  type Room,
  type RoomJoinedResponse,
} from "../../../shared/room-contract";
import { RoomService, type PlayerGameView } from "./room.service";

type Ack<T> = (result: T) => void;

@WebSocketGateway({
  cors: true,
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly sockets = new Map<string, Socket>();
  private readonly socketPlayers = new Map<string, { roomId: number; playerId: number }>();

  constructor(private readonly roomService: RoomService) {
    this.roomService.setGameUpdateListener((_roomId, views) => {
      this.emitGameViews(views);
    });
  }

  handleConnection(client: Socket): void {
    this.sockets.set(client.id, client);
  }

  @SubscribeMessage(RoomRequestEvent.CREATE_ROOM)
  createRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CreateRoomRequest,
  ): RoomJoinedResponse {
    const createResult = this.roomService.create(
      body.roomName,
      body.playerName,
      client.id,
    );
    const room = createResult.room;
    const socketRoomName = this.getSocketRoomName(room.roomId);

    client.join(socketRoomName);
    this.socketPlayers.set(client.id, {
      roomId: room.roomId,
      playerId: createResult.playerId,
    });

    const joinResult = {
      room,
      playerId: createResult.playerId,
      socketId: createResult.socketId,
    };
    client.emit(RoomResponseEvent.ROOM_JOINED, joinResult);
    this.server.to(socketRoomName).emit(RoomResponseEvent.ROOM_UPDATED, room);

    return joinResult;
  }

  @SubscribeMessage(RoomRequestEvent.JOIN_ROOM)
  joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomRequest,
  ): RoomJoinedResponse {
    const joinResult = this.roomService.joinRoom(body, client.id);
    const room = joinResult.room;
    const socketRoomName = this.getSocketRoomName(body.roomId);

    client.join(socketRoomName);
    this.socketPlayers.set(client.id, {
      roomId: body.roomId,
      playerId: joinResult.playerId,
    });

    client.emit(RoomResponseEvent.ROOM_JOINED, joinResult);
    this.server.to(socketRoomName).emit(RoomResponseEvent.ROOM_UPDATED, room);

    return joinResult;
  }

  @SubscribeMessage(RoomRequestEvent.LEAVE_ROOM)
  leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LeaveRoomRequest,
  ): Room {
    const room = this.roomService.leaveRoom(body.roomId, body.playerId);
    const socketRoomName = this.getSocketRoomName(body.roomId);

    client.leave(socketRoomName);
    this.socketPlayers.delete(client.id);
    client.emit(RoomResponseEvent.ROOM_LEFT, { room });
    this.server.to(socketRoomName).emit(RoomResponseEvent.ROOM_UPDATED, room);

    return room;
  }

  @SubscribeMessage(GameRequestEvent.START_GAME)
  startGame(
    @MessageBody() body: StartGameRequest,
    ack?: Ack<GameCommandResult>,
  ): GameCommandResult {
    return this.runGameOperation(body.playerId, ack, () =>
      this.roomService.startGame(body.roomId, body.playerId),
    );
  }

  @SubscribeMessage(GameRequestEvent.SUBMIT_GAME_COMMAND)
  submitGameCommand(
    @MessageBody() body: GameCommandRequest,
    ack?: Ack<GameCommandResult>,
  ): GameCommandResult {
    return this.runGameOperation(body.playerId, ack, () =>
      this.roomService.submitGameCommand(
        body.roomId,
        body.playerId,
        body.command,
      ),
    );
  }

  @SubscribeMessage(GameRequestEvent.REQUEST_GAME_STATE)
  requestGameState(
    @MessageBody() body: GameStateRequest,
    ack?: Ack<GameCommandResult>,
  ): GameCommandResult {
    return this.runGameOperation(body.playerId, ack, () =>
      this.roomService.getGameViews(body.roomId),
    );
  }

  @SubscribeMessage(GameRequestEvent.CHAT)
  chat(@MessageBody() body: ChatRequest): ChatReceivedResponse {
    const response = {
      roomId: body.roomId,
      playerId: body.playerId,
      message: body.message,
    };
    this.server
      .to(this.getSocketRoomName(body.roomId))
      .emit(GameResponseEvent.CHAT_RECEIVED, response);
    return response;
  }

  handleDisconnect(client: Socket): void {
    this.sockets.delete(client.id);

    const socketPlayer = this.socketPlayers.get(client.id);
    if (!socketPlayer) {
      return;
    }

    const room = this.roomService.leaveRoom(socketPlayer.roomId, socketPlayer.playerId);
    this.socketPlayers.delete(client.id);
    this.server.to(this.getSocketRoomName(socketPlayer.roomId)).emit(RoomResponseEvent.ROOM_UPDATED, room);
  }

  private getSocketRoomName(roomId: number): string {
    return `room:${roomId}`;
  }

  private runGameOperation(
    playerId: number,
    ack: Ack<GameCommandResult> | undefined,
    operation: () => PlayerGameView[],
  ): GameCommandResult {
    try {
      const views = operation();
      this.emitGameViews(views);
      const ownView = this.findOwnView(views, playerId);
      const result: GameCommandResult = { ok: true, view: ownView };
      ack?.(result);
      return result;
    } catch (error) {
      const errorCode = this.toGameErrorCode(error);
      const result: GameCommandResult = { ok: false, errorCode };
      ack?.(result);
      return result;
    }
  }

  private emitGameViews(views: PlayerGameView[]): void {
    for (const { socketId, view } of views) {
      this.sockets
        .get(socketId)
        ?.emit(GameResponseEvent.GAME_STATE_UPDATED, view);
    }
  }

  private findOwnView(views: PlayerGameView[], playerId: number): GameView {
    const ownView = views.find((view) => view.playerId === playerId)?.view;
    if (!ownView) {
      throw new Error(GameErrorCode.NOT_ROOM_MEMBER);
    }
    return ownView;
  }

  private toGameErrorCode(error: unknown): GameErrorCode {
    if (error instanceof Error && this.isGameErrorCode(error.message)) {
      return error.message;
    }
    return GameErrorCode.COMMAND_REJECTED;
  }

  private isGameErrorCode(value: string): value is GameErrorCode {
    return Object.values(GameErrorCode).includes(value as GameErrorCode);
  }
}
