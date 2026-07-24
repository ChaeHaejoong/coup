import type {
  ActionType,
  Card,
  DecisionType,
  Phase,
} from "../server/game-engine/types";

export const GameRequestEvent = {
  START_GAME: "startGame",
  SUBMIT_GAME_COMMAND: "submitGameCommand",
  REQUEST_GAME_STATE: "requestGameState",
  CHAT: "chat",
} as const;
export type GameRequestEvent =
  (typeof GameRequestEvent)[keyof typeof GameRequestEvent];

export const GameResponseEvent = {
  GAME_STATE_UPDATED: "gameStateUpdated",
  GAME_ERROR: "gameError",
  CHAT_RECEIVED: "chatReceived",
} as const;
export type GameResponseEvent =
  (typeof GameResponseEvent)[keyof typeof GameResponseEvent];

export const GameCommandType = {
  ACT: "ACT",
  PASS_CHALLENGE: "PASS_CHALLENGE",
  CHALLENGE: "CHALLENGE",
  PASS_BLOCK: "PASS_BLOCK",
  BLOCK: "BLOCK",
  PASS_BLOCK_CHALLENGE: "PASS_BLOCK_CHALLENGE",
  CHALLENGE_BLOCK: "CHALLENGE_BLOCK",
  CHOOSE_CARD: "CHOOSE_CARD",
} as const;
export type GameCommandType =
  (typeof GameCommandType)[keyof typeof GameCommandType];

export type GameCommand =
  | { type: "ACT"; actionType: ActionType; targetId?: number }
  | { type: "PASS_CHALLENGE" }
  | { type: "CHALLENGE" }
  | { type: "PASS_BLOCK" }
  | { type: "BLOCK"; card: Card }
  | { type: "PASS_BLOCK_CHALLENGE" }
  | { type: "CHALLENGE_BLOCK" }
  | { type: "CHOOSE_CARD"; cardIndexes: number[] };

export const GameErrorCode = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  GAME_NOT_STARTED: "GAME_NOT_STARTED",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  NOT_ROOM_MEMBER: "NOT_ROOM_MEMBER",
  NOT_HOST: "NOT_HOST",
  INVALID_PLAYER_COUNT: "INVALID_PLAYER_COUNT",
  INVALID_PHASE: "INVALID_PHASE",
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  NOT_YOUR_DECISION: "NOT_YOUR_DECISION",
  COMMAND_REJECTED: "COMMAND_REJECTED",
} as const;
export type GameErrorCode = (typeof GameErrorCode)[keyof typeof GameErrorCode];

export type PublicGamerView = {
  id: number;
  name: string;
  coin: number;
  isAlive: boolean;
  influenceCount: number;
  cards?: Card[];
};

export type PrivateGamerView = {
  playerId: number;
  cards: Card[];
  decisionCards?: Card[];
};

export type GameView = {
  roomId: number;
  selfPlayerId: number;
  selfPlayerName: string;
  phase: Phase;
  turnPlayerId: number | null;
  turnPlayerName: string | null;
  turnTimer: {
    deadlineAt: number;
    durationMs: number;
  } | null;
  players: PublicGamerView[];
  private: PrivateGamerView | null;
  pendingAction: {
    type: ActionType;
    actorId: number;
    actorName: string;
    targetId?: number;
    targetName?: string;
  } | null;
  pendingBlock: { blockerId: number; blockerName: string; card: Card } | null;
  pendingDecision: {
    type: DecisionType;
    playerId: number;
    playerName: string;
    cardCount?: number;
  } | null;
  events: GameEventView[];
  winnerId: number | null;
  winnerName: string | null;
};

export type GameEventView = {
  type: string;
  playerCount?: number;
  actorId?: number;
  actorName?: string;
  targetId?: number;
  targetName?: string;
  actionType?: ActionType;
  card?: Card;
  playerId?: number;
  playerName?: string;
  blockerId?: number;
  blockerName?: string;
  winnerId?: number;
  winnerName?: string;
  remainingInfluence?: number;
};

export type GameCommandResult =
  | { ok: true; view: GameView }
  | { ok: false; errorCode: GameErrorCode };

export type StartGameRequest = {
  roomId: number;
  playerId: number;
};

export type GameCommandRequest = {
  roomId: number;
  playerId: number;
  command: GameCommand;
};

export type GameStateRequest = {
  roomId: number;
  playerId: number;
};

export type ChatRequest = {
  roomId: number;
  playerId: number;
  message: string;
};

export type ChatReceivedResponse = {
  roomId: number;
  playerId: number;
  message: string;
};
