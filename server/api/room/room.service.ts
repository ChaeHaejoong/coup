import { Injectable, NotFoundException } from "@nestjs/common";

import {
  PlayerRole,
  type JoinRoomRequest,
  type Room,
  type RoomJoinedResponse,
  type RoomPlayer,
} from "../../../shared/room-contract";

type StoredRoom = {
  roomId: number;
  roomName: string;
  players: RoomPlayer[];
};

@Injectable()
export class RoomService {
  private rooms = new Map<number, StoredRoom>();

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

  create(roomName: string): Room {
    const roomId = this.generateRoomId();
    const room: StoredRoom = {
      roomId,
      roomName,
      players: [],
    };
    this.rooms.set(roomId, room);

    return this.toRoom(room);
  }

  removeRoom(roomId: number): void {
    this.rooms.delete(roomId);
  }

  private getRoomOrThrow(roomId: number): StoredRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`room ${roomId} does not exist`);
    }

    return room;
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
