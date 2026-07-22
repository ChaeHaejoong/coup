import { Body, Controller, Get, Post } from "@nestjs/common";

import {
  RoomHttpPath,
  type CreateRoomRequest,
  type ListRoomsResponse,
  type Room,
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
  create(@Body() body: CreateRoomRequest): Room {
    return this.roomService.create(body.roomName);
  }
}
