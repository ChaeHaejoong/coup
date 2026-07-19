export const Card = {
  DUKE: "DUKE",
  ASSASSIN: "ASSASSIN",
  CAPTAIN: "CAPTAIN",
  AMBASSADOR: "AMBASSADOR",
  CONTESSA: "CONTESSA",
} as const;
export type Card = (typeof Card)[keyof typeof Card];

export type PlayerInfo = {
  id: number;
  name: string;
};

export type Player = {
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
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export const ActionType = {
  INCOME: "INCOME",
  FOREIGN_AID: "FOREIGN_AID",
  COUP: "COUP",
  TAX: "TAX",
  EXCHANGE: "EXCHANGE",
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

export type PendingDecision = {
  type: DecisionType;
  playerId: number;
};

export type GameState = {
  gameHistory: string[];
  players: Player[];
  turnPlayer: Player;
  phase: Phase;
  pendingAction: Action | null;
  pendingDecision: PendingDecision | null;
};
