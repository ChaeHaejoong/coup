import { describe, expect, test } from "vitest";

import { PlayerRole } from "../../../shared/room-contract";
import { RoomService } from "./room.service";

describe("RoomService", () => {
  test("create joins the creator as host", () => {
    const service = new RoomService();

    const result = service.create("first room", "해중", "socket-1");

    expect(result.playerId).toBe(1);
    expect(result.socketId).toBe("socket-1");
    expect(result.room.roomName).toBe("first room");
    expect(result.room.players).toEqual([
      { id: 1, socketId: "socket-1", name: "해중", role: PlayerRole.HOST },
    ]);
  });

  test("only host can start a game with 2-6 players", () => {
    const service = new RoomService();
    const created = service.create("room", "host", "socket-1");
    service.joinRoom({ roomId: created.room.roomId, playerName: "p2" }, "socket-2");

    const views = service.startGame(created.room.roomId, created.playerId);

    expect(views).toHaveLength(2);
    expect(views[0]?.view.phase).toBe("IDLE");
  });
});
