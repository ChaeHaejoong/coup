import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { io, type Socket } from "socket.io-client";

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

type Command =
  | { type: "create"; roomName: string }
  | { type: "rooms" }
  | { type: "join"; roomId: number; playerName: string }
  | { type: "leave" }
  | { type: "help" }
  | { type: "exit" }
  | { type: "invalid"; message: string };

const serverUrl = process.env.SERVER_URL ?? "http://localhost:3000";
let socket: Socket | null = null;
let joinedRoom: { roomId: number; playerId: number } | null = null;

async function main(): Promise<void> {
  const terminal = createInterface({ input, output });

  printHelp();

  while (true) {
    const line = await terminal.question("> ");
    const command = parseCommand(line);

    if (command.type === "exit") {
      await leaveCurrentRoom();
      socket?.disconnect();
      terminal.close();
      return;
    }

    await runCommand(command);
  }
}

function parseCommand(line: string): Command {
  const [command, ...args] = line.trim().split(/\s+/).filter(Boolean);

  if (!command) {
    return { type: "invalid", message: "명령을 입력하세요." };
  }

  if (command === "/create") {
    const roomName = args.join(" ").trim();
    if (!roomName) {
      return { type: "invalid", message: "사용법: /create <roomName>" };
    }

    return { type: "create", roomName };
  }

  if (command === "/rooms") {
    return { type: "rooms" };
  }

  if (command === "/join") {
    const roomId = Number(args[0]);
    const playerName = args.slice(1).join(" ").trim();

    if (!Number.isInteger(roomId) || roomId < 0 || !playerName) {
      return { type: "invalid", message: "사용법: /join <roomId> <playerName>" };
    }

    return { type: "join", roomId, playerName };
  }

  if (command === "/leave") {
    return { type: "leave" };
  }

  if (command === "/help") {
    return { type: "help" };
  }

  if (command === "/exit") {
    return { type: "exit" };
  }

  return { type: "invalid", message: `알 수 없는 명령입니다: ${command}` };
}

async function runCommand(command: Command): Promise<void> {
  if (command.type === "invalid") {
    console.log(command.message);
    return;
  }

  if (command.type === "help") {
    printHelp();
    return;
  }

  if (command.type === "rooms") {
    await listRooms();
    return;
  }

  if (command.type === "create") {
    await createRoom(command.roomName);
    return;
  }

  if (command.type === "join") {
    await joinRoom(command.roomId, command.playerName);
    return;
  }

  await leaveCurrentRoom();
}

async function listRooms(): Promise<void> {
  const response = await request<ListRoomsResponse>(`${roomBaseUrl()}`);
  printRooms(response.rooms);
}

async function createRoom(roomName: string): Promise<void> {
  const body: CreateRoomRequest = { roomName };
  const room = await request<Room>(`${roomBaseUrl()}/${RoomHttpPath.CREATE}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log(`created room ${room.roomId}: ${room.roomName}`);
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
    console.log(`joined room ${response.room.roomId} as player ${response.playerId}`);
    printRoom(response.room);
  });

  socket.on(RoomResponseEvent.ROOM_LEFT, (response: RoomLeftResponse) => {
    console.log(`left room ${response.room.roomId}`);
    printRoom(response.room);
  });

  socket.on(RoomResponseEvent.ROOM_UPDATED, (room: Room) => {
    console.log(`room ${room.roomId} updated`);
    printRoom(room);
  });

  socket.on("connect_error", (error: Error) => {
    console.log(`socket connection failed: ${error.message}`);
  });

  return socket;
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

function printRooms(rooms: Room[]): void {
  if (rooms.length === 0) {
    console.log("rooms: empty");
    return;
  }

  for (const room of rooms) {
    console.log(`[${room.roomId}] ${room.roomName} (${room.players.length} 명)`);
  }
}

function printRoom(room: Room): void {
  const players = room.players
    .map((player) => `${player.id}:${player.name}:${player.role}`)
    .join(", ");

  console.log(`${room.roomId}: ${room.roomName} [${players}]`);
}

function printHelp(): void {
  console.log("commands: /rooms, /create <roomName>, /join <roomId> <playerName>, /leave, /exit");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
