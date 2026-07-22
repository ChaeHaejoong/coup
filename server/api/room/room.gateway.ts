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
  RoomRequestEvent,
  RoomResponseEvent,
  type JoinRoomRequest,
  type LeaveRoomRequest,
  type Room,
  type RoomJoinedResponse,
} from "../../../shared/room-contract";
import { RoomService } from "./room.service";

@WebSocketGateway({
  cors: true,
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly sockets = new Map<string, Socket>();
  private readonly socketPlayers = new Map<string, { roomId: number; playerId: number }>();

  constructor(private readonly roomService: RoomService) { }

  handleConnection(client: Socket): void {
    this.sockets.set(client.id, client);
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
}
