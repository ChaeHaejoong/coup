import { Module } from "@nestjs/common";

import { GameModule } from "./game/game.module";
import { RoomModule } from "./room/room.module";

@Module({
  imports: [RoomModule, GameModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
