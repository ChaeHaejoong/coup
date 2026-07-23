import { Module } from "@nestjs/common";

import { RoomModule } from "../room/room.module";
import { GameGateway } from "./game.gateway";
import { GameSessionService } from "./game-session.service";

@Module({
  imports: [RoomModule],
  providers: [GameSessionService, GameGateway],
})
export class GameModule {}
