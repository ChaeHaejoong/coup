import { stdin as input, stdout as output } from "process";
import { createInterface } from "readline/promises";
import { io, type Socket } from "socket.io-client";

import {
  GameRequestEvent,
  GameResponseEvent,
  type ChatReceivedResponse,
  type GameCommandResult,
  type GameView,
} from "../shared/game-contract";
import {
  RoomHttpPath,
  RoomRequestEvent,
  RoomResponseEvent,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type LeaveRoomRequest,
  type ListRoomsResponse,
  type Room,
  type RoomJoinedResponse,
  type RoomLeftResponse,
} from "../shared/room-contract";
import { parseCliInput, type ParsedInput } from "./commands";
import { buildGameMenu, type MenuItem } from "./game-menu";
import { renderError, renderHelp } from "./ui/messages";
import { renderGameView, renderMenu, renderRoom, renderRooms } from "./ui/render";

const serverUrl = process.env.SERVER_URL ?? "http://localhost:3000";

let socket: Socket | null = null;
let joinedRoom: { roomId: number; playerId: number } | null = null;
let latestRoom: Room | null = null;
let latestGameView: GameView | null = null;
let currentMenu: MenuItem[] = [];

async function main(): Promise<void> {
  const terminal = createInterface({ input, output });

  console.log(renderHelp());

  while (true) {
    const line = await terminal.question("> ");
    const command = parseCliInput(line);

    if (command.type === "exit") {
      await leaveCurrentRoom();
      socket?.disconnect();
      terminal.close();
      return;
    }

    await runCommand(command);
  }
}

async function runCommand(command: ParsedInput): Promise<void> {
  if (command.type === "invalid") {
    console.log(command.message);
    return;
  }
  if (command.type === "help") {
    console.log(renderHelp());
    return;
  }
  if (command.type === "rooms") {
    await listRooms();
    return;
  }
  if (command.type === "create") {
    await createRoom(command.roomName, command.playerName);
    return;
  }
  if (command.type === "join") {
    await joinRoom(command.roomId, command.playerName);
    return;
  }
  if (command.type === "leave") {
    await leaveCurrentRoom();
    return;
  }
  if (command.type === "start") {
    await startGame();
    return;
  }
  if (command.type === "status") {
    printStatus();
    return;
  }
  if (command.type === "chat") {
    sendChat(command.message);
    return;
  }
  if (command.type === "menu") {
    await submitMenu(command.index);
  }
}

async function listRooms(): Promise<void> {
  const response = await request<ListRoomsResponse>(`${roomBaseUrl()}`);
  console.log(renderRooms(response.rooms));
}

async function createRoom(roomName: string, playerName: string): Promise<void> {
  await leaveCurrentRoom();

  const client = getSocket();
  await connectSocket(client);

  const body: CreateRoomRequest = { roomName, playerName };
  client.emit(RoomRequestEvent.CREATE_ROOM, body);
}

async function joinRoom(roomId: number, playerName: string): Promise<void> {
  await leaveCurrentRoom();

  const client = getSocket();
  await connectSocket(client);

  const body: JoinRoomRequest = { roomId, playerName };
  client.emit(RoomRequestEvent.JOIN_ROOM, body);
}

async function leaveCurrentRoom(): Promise<void> {
  if (!socket || !joinedRoom) {
    return;
  }

  const body: LeaveRoomRequest = joinedRoom;
  socket.emit(RoomRequestEvent.LEAVE_ROOM, body);
  joinedRoom = null;
  latestRoom = null;
  latestGameView = null;
  currentMenu = [];
}

async function startGame(): Promise<void> {
  if (!joinedRoom) {
    console.log("먼저 방에 참여하세요.");
    return;
  }

  await emitGameRequest(GameRequestEvent.START_GAME, joinedRoom);
}

async function submitMenu(index: number): Promise<void> {
  const item = currentMenu[index];
  if (!item || !joinedRoom) {
    console.log("선택할 수 없는 번호입니다.");
    return;
  }

  await emitGameRequest(GameRequestEvent.SUBMIT_GAME_COMMAND, {
    ...joinedRoom,
    command: item.command,
  });
}

function sendChat(message: string): void {
  if (!socket || !joinedRoom) {
    console.log("먼저 방에 참여하세요.");
    return;
  }

  socket.emit(GameRequestEvent.CHAT, { ...joinedRoom, message });
}

function printStatus(): void {
  if (latestGameView) {
    renderLatestGame(latestGameView);
    return;
  }
  if (latestRoom) {
    console.log(renderRoom(latestRoom));
    return;
  }
  console.log("참여 중인 방이 없습니다.");
}

async function emitGameRequest(
  event: GameRequestEvent,
  body: unknown,
): Promise<void> {
  const client = getSocket();
  await connectSocket(client);

  await new Promise<void>((resolve) => {
    client.emit(event, body, (result: GameCommandResult) => {
      if (!result.ok) {
        console.log(renderError(result.errorCode));
      }
      resolve();
    });
  });
}

function getSocket(): Socket {
  if (socket) {
    return socket;
  }

  socket = io(serverUrl, {
    autoConnect: false,
  });

  socket.on(RoomResponseEvent.ROOM_JOINED, (response: RoomJoinedResponse) => {
    joinedRoom = {
      roomId: response.room.roomId,
      playerId: response.playerId,
    };
    latestRoom = response.room;
    console.log(renderRoom(response.room));
  });

  socket.on(RoomResponseEvent.ROOM_LEFT, (response: RoomLeftResponse) => {
    console.log(renderRoom(response.room));
  });

  socket.on(RoomResponseEvent.ROOM_UPDATED, (room: Room) => {
    latestRoom = room;
    console.log(renderRoom(room));
  });

  socket.on(GameResponseEvent.GAME_STATE_UPDATED, (view: GameView) => {
    renderLatestGame(view);
  });

  socket.on(GameResponseEvent.CHAT_RECEIVED, (response: ChatReceivedResponse) => {
    console.log(`${response.playerId}: ${response.message}`);
  });

  socket.on("connect_error", (error: Error) => {
    console.log(`socket connection failed: ${error.message}`);
  });

  return socket;
}

function renderLatestGame(view: GameView): void {
  latestGameView = view;
  currentMenu = buildGameMenu(view);
  console.log(renderGameView(view));
  if (currentMenu.length > 0) {
    console.log(renderMenu(currentMenu));
  }
}

async function connectSocket(client: Socket): Promise<void> {
  if (client.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
    client.connect();
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function roomBaseUrl(): string {
  return `${serverUrl}/${RoomHttpPath.ROOT}`;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
