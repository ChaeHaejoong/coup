export const Card = {
  DUKE: "DUKE",
  ASSASSIN: "ASSASSIN",
  CAPTAIN: "CAPTAIN",
  AMBASSADOR: "AMBASSADOR",
  CONTESSA: "CONTESSA",
} as const;
export type Card = (typeof Card)[keyof typeof Card];

export type Player = {
  id: number;
  name: string;
};

export type Gamer = {
  id: number;
  name: string;
  coin: number;
  deck: Card[];
  isAlive: boolean;
};

export const Phase = {
  IDLE: "IDLE",
  AWAIT_CHALLENGE: "AWAIT_CHALLENGE",
  AWAIT_BLOCK: "AWAIT_BLOCK",
  AWAIT_BLOCK_CHALLENGE: "AWAIT_BLOCK_CHALLENGE",
  AWAIT_DECISION: "AWAIT_DECISION",
  ACTION_RESOLVED: "ACTION_RESOLVED",
  FINISHED: "FINISHED",
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export const ActionType = {
  INCOME: "INCOME",
  FOREIGN_AID: "FOREIGN_AID",
  COUP: "COUP",
  TAX: "TAX",
  STEAL: "STEAL",
  EXCHANGE: "EXCHANGE",
  ASSASSINATE: "ASSASSINATE",
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export type Action = {
  type: ActionType;
  actorId: number;
  targetId?: number;
};

export const DecisionType = {
  LOSE_CARD: "LOSE_CARD",
  EXCHANGE: "EXCHANGE",
} as const;
export type DecisionType = (typeof DecisionType)[keyof typeof DecisionType];

export const DecisionAfter = {
  END_TURN: "END_TURN",
  ACTION_CONTINUES: "ACTION_CONTINUES",
  ACTION_SUCCEEDS: "ACTION_SUCCEEDS",
  ACTION_BLOCKED: "ACTION_BLOCKED",
} as const;
export type DecisionAfter = (typeof DecisionAfter)[keyof typeof DecisionAfter];

export type PendingDecision = {
  type: DecisionType;
  playerId: number;
  cards?: Card[];
  after: DecisionAfter;
};

export type PendingBlock = {
  blockerId: number;
  card: Card;
};

export const GameEventType = {
  GAME_STARTED: "GAME_STARTED",
  TURN_STARTED: "TURN_STARTED",
  ACTION_DECLARED: "ACTION_DECLARED",
  ACTION_BLOCKED: "ACTION_BLOCKED",
  INFLUENCE_LOST: "INFLUENCE_LOST",
  GAME_FINISHED: "GAME_FINISHED",
} as const;
export type GameEventType = (typeof GameEventType)[keyof typeof GameEventType];

export type GameEvent =
  | { type: "GAME_STARTED"; playerCount: number }
  | { type: "TURN_STARTED"; playerId: number }
  | {
      type: "ACTION_DECLARED";
      actorId: number;
      actionType: ActionType;
      targetId?: number;
    }
  | { type: "ACTION_BLOCKED"; blockerId: number }
  | {
      type: "INFLUENCE_LOST";
      playerId: number;
      remainingInfluence: number;
    }
  | { type: "GAME_FINISHED"; winnerId: number };

export type GameState = {
  events: GameEvent[];
  gamers: Gamer[];
  turnGamer: Gamer;
  phase: Phase;
  pendingAction: Action | null;
  pendingBlock: PendingBlock | null;
  pendingDecision: PendingDecision | null;
  challengePasses: number[];
  blockPasses: number[];
  blockChallengePasses: number[];
  winner: Gamer | null;
};
