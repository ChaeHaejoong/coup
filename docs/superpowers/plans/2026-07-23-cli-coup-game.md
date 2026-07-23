# CLI Coup Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local multiplayer CLI Coup game where one NestJS server hosts rooms and multiple terminal clients play a complete Coup game.

**Architecture:** The server is authoritative for rooms, game state, validation, and timers. The server sends structured state and error codes only; the CLI derives menus and renders all Korean UI text. The game engine remains pure TypeScript with no Socket.IO or CLI dependency.

**Tech Stack:** TypeScript 5.9, NestJS 11, Socket.IO 4, socket.io-client 4, Vitest 4, tsx.

## Global Constraints

- Complete local multiplayer mode: one server, multiple `npm run client` terminals.
- Server sends state and error codes only, not UI strings or numbered menu text.
- CLI owns all display text under `client/ui/*`.
- Creating a room also joins the creator as host.
- Valid game player count is 2-6.
- Challenge, block, and block-challenge phases timeout after 10 seconds and auto-pass missing responses.
- Card-choice decisions do not auto-select cards.
- Normal mode shows only the receiving player's cards; `DEBUG_GAME=true` may reveal all cards.
- `npm run check` and `npm test` must pass.

---

## File Structure

- Modify `shared/room-contract.ts`: make room creation include `playerName`; add `CREATE_ROOM` socket event and `CreateRoomResponse`.
- Create `shared/game-contract.ts`: game socket events, commands, DTOs, error codes.
- Modify `server/game-engine/types.ts`: add structured `GameEvent` types and readonly view intent.
- Modify `server/game-engine/index.ts`: return cloned state; emit structured events instead of UI history strings.
- Create `server/game-engine/test-utils.ts`: test-only state mutator helper.
- Modify `server/game-engine/tests/game-engine.spec.ts`: use test helper and add missing rule coverage.
- Modify `server/api/room/room.service.ts`: create-and-join, game lifecycle, command dispatch, per-room timers.
- Create `server/api/room/game-presenter.ts`: convert engine `GameState` to per-player `GameView`.
- Modify `server/api/room/room.gateway.ts`: add game socket events, ack-style errors, disconnect cleanup.
- Modify `server/api/room/room.controller.ts`: keep HTTP room creation compatible, but the CLI uses socket creation so the creator can join the socket room immediately.
- Create `server/api/room/room.service.spec.ts`: service tests for room and game behavior.
- Modify `client/index.ts`: split logic and wire new contracts.
- Create `client/commands.ts`: parse lobby, room, game, and numeric input.
- Create `client/game-menu.ts`: derive current menu from `GameView`.
- Create `client/ui/messages.ts`: Korean message rendering for codes/events/menu labels.
- Create `client/ui/render.ts`: status, room, game, and menu rendering functions.
- Create `client/game-menu.spec.ts`: CLI menu derivation tests.

---

### Task 1: Room Create Joins Creator

**Files:**
- Modify: `shared/room-contract.ts`
- Modify: `server/api/room/room.service.ts`
- Modify: `server/api/room/room.controller.ts`
- Modify: `server/api/room/room.gateway.ts`
- Create: `server/api/room/room.service.spec.ts`
- Modify: `client/index.ts`

**Interfaces:**
- Consumes: existing `Room`, `RoomPlayer`, `PlayerRole`.
- Produces:
  - `type CreateRoomRequest = { roomName: string; playerName: string }`
  - `type CreateRoomResponse = { room: Room; playerId: number; socketId: string | null }`
  - `RoomRequestEvent.CREATE_ROOM = "createRoom"`
  - `RoomService.create(roomName: string, playerName: string, socketId: string): CreateRoomResponse`

- [ ] **Step 1: Write the failing service test**

Add this to `server/api/room/room.service.spec.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server/api/room/room.service.spec.ts`

Expected: FAIL because `CreateRoomResponse` behavior does not exist.

- [ ] **Step 3: Update the shared room contract**

Change `shared/room-contract.ts`:

```ts
export const RoomRequestEvent = {
  CREATE_ROOM: "createRoom",
  JOIN_ROOM: "joinRoom",
  LEAVE_ROOM: "leaveRoom",
} as const;
export type RoomRequestEvent = (typeof RoomRequestEvent)[keyof typeof RoomRequestEvent];

export type CreateRoomRequest = {
  roomName: string;
  playerName: string;
};

export type CreateRoomResponse = {
  room: Room;
  playerId: number;
  socketId: string;
};
```

- [ ] **Step 4: Implement create-and-join in the service**

Update `RoomService.create`:

```ts
create(roomName: string, playerName: string, socketId: string): CreateRoomResponse {
  const roomId = this.generateRoomId();
  const room: StoredRoom = {
    roomId,
    roomName,
    players: [],
  };
  this.rooms.set(roomId, room);

  const playerId = this.generatePlayerId(room);
  room.players.push({
    id: playerId,
    socketId,
    name: playerName,
    role: PlayerRole.HOST,
  });

  return {
    room: this.toRoom(room),
    playerId,
    socketId,
  };
}
```

- [ ] **Step 5: Update controller, gateway, and client call sites**

In `room.controller.ts`, keep HTTP creation available for non-CLI callers by using a generated synthetic socket id. The CLI will not use this path for create-and-join.

```ts
@Post(RoomHttpPath.CREATE)
create(@Body() body: CreateRoomRequest): CreateRoomResponse {
  return this.roomService.create(
    body.roomName,
    body.playerName,
    `http:${globalThis.crypto.randomUUID()}`,
  );
}
```

In `room.gateway.ts`, add a `CREATE_ROOM` socket handler. It must call `roomService.create(body.roomName, body.playerName, client.id)`, join the socket to `room:${roomId}`, store `socketPlayers`, emit `ROOM_JOINED`, and emit `ROOM_UPDATED` to the room.

In `client/index.ts`, change `/create` to require `/create <roomName> <playerName>`, connect the socket if needed, and emit `RoomRequestEvent.CREATE_ROOM` instead of calling HTTP.

- [ ] **Step 6: Run verification**

Run:

```bash
npm test -- server/api/room/room.service.spec.ts
npm run check
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add shared/room-contract.ts server/api/room/room.service.ts server/api/room/room.controller.ts server/api/room/room.gateway.ts server/api/room/room.service.spec.ts client/index.ts
git commit -m "feat: join creator when creating room"
```

---

### Task 2: Shared Game Contract

**Files:**
- Create: `shared/game-contract.ts`

**Interfaces:**
- Produces:
  - `GameRequestEvent`, `GameResponseEvent`
  - `GameCommand`, `GameCommandType`
  - `GameView`, `PublicGamerView`, `PrivateGamerView`
  - `GameErrorCode`, `GameCommandResult`

- [ ] **Step 1: Create compile-time contract tests through TypeScript**

No runtime test is needed for pure types. The verification is `npm run check` after creating the contract.

- [ ] **Step 2: Add `shared/game-contract.ts`**

```ts
import type { ActionType, Card, Phase } from "../server/game-engine/types";

export const GameRequestEvent = {
  START_GAME: "startGame",
  SUBMIT_GAME_COMMAND: "submitGameCommand",
  REQUEST_GAME_STATE: "requestGameState",
  CHAT: "chat",
} as const;
export type GameRequestEvent = (typeof GameRequestEvent)[keyof typeof GameRequestEvent];

export const GameResponseEvent = {
  GAME_STATE_UPDATED: "gameStateUpdated",
  GAME_ERROR: "gameError",
  CHAT_RECEIVED: "chatReceived",
} as const;
export type GameResponseEvent = (typeof GameResponseEvent)[keyof typeof GameResponseEvent];

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
export type GameCommandType = (typeof GameCommandType)[keyof typeof GameCommandType];

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
  phase: Phase;
  turnPlayerId: number | null;
  players: PublicGamerView[];
  private: PrivateGamerView | null;
  pendingAction: { type: ActionType; actorId: number; targetId?: number } | null;
  pendingBlock: { blockerId: number; card: Card } | null;
  pendingDecision: { type: string; playerId: number; cardCount?: number } | null;
  events: GameEventView[];
  winnerId: number | null;
};

export type GameEventView = {
  type: string;
  playerCount?: number;
  actorId?: number;
  targetId?: number;
  actionType?: ActionType;
  card?: Card;
  playerId?: number;
  winnerId?: number;
  remainingInfluence?: number;
};

export type GameCommandResult =
  | { ok: true; view: GameView }
  | { ok: false; errorCode: GameErrorCode };
```

- [ ] **Step 3: Run verification**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add shared/game-contract.ts
git commit -m "feat: add shared game contract"
```

---

### Task 3: Engine Snapshot And Test Helper

**Files:**
- Modify: `server/game-engine/index.ts`
- Create: `server/game-engine/test-utils.ts`
- Modify: `server/game-engine/tests/game-engine.spec.ts`

**Interfaces:**
- Produces:
  - `Game.getState(): GameState` returns a cloned snapshot.
  - `mutateGameForTest(game: Game, mutator: (state: GameState) => void): void`

- [ ] **Step 1: Write failing snapshot test**

Add to `server/game-engine/tests/game-engine.spec.ts`:

```ts
test("getState returns a snapshot that cannot mutate the running game", () => {
  const snapshot = game.getState();
  snapshot.gamers[0]!.coin = 99;

  expect(game.getState().gamers[0]!.coin).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server/game-engine/tests/game-engine.spec.ts`

Expected: FAIL because `getState()` currently returns the internal object.

- [ ] **Step 3: Implement cloned state**

In `server/game-engine/index.ts`:

```ts
getState(): GameState {
  return structuredClone(this.gameState) as GameState;
}
```

Add a private method for internal reads if needed:

```ts
private getMutableState(): GameState {
  return this.gameState;
}
```

- [ ] **Step 4: Add test helper**

Create `server/game-engine/test-utils.ts`:

```ts
import Game from "./index";
import type { GameState } from "./types";

export function mutateGameForTest(
  game: Game,
  mutator: (state: GameState) => void,
): void {
  const unsafeGame = game as unknown as { gameState: GameState };
  mutator(unsafeGame.gameState);
}
```

- [ ] **Step 5: Replace direct test mutations**

In `game-engine.spec.ts`, replace each direct `game.getState()` mutation with:

```ts
mutateGameForTest(game, (state) => {
  state.gamers[0]!.coin = 10;
});
```

- [ ] **Step 6: Run verification**

Run:

```bash
npm test -- server/game-engine/tests/game-engine.spec.ts
npm run check
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add server/game-engine/index.ts server/game-engine/test-utils.ts server/game-engine/tests/game-engine.spec.ts
git commit -m "test: isolate game state mutation"
```

---

### Task 4: Structured Engine Events And Rule Coverage

**Files:**
- Modify: `server/game-engine/types.ts`
- Modify: `server/game-engine/index.ts`
- Modify: `server/game-engine/tests/game-engine.spec.ts`

**Interfaces:**
- Produces:
  - `GameEventType`
  - `GameEvent`
  - `GameState.events: GameEvent[]`

- [ ] **Step 1: Add failing event test**

Add:

```ts
test("records structured events for game start and turn start", () => {
  const state = game.getState();

  expect(state.events).toEqual([
    { type: "GAME_STARTED", playerCount: 4 },
    { type: "TURN_STARTED", playerId: 1 },
  ]);
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- server/game-engine/tests/game-engine.spec.ts`

Expected: FAIL because `events` does not exist.

- [ ] **Step 3: Add event types**

In `types.ts`, add:

```ts
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
  | { type: "ACTION_DECLARED"; actorId: number; actionType: ActionType; targetId?: number }
  | { type: "ACTION_BLOCKED"; blockerId: number }
  | { type: "INFLUENCE_LOST"; playerId: number; remainingInfluence: number }
  | { type: "GAME_FINISHED"; winnerId: number };
```

Change `GameState`:

```ts
events: GameEvent[];
```

- [ ] **Step 4: Replace history writes with events**

In `index.ts`, replace `gameHistory` initialization and pushes with `events`. Push `ACTION_DECLARED` in `act`, `ACTION_BLOCKED` in `finishBlockedAction`, `INFLUENCE_LOST` in `loseCards`, and `GAME_FINISHED` in `finishIfWinner`.

- [ ] **Step 5: Add player count tests**

Add:

```ts
test("rejects games with fewer than two players", () => {
  const shortGame = new Game([{ id: 1, name: "solo" }]);

  expect(() => shortGame.start()).toThrow("need 2-6 players");
});

test("rejects games with more than six players", () => {
  const manyPlayers = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    name: `p${index + 1}`,
  }));
  const largeGame = new Game(manyPlayers);

  expect(() => largeGame.start()).toThrow("need 2-6 players");
});
```

- [ ] **Step 6: Implement player count validation**

In `start()`:

```ts
if (this.players.length < 2 || this.players.length > 6) {
  throw new Error("need 2-6 players");
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
npm test -- server/game-engine/tests/game-engine.spec.ts
npm run check
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add server/game-engine/types.ts server/game-engine/index.ts server/game-engine/tests/game-engine.spec.ts
git commit -m "feat: add structured game events"
```

---

### Task 5: Server Game Presenter

**Files:**
- Create: `server/api/room/game-presenter.ts`
- Create: `server/api/room/game-presenter.spec.ts`

**Interfaces:**
- Consumes: `GameState`, `GameView`.
- Produces: `presentGameView(roomId: number, selfPlayerId: number, state: GameState, debug: boolean): GameView`

- [ ] **Step 1: Write presenter tests**

Create `game-presenter.spec.ts`:

```ts
import { describe, expect, test } from "vitest";

import { Card, Phase, type GameState } from "../../game-engine/types";
import { presentGameView } from "./game-presenter";

const state: GameState = {
  events: [],
  gamers: [
    { id: 1, name: "해중", coin: 2, deck: [Card.DUKE, Card.CAPTAIN], isAlive: true },
    { id: 2, name: "성준", coin: 3, deck: [Card.ASSASSIN], isAlive: true },
  ],
  turnGamer: { id: 1, name: "해중", coin: 2, deck: [Card.DUKE, Card.CAPTAIN], isAlive: true },
  phase: Phase.IDLE,
  pendingAction: null,
  pendingBlock: null,
  pendingDecision: null,
  challengePasses: [],
  blockPasses: [],
  blockChallengePasses: [],
  winner: null,
};

describe("presentGameView", () => {
  test("shows only self cards in normal mode", () => {
    const view = presentGameView(0, 1, state, false);

    expect(view.private?.cards).toEqual([Card.DUKE, Card.CAPTAIN]);
    expect(view.players[0]?.cards).toBeUndefined();
    expect(view.players[1]?.cards).toBeUndefined();
  });

  test("shows all cards in debug mode", () => {
    const view = presentGameView(0, 1, state, true);

    expect(view.players[0]?.cards).toEqual([Card.DUKE, Card.CAPTAIN]);
    expect(view.players[1]?.cards).toEqual([Card.ASSASSIN]);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- server/api/room/game-presenter.spec.ts`

Expected: FAIL because presenter does not exist.

- [ ] **Step 3: Implement presenter**

Create `game-presenter.ts`:

```ts
import type { GameView } from "../../../shared/game-contract";
import { DecisionType, type GameState } from "../../game-engine/types";

export function presentGameView(
  roomId: number,
  selfPlayerId: number,
  state: GameState,
  debug: boolean,
): GameView {
  const self = state.gamers.find((gamer) => gamer.id === selfPlayerId) ?? null;

  return {
    roomId,
    selfPlayerId,
    phase: state.phase,
    turnPlayerId: state.turnGamer.id || null,
    players: state.gamers.map((gamer) => ({
      id: gamer.id,
      name: gamer.name,
      coin: gamer.coin,
      isAlive: gamer.isAlive,
      influenceCount: gamer.deck.length,
      ...(debug ? { cards: gamer.deck } : {}),
    })),
    private: self
      ? {
          playerId: self.id,
          cards: self.deck,
          decisionCards:
            state.pendingDecision?.type === DecisionType.EXCHANGE &&
            state.pendingDecision.playerId === self.id
              ? state.pendingDecision.cards
              : undefined,
        }
      : null,
    pendingAction: state.pendingAction,
    pendingBlock: state.pendingBlock,
    pendingDecision: state.pendingDecision
      ? {
          type: state.pendingDecision.type,
          playerId: state.pendingDecision.playerId,
          cardCount: state.pendingDecision.cards?.length,
        }
      : null,
    events: state.events,
    winnerId: state.winner?.id ?? null,
  };
}
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm test -- server/api/room/game-presenter.spec.ts
npm run check
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add server/api/room/game-presenter.ts server/api/room/game-presenter.spec.ts
git commit -m "feat: present per-player game views"
```

---

### Task 6: Server Game Session And Socket Commands

**Files:**
- Modify: `server/api/room/room.service.ts`
- Modify: `server/api/room/room.gateway.ts`
- Modify: `server/api/room/room.service.spec.ts`

**Interfaces:**
- Consumes: `GameCommand`, `GameCommandResult`, `presentGameView`.
- Produces:
  - `RoomService.startGame(roomId: number, playerId: number): GameView[]`
  - `RoomService.submitGameCommand(roomId: number, playerId: number, command: GameCommand): GameView[]`
  - timer-driven auto-pass for challenge phases.

- [ ] **Step 1: Add service tests for start validation**

Add:

```ts
test("only host can start a game with 2-6 players", () => {
  const service = new RoomService();
  const created = service.create("room", "host", "socket-1");
  service.joinRoom({ roomId: created.room.roomId, playerName: "p2" }, "socket-2");

  const views = service.startGame(created.room.roomId, created.playerId);

  expect(views).toHaveLength(2);
  expect(views[0]?.phase).toBe("IDLE");
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- server/api/room/room.service.spec.ts`

Expected: FAIL because game lifecycle does not exist.

- [ ] **Step 3: Add stored game state to rooms**

Extend `StoredRoom`:

```ts
game: Game | null;
timer: NodeJS.Timeout | null;
```

Initialize both in `create`.

- [ ] **Step 4: Implement command dispatch**

Map commands:

```ts
switch (command.type) {
  case GameCommandType.ACT:
    game.act({ type: command.actionType, actorId: playerId, targetId: command.targetId });
    break;
  case GameCommandType.PASS_CHALLENGE:
    game.passChallenge(playerId);
    break;
  case GameCommandType.CHALLENGE:
    game.challenge(playerId);
    break;
  case GameCommandType.PASS_BLOCK:
    game.passBlock(playerId);
    break;
  case GameCommandType.BLOCK:
    game.block(playerId, command.card);
    break;
  case GameCommandType.PASS_BLOCK_CHALLENGE:
    game.passBlockChallenge(playerId);
    break;
  case GameCommandType.CHALLENGE_BLOCK:
    game.challengeBlock(playerId);
    break;
  case GameCommandType.CHOOSE_CARD:
    game.chooseCard(playerId, command.cardIndexes);
    break;
}
```

- [ ] **Step 5: Implement timer scheduling**

After start and every command, call `scheduleTimer(room)`. For `AWAIT_CHALLENGE`, `AWAIT_BLOCK`, and `AWAIT_BLOCK_CHALLENGE`, set a 10 second timeout. In the timeout callback, call the corresponding pass method for eligible players who have not responded, then emit updates through the gateway callback described below.

- [ ] **Step 6: Wire gateway events**

In `room.gateway.ts`, subscribe to `START_GAME`, `SUBMIT_GAME_COMMAND`, and `REQUEST_GAME_STATE`. Return ack results:

```ts
type Ack<T> = (result: T) => void;
```

On success, emit `GAME_STATE_UPDATED` individually to each socket using that player's personalized `GameView`. On rejected commands, emit/ack `GameErrorCode.COMMAND_REJECTED`.

- [ ] **Step 7: Run verification**

Run:

```bash
npm test -- server/api/room/room.service.spec.ts
npm run check
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add server/api/room/room.service.ts server/api/room/room.gateway.ts server/api/room/room.service.spec.ts
git commit -m "feat: add room game sessions"
```

---

### Task 7: Client UI, Command Parser, And Game Menus

**Files:**
- Create: `client/commands.ts`
- Create: `client/game-menu.ts`
- Create: `client/ui/messages.ts`
- Create: `client/ui/render.ts`
- Create: `client/game-menu.spec.ts`
- Modify: `client/index.ts`

**Interfaces:**
- Consumes: `GameView`, `GameCommand`.
- Produces:
  - `parseCliInput(line: string): ParsedInput`
  - `buildGameMenu(view: GameView): MenuItem[]`
  - `renderGameView(view: GameView): string`

- [ ] **Step 1: Write menu tests**

Create `client/game-menu.spec.ts`:

```ts
import { describe, expect, test } from "vitest";

import { ActionType, Phase } from "../server/game-engine/types";
import type { GameView } from "../shared/game-contract";
import { buildGameMenu } from "./game-menu";

const baseView: GameView = {
  roomId: 0,
  selfPlayerId: 1,
  phase: Phase.IDLE,
  turnPlayerId: 1,
  players: [
    { id: 1, name: "me", coin: 2, isAlive: true, influenceCount: 2 },
    { id: 2, name: "you", coin: 2, isAlive: true, influenceCount: 2 },
  ],
  private: { playerId: 1, cards: [] },
  pendingAction: null,
  pendingBlock: null,
  pendingDecision: null,
  events: [],
  winnerId: null,
};

describe("buildGameMenu", () => {
  test("shows actions on my idle turn", () => {
    const menu = buildGameMenu(baseView);

    expect(menu.some((item) => item.command.type === "ACT" && item.command.actionType === ActionType.INCOME)).toBe(true);
    expect(menu.some((item) => item.command.type === "ACT" && item.command.actionType === ActionType.COUP)).toBe(true);
  });

  test("shows no action menu when it is not my turn", () => {
    const menu = buildGameMenu({ ...baseView, selfPlayerId: 2 });

    expect(menu).toEqual([]);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- client/game-menu.spec.ts`

Expected: FAIL because `game-menu.ts` does not exist.

- [ ] **Step 3: Implement menu builder**

Create `client/game-menu.ts`:

```ts
import { ActionType, Card, DecisionType, Phase } from "../server/game-engine/types";
import type { GameCommand, GameView } from "../shared/game-contract";

export type MenuItem = {
  labelKey: string;
  command: GameCommand;
};

export function buildGameMenu(view: GameView): MenuItem[] {
  if (view.winnerId) return [];

  if (view.phase === Phase.IDLE && view.turnPlayerId === view.selfPlayerId) {
    const targets = view.players.filter((player) => player.id !== view.selfPlayerId && player.isAlive);
    return [
      { labelKey: "action.income", command: { type: "ACT", actionType: ActionType.INCOME } },
      { labelKey: "action.foreignAid", command: { type: "ACT", actionType: ActionType.FOREIGN_AID } },
      { labelKey: "action.tax", command: { type: "ACT", actionType: ActionType.TAX } },
      { labelKey: "action.exchange", command: { type: "ACT", actionType: ActionType.EXCHANGE } },
      ...targets.flatMap((target) => [
        { labelKey: `action.coup:${target.name}`, command: { type: "ACT", actionType: ActionType.COUP, targetId: target.id } as GameCommand },
        { labelKey: `action.steal:${target.name}`, command: { type: "ACT", actionType: ActionType.STEAL, targetId: target.id } as GameCommand },
        { labelKey: `action.assassinate:${target.name}`, command: { type: "ACT", actionType: ActionType.ASSASSINATE, targetId: target.id } as GameCommand },
      ]),
    ];
  }

  if (view.phase === Phase.AWAIT_CHALLENGE && view.pendingAction?.actorId !== view.selfPlayerId) {
    return [
      { labelKey: "challenge", command: { type: "CHALLENGE" } },
      { labelKey: "pass", command: { type: "PASS_CHALLENGE" } },
    ];
  }

  if (view.phase === Phase.AWAIT_BLOCK && view.pendingAction?.actorId !== view.selfPlayerId) {
    return [
      { labelKey: "block.duke", command: { type: "BLOCK", card: Card.DUKE } },
      { labelKey: "block.ambassador", command: { type: "BLOCK", card: Card.AMBASSADOR } },
      { labelKey: "block.captain", command: { type: "BLOCK", card: Card.CAPTAIN } },
      { labelKey: "block.contessa", command: { type: "BLOCK", card: Card.CONTESSA } },
      { labelKey: "pass", command: { type: "PASS_BLOCK" } },
    ];
  }

  if (view.phase === Phase.AWAIT_BLOCK_CHALLENGE && view.pendingBlock?.blockerId !== view.selfPlayerId) {
    return [
      { labelKey: "challengeBlock", command: { type: "CHALLENGE_BLOCK" } },
      { labelKey: "pass", command: { type: "PASS_BLOCK_CHALLENGE" } },
    ];
  }

  if (
    view.phase === Phase.AWAIT_DECISION &&
    view.pendingDecision?.playerId === view.selfPlayerId &&
    view.pendingDecision.type === DecisionType.LOSE_CARD
  ) {
    return view.private?.cards.map((_, index) => ({
      labelKey: `choose.selfCard:${index}`,
      command: { type: "CHOOSE_CARD", cardIndexes: [index] },
    })) ?? [];
  }

  return [];
}
```

- [ ] **Step 4: Implement messages and render helpers**

Create `client/ui/messages.ts`:

```ts
import { ActionType, Card } from "../../server/game-engine/types";
import { GameErrorCode, type GameEventView } from "../../shared/game-contract";
import type { MenuItem } from "../game-menu";

export function renderMenuLabel(item: MenuItem): string {
  const [key, value] = item.labelKey.split(":");
  const labels: Record<string, string> = {
    "action.income": "소득 받기 (+1)",
    "action.foreignAid": "외국 원조 받기 (+2)",
    "action.tax": "세금 걷기 (공작 주장, +3)",
    "action.exchange": "교환하기 (대사 주장)",
    "action.coup": `${value} 쿠데타`,
    "action.steal": `${value}에게서 훔치기`,
    "action.assassinate": `${value} 암살`,
    challenge: "도전",
    challengeBlock: "블록 도전",
    pass: "패스",
    "block.duke": "공작으로 블록",
    "block.ambassador": "대사로 블록",
    "block.captain": "선장으로 블록",
    "block.contessa": "귀부인으로 블록",
    "choose.selfCard": `${Number(value) + 1}번 카드 포기`,
  };
  return labels[item.labelKey] ?? labels[key ?? ""] ?? item.labelKey;
}

export function renderError(code: GameErrorCode): string {
  const labels: Record<GameErrorCode, string> = {
    [GameErrorCode.ROOM_NOT_FOUND]: "방을 찾을 수 없습니다.",
    [GameErrorCode.GAME_NOT_STARTED]: "게임이 아직 시작되지 않았습니다.",
    [GameErrorCode.GAME_ALREADY_STARTED]: "이미 시작된 게임입니다.",
    [GameErrorCode.NOT_ROOM_MEMBER]: "이 방의 참가자가 아닙니다.",
    [GameErrorCode.NOT_HOST]: "방장만 시작할 수 있습니다.",
    [GameErrorCode.INVALID_PLAYER_COUNT]: "게임은 2-6명으로 시작할 수 있습니다.",
    [GameErrorCode.INVALID_PHASE]: "지금은 그 행동을 할 수 없습니다.",
    [GameErrorCode.NOT_YOUR_TURN]: "당신의 턴이 아닙니다.",
    [GameErrorCode.NOT_YOUR_DECISION]: "당신이 결정할 차례가 아닙니다.",
    [GameErrorCode.COMMAND_REJECTED]: "명령이 거절되었습니다.",
  };
  return labels[code];
}

export function renderCard(card: Card): string {
  return {
    [Card.DUKE]: "공작",
    [Card.ASSASSIN]: "암살자",
    [Card.CAPTAIN]: "선장",
    [Card.AMBASSADOR]: "대사",
    [Card.CONTESSA]: "귀부인",
  }[card];
}

export function renderAction(action: ActionType): string {
  return {
    [ActionType.INCOME]: "소득",
    [ActionType.FOREIGN_AID]: "외국 원조",
    [ActionType.COUP]: "쿠데타",
    [ActionType.TAX]: "세금",
    [ActionType.STEAL]: "훔치기",
    [ActionType.EXCHANGE]: "교환",
    [ActionType.ASSASSINATE]: "암살",
  }[action];
}

export function renderEvent(event: GameEventView): string {
  if (event.type === "ACTION_DECLARED" && event.actionType) {
    return `${event.actorId}번 플레이어가 ${renderAction(event.actionType)} 행동을 선언했습니다.`;
  }
  if (event.type === "GAME_FINISHED") {
    return `${event.winnerId}번 플레이어가 승리했습니다.`;
  }
  return event.type;
}
```

Create `client/ui/render.ts`:

```ts
import type { GameView } from "../../shared/game-contract";
import type { Room } from "../../shared/room-contract";
import type { MenuItem } from "../game-menu";
import { renderCard, renderEvent, renderMenuLabel } from "./messages";

export function renderRoom(room: Room): string {
  const players = room.players
    .map((player) => `${player.id}. ${player.name} (${player.role})`)
    .join("\n");
  return `[${room.roomId}] ${room.roomName}\n${players || "참가자가 없습니다."}`;
}

export function renderGameView(view: GameView): string {
  const players = view.players
    .map((player) => {
      const cards = player.cards ? ` [${player.cards.map(renderCard).join(", ")}]` : "";
      return `${player.id}. ${player.name} coin=${player.coin} influence=${player.influenceCount}${cards}`;
    })
    .join("\n");
  const myCards = view.private?.cards.map(renderCard).join(", ") ?? "없음";
  const events = view.events.slice(-5).map(renderEvent).join("\n");

  return [
    `phase=${view.phase} turn=${view.turnPlayerId ?? "-"}`,
    players,
    `내 카드: ${myCards}`,
    events,
  ].filter(Boolean).join("\n");
}

export function renderMenu(menu: MenuItem[]): string {
  return menu.map((item, index) => `${index + 1}. ${renderMenuLabel(item)}`).join("\n");
}
```

- [ ] **Step 5: Refactor `client/index.ts`**

Keep readline and socket wiring in `client/index.ts`. On each `GAME_STATE_UPDATED`, save the latest `GameView`, render it, and render `buildGameMenu(view)`. If user enters a number, submit the matching `GameCommand`. If user enters `/status`, re-render latest state.

- [ ] **Step 6: Run verification**

Run:

```bash
npm test -- client/game-menu.spec.ts
npm run check
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add client/index.ts client/commands.ts client/game-menu.ts client/ui/messages.ts client/ui/render.ts client/game-menu.spec.ts
git commit -m "feat: add cli game menus"
```

---

### Task 8: End-To-End Verification And Polish

**Files:**
- Modify only files needed to fix failures found by verification.

**Interfaces:**
- Consumes all previous tasks.
- Produces a verified local multiplayer workflow.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run check
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Run server**

Run: `npm run dev`

Expected: Nest server starts on `http://localhost:3000`.

- [ ] **Step 3: Manual multiplayer smoke test**

Open two or more terminals and run `npm run client`. Verify:

```text
/create test-room 해중
/rooms
/join 0 성준
/start
```

Then play actions through numbered menus until at least one challenge or block path is exercised.

- [ ] **Step 4: Verify debug card visibility**

Restart server:

```bash
DEBUG_GAME=true npm run dev
```

Expected: clients can render all cards through debug state. Restart without `DEBUG_GAME=true` and confirm only self cards render.

- [ ] **Step 5: Commit fixes**

```bash
git status --short
git add shared/game-contract.ts shared/room-contract.ts server client
git commit -m "chore: verify cli coup gameplay"
```
