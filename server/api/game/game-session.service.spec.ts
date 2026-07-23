import { describe, expect, test } from "vitest";

import { RoomService } from "../room/room.service";
import { GameSessionService } from "./game-session.service";

describe("GameSessionService", () => {
  test("only host can start a game with 2-6 players", () => {
    const roomService = new RoomService();
    const service = new GameSessionService(roomService);
    const created = roomService.create("room", "host", "socket-1");
    roomService.joinRoom(
      { roomId: created.room.roomId, playerName: "p2" },
      "socket-2",
    );

    const views = service.startGame(created.room.roomId, created.playerId);

    expect(views).toHaveLength(2);
    expect(views[0]?.view.phase).toBe("IDLE");
  });
});
