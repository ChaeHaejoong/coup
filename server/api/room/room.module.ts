import { Module } from "@nestjs/common";

import { RoomController } from "./room.controller";
import { RoomGateway } from "./room.gateway";
import { RoomService } from "./room.service";

@Module({
  controllers: [RoomController],
  providers: [RoomService, RoomGateway],
})
export class RoomModule {}
