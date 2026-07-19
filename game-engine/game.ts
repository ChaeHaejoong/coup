import { actionMap } from "./actions.js";
import CourtDeck from "./deck.js";
import {
  ActionType,
  Phase,
  type Action,
  type GameState,
  type PlayerInfo,
} from "./types.js";

export default class Game {
  constructor(
    private courtDeck: CourtDeck,
    private gameState: GameState,
  ) {}

  start(playerInfo: PlayerInfo[]): void {
    this.gameState.players = playerInfo.map((info) => ({
      id: info.id,
      name: info.name,
      deck: [this.courtDeck.draw(), this.courtDeck.draw()],
      coin: playerInfo.length > 2 ? 2 : 1,
      isAlive: true,
    }));
    this.gameState.phase = Phase.IDLE;

    const firstPlayer = this.gameState.players[0];
    if (!firstPlayer) {
      throw new Error("Cannot start a game without players");
    }

    this.gameState.gameHistory.push(`${playerInfo.length}명으로 게임 시작`);
    this.gameState.gameHistory.push(`${firstPlayer.name}의 턴`);
    this.gameState.turnPlayer = firstPlayer;
  }

  act(action: Action) {
    this.assertCanDeclareAction(action);
    this.gameState.pendingAction = action;
    this.advanceNextPhaseAfterAct();
    this.canResolvePendingAction();
  }

  challenge() {}

  block() {}

  challengeBlock() {}

  chooseCard(playerId: number, cardIndexes: number[]) {}

  nextTurn(): void {
    this.gameState.phase = Phase.IDLE;
    this.gameState.pendingAction = null;
    this.gameState.pendingDecision = null;

    const currentPlayerIndex = this.gameState.players.findIndex(
      (player) => player.id === this.gameState.turnPlayer.id,
    );

    for (let offset = 1; offset <= this.gameState.players.length; offset += 1) {
      const nextIndex =
        (currentPlayerIndex + offset) % this.gameState.players.length;
      const nextPlayer = this.gameState.players[nextIndex];

      if (nextPlayer?.isAlive) {
        this.gameState.turnPlayer = nextPlayer;
        this.gameState.gameHistory.push(
          `${this.gameState.turnPlayer.name}의 턴`,
        );
        return;
      }
    }

    throw new Error("No alive players available for the next turn");
  }

  private assertCanDeclareAction(action: Action) {}

  private advanceNextPhaseAfterAct() {}

  private isActorActing(actorId) {
    return;
  }
}
