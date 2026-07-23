import { Body, Controller, Get, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import {
  RoomHttpPath,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type ListRoomsResponse,
} from "../../../shared/room-contract";
import { RoomService } from "./room.service";

@Controller(RoomHttpPath.ROOT)
export class RoomController {
  constructor(private readonly roomService: RoomService) { }

  @Get()
  getRoom(): ListRoomsResponse {
    return { rooms: this.roomService.getRooms() };
  }

  @Post(RoomHttpPath.CREATE)
  create(@Body() body: CreateRoomRequest): CreateRoomResponse {
    return this.roomService.create(
      body.roomName,
      body.playerName,
      `http:${randomUUID()}`,
    );
  }
}
