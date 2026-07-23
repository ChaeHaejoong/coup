export const RoomHttpPath = {
  ROOT: "room",
  CREATE: "create",
} as const;
export type RoomHttpPath = (typeof RoomHttpPath)[keyof typeof RoomHttpPath];

export const RoomRequestEvent = {
  CREATE_ROOM: "createRoom",
  JOIN_ROOM: "joinRoom",
  LEAVE_ROOM: "leaveRoom",
} as const;
export type RoomRequestEvent = (typeof RoomRequestEvent)[keyof typeof RoomRequestEvent];

export const RoomResponseEvent = {
  ROOM_JOINED: "roomJoined",
  ROOM_LEFT: "roomLeft",
  ROOM_UPDATED: "roomUpdated",
} as const;
export type RoomResponseEvent = (typeof RoomResponseEvent)[keyof typeof RoomResponseEvent];

export const PlayerRole = {
  HOST: "host",
  PLAYER: "player",
} as const;
export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole];

export type RoomPlayer = {
  id: number;
  socketId: string;
  role: PlayerRole;
  name: string;
};

export type Room = {
  roomId: number;
  roomName: string;
  players: RoomPlayer[];
};

export type CreateRoomRequest = {
  roomName: string;
  playerName: string;
};

export type CreateRoomResponse = {
  room: Room;
  playerId: number;
  socketId: string;
};

export type JoinRoomRequest = {
  roomId: number;
  playerName: string;
};

export type LeaveRoomRequest = {
  roomId: number;
  playerId: number;
};

export type ListRoomsResponse = {
  rooms: Room[];
};

export type RoomJoinedResponse = {
  room: Room;
  playerId: number;
  socketId: string;
};

export type RoomLeftResponse = {
  room: Room;
};
