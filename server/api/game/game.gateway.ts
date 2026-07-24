import {
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
  GameSessionService,
  type PlayerGameView,
} from "./game-session.service";
import { RoomService } from "../room/room.service";

type Ack<T> = (result: T) => void;

@WebSocketGateway({
  cors: true,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly sockets = new Map<string, Socket>();

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly roomService: RoomService,
  ) {
    this.gameSessionService.setGameUpdateListener((_roomId, views) => {
      this.emitGameViews(views);
    });
  }

  handleConnection(client: Socket): void {
    this.sockets.set(client.id, client);
  }

  handleDisconnect(client: Socket): void {
    this.sockets.delete(client.id);
  }

  @SubscribeMessage(GameRequestEvent.START_GAME)
  startGame(
    @MessageBody() body: StartGameRequest,
    ack?: Ack<GameCommandResult>,
  ): GameCommandResult {
    return this.runGameOperation(body.playerId, ack, () =>
      this.gameSessionService.startGame(body.roomId, body.playerId),
    );
  }

  @SubscribeMessage(GameRequestEvent.SUBMIT_GAME_COMMAND)
  submitGameCommand(
    @MessageBody() body: GameCommandRequest,
    ack?: Ack<GameCommandResult>,
  ): GameCommandResult {
    return this.runGameOperation(body.playerId, ack, () =>
      this.gameSessionService.submitGameCommand(
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
      this.gameSessionService.getGameViews(body.roomId),
    );
  }

  @SubscribeMessage(GameRequestEvent.CHAT)
  chat(@MessageBody() body: ChatRequest): ChatReceivedResponse {
    const room = this.roomService.getRoom(body.roomId);
    const player = room.players.find(
      (roomPlayer) => roomPlayer.id === body.playerId,
    );
    if (!player) {
      throw new Error(GameErrorCode.NOT_ROOM_MEMBER);
    }

    const response = {
      roomId: body.roomId,
      playerId: body.playerId,
      playerName: player.name,
      message: body.message,
    };
    this.server
      .to(this.getSocketRoomName(body.roomId))
      .emit(GameResponseEvent.CHAT_RECEIVED, response);
    return response;
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

  private getSocketRoomName(roomId: number): string {
    return `room:${roomId}`;
  }
}
