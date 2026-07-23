# CLI Coup Game Design

## Goal

Complete the project as a local multiplayer CLI Coup game. One NestJS server runs the authoritative game, and multiple terminal clients connect through Socket.IO to play one full game with the same rules as Coup.

## Architecture

The server is the source of truth for rooms, players, game state, validation, and timers. The client never mutates game state directly and never trusts its own menu calculation as rule enforcement.

The server sends structured state and error codes only. It does not send Korean UI strings or numbered menu text. The CLI owns all display text, command prompts, menu labels, and error rendering.

Primary boundaries:

- `server/game-engine`: pure Coup rules, no Socket.IO, room, or CLI dependencies.
- `shared/room-contract.ts`: room HTTP/socket contracts.
- `shared/game-contract.ts`: game command, state view, event, and error-code contracts.
- `server/api/room`: room membership, game session ownership, socket handlers, and timers.
- `client/game-menu.ts`: derives the current numbered menu from `GameView`.
- `client/ui/*`: renders Korean CLI messages, errors, events, and status.

## Room Flow

Creating a room must also join the creating player to that room. The create request should include the player name, and the response should identify the created room plus the creator's player id. The creator becomes host. Existing join/leave semantics remain: if the host leaves, host ownership moves to the first remaining player.

## Game Flow

The host starts the game from the room. Valid player count is 2-6. Server commands include `ACT`, `PASS_CHALLENGE`, `CHALLENGE`, `PASS_BLOCK`, `BLOCK`, `PASS_BLOCK_CHALLENGE`, `CHALLENGE_BLOCK`, and `CHOOSE_CARD`.

The server emits `GameView` updates after every accepted command and timer transition. `GameView` contains public state, the receiving player's private cards, pending action/block/decision summaries, and structured events. In normal mode, clients see only their own cards and other players' influence counts. With `DEBUG_GAME=true`, the view can include all player cards for development.

Challenge, block, and block-challenge phases have a 10 second timeout. Players who do not answer before timeout automatically pass. Card-choice decisions do not auto-select cards.

## Engine Changes

`Game.getState()` returns a snapshot, not the internal mutable object. Tests that need precise setup use an explicit test helper instead of mutating production state through `getState()`.

History strings are replaced by structured game events such as `TURN_STARTED`, `ACTION_DECLARED`, `ACTION_BLOCKED`, `INFLUENCE_LOST`, and `GAME_FINISHED`. The CLI renders these events into text.

## Testing And Verification

Engine tests cover Coup rules: player limits, forced coup at 10 coins, challenge outcomes, blockable actions, exchange, assassination cost behavior, and victory. Room/API tests cover create-and-join, host reassignment, game start validation, and command rejection. CLI logic tests cover menu derivation and UI rendering from codes.

Completion requires `npm run check` and `npm test` to pass, plus manual verification with one server and multiple `npm run client` terminals playing a full game.
