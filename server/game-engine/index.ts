import { actionMap } from "./action-map";
import type { ActionContext } from "./action-types";
import CourtDeck from "./deck";
import {
  Card,
  DecisionAfter,
  DecisionType,
  Phase,
  type Action,
  type GameState,
  type Gamer,
  type Player,
} from "./types";
import { getGamerById } from "./utils";

export default class Game {
  private gameState: GameState = {
    gameHistory: [],
    gamers: [],
    turnGamer: {} as Gamer,
    phase: Phase.IDLE,
    pendingAction: null,
    pendingBlock: null,
    pendingDecision: null,
    challengePasses: [],
    blockPasses: [],
    blockChallengePasses: [],
    winner: null,
  };
  private courtDeck = new CourtDeck();

  constructor(private players: Player[]) {}

  start(): void {
    if (this.players.length < 2) {
      throw new Error("need at least two players");
    }

    this.gameState = {
      gameHistory: [],
      gamers: this.players.map((info) => ({
        id: info.id,
        name: info.name,
        deck: [this.courtDeck.draw(), this.courtDeck.draw()],
        coin: 2,
        isAlive: true,
      })),
      turnGamer: {} as Gamer,
      phase: Phase.IDLE,
      pendingAction: null,
      pendingBlock: null,
      pendingDecision: null,
      challengePasses: [],
      blockPasses: [],
      blockChallengePasses: [],
      winner: null,
    };

    const firstGamer = this.gameState.gamers[0];
    if (!firstGamer) {
      throw new Error("no first player");
    }

    this.gameState.turnGamer = firstGamer;
    this.gameState.gameHistory.push(
      `${this.gameState.gamers.length}명으로 게임 시작`,
    );
    this.gameState.gameHistory.push(`${firstGamer.name}의 턴`);
  }

  getState(): GameState {
    return this.gameState;
  }

  act(action: Action): void {
    this.assertPhase(Phase.IDLE);
    this.assertCanDeclareAction(action);

    this.gameState.pendingAction = action;
    this.gameState.pendingBlock = null;
    this.gameState.challengePasses = [];
    this.gameState.blockPasses = [];
    this.gameState.blockChallengePasses = [];

    const actionInfo = actionMap[action.type];
    if (actionInfo.cost) {
      this.gameState.turnGamer.coin -= actionInfo.cost;
    }
    actionInfo.onDeclare?.(this.createActionContext(action));

    if (actionInfo.claimedCard) {
      this.gameState.phase = Phase.AWAIT_CHALLENGE;
      return;
    }

    if (actionInfo.block) {
      this.gameState.phase = Phase.AWAIT_BLOCK;
      return;
    }

    this.resolveAction();
  }

  passChallenge(playerId: number): void {
    this.assertPhase(Phase.AWAIT_CHALLENGE);
    this.assertAlive(playerId);
    const action = this.requirePendingAction();
    if (playerId === action.actorId) {
      throw new Error("actor cannot pass challenge");
    }

    this.addPass(this.gameState.challengePasses, playerId);
    if (this.everyonePassed(this.challengeEligibleIds())) {
      this.afterActionChallengePassed();
    }
  }

  challenge(challengerId: number): void {
    this.assertPhase(Phase.AWAIT_CHALLENGE);
    this.assertAlive(challengerId);

    const action = this.requirePendingAction();
    if (challengerId === action.actorId) {
      throw new Error("actor cannot challenge self");
    }

    const claimedCard = actionMap[action.type].claimedCard;
    if (!claimedCard) {
      throw new Error("action is not challengeable");
    }

    const actor = getGamerById(this.gameState.gamers, action.actorId);
    if (actor.deck.includes(claimedCard)) {
      this.replaceRevealedCard(actor, claimedCard);
      this.requireLoseCard(challengerId, DecisionAfter.ACTION_CONTINUES);
      return;
    }

    this.requireLoseCard(action.actorId, DecisionAfter.END_TURN);
  }

  passBlock(playerId: number): void {
    this.assertPhase(Phase.AWAIT_BLOCK);
    this.assertBlockEligible(playerId);

    this.addPass(this.gameState.blockPasses, playerId);
    if (this.everyonePassed(this.blockEligibleIds())) {
      this.resolveAction();
    }
  }

  block(blockerId: number, card: Card): void {
    this.assertPhase(Phase.AWAIT_BLOCK);
    this.assertBlockEligible(blockerId);

    const action = this.requirePendingAction();
    const actionInfo = actionMap[action.type];
    if (!actionInfo.block?.cards.includes(card)) {
      throw new Error("card cannot block action");
    }

    this.gameState.pendingBlock = { blockerId, card };
    this.gameState.blockChallengePasses = [];
    this.gameState.phase = Phase.AWAIT_BLOCK_CHALLENGE;
    this.gameState.gameHistory.push(
      `${getGamerById(this.gameState.gamers, blockerId).name} block`,
    );
  }

  passBlockChallenge(playerId: number): void {
    this.assertPhase(Phase.AWAIT_BLOCK_CHALLENGE);
    this.assertAlive(playerId);
    const block = this.requirePendingBlock();
    if (playerId === block.blockerId) {
      throw new Error("blocker cannot pass block challenge");
    }

    this.addPass(this.gameState.blockChallengePasses, playerId);
    if (this.everyonePassed(this.blockChallengeEligibleIds())) {
      this.finishBlockedAction();
    }
  }

  challengeBlock(challengerId: number): void {
    this.assertPhase(Phase.AWAIT_BLOCK_CHALLENGE);
    this.assertAlive(challengerId);

    const block = this.requirePendingBlock();
    if (challengerId === block.blockerId) {
      throw new Error("blocker cannot challenge self");
    }

    const blocker = getGamerById(this.gameState.gamers, block.blockerId);
    if (blocker.deck.includes(block.card)) {
      this.replaceRevealedCard(blocker, block.card);
      this.requireLoseCard(challengerId, DecisionAfter.ACTION_BLOCKED);
      return;
    }

    this.requireLoseCard(block.blockerId, DecisionAfter.ACTION_SUCCEEDS);
  }

  chooseCard(playerId: number, cardIndexes: number[]): void {
    this.assertPhase(Phase.AWAIT_DECISION);
    const decision = this.gameState.pendingDecision;
    if (!decision) {
      throw new Error("no pending decision");
    }
    if (decision.playerId !== playerId) {
      throw new Error("not this player's decision");
    }

    if (decision.type === DecisionType.LOSE_CARD) {
      this.loseCards(playerId, cardIndexes, 1);
      const after = decision.after;
      this.gameState.pendingDecision = null;
      this.continueAfterDecision(after);
      return;
    }

    this.exchangeCards(playerId, cardIndexes, decision.cards ?? []);
    const after = decision.after;
    this.gameState.pendingDecision = null;
    this.continueAfterDecision(after);
  }

  nextTurn(): void {
    if (this.finishIfWinner()) {
      return;
    }

    const gamers = this.gameState.gamers;
    const currentGamer = this.requireTurnGamer();
    const currentPlayerIndex = gamers.findIndex(
      (gamer) => gamer.id === currentGamer.id,
    );

    if (currentPlayerIndex === -1) {
      throw new Error("no current gamer in game state");
    }

    for (let offset = 1; offset <= gamers.length; offset += 1) {
      const nextIndex = (currentPlayerIndex + offset) % gamers.length;
      const nextGamer = gamers[nextIndex];

      if (nextGamer?.isAlive) {
        this.clearPending();
        this.gameState.phase = Phase.IDLE;
        this.gameState.turnGamer = nextGamer;
        this.gameState.gameHistory.push(`${nextGamer.name}의 턴`);
        return;
      }
    }

    throw new Error("No alive players available for the next turn");
  }

  private assertCanDeclareAction(action: Action): void {
    const actor = this.requireTurnGamer();
    if (actor.id !== action.actorId) {
      throw new Error("not this player's turn");
    }
    if (!actor.isAlive) {
      throw new Error("dead player cannot act");
    }
    const actionInfo = actionMap[action.type];
    if (actor.coin >= 10 && !actionInfo.isForcedAction) {
      throw new Error("must coup");
    }

    if (actionInfo.targetRequired) {
      if (!action.targetId) {
        throw new Error("target is required");
      }
      if (action.targetId === action.actorId) {
        throw new Error("cannot target self");
      }
      const target = getGamerById(this.gameState.gamers, action.targetId);
      if (!target.isAlive) {
        throw new Error("target is dead");
      }
    }

    if (actionInfo.cost && actor.coin < actionInfo.cost) {
      throw new Error("not enough coins");
    }
  }

  private afterActionChallengePassed(): void {
    const action = this.requirePendingAction();
    if (!actionMap[action.type].block) {
      this.resolveAction();
      return;
    }
    this.gameState.phase = Phase.AWAIT_BLOCK;
  }

  private resolveAction(): void {
    const action = this.requirePendingAction();
    const actionInfo = actionMap[action.type];
    const result = actionInfo.onSuccess(this.createActionContext(action));

    if (result?.pendingDecision) {
      this.gameState.phase = Phase.AWAIT_DECISION;
      this.gameState.pendingDecision = result.pendingDecision;
      return;
    }

    this.gameState.phase = Phase.ACTION_RESOLVED;
    this.nextTurn();
  }

  private finishBlockedAction(): void {
    const action = this.requirePendingAction();
    actionMap[action.type].onBlocked?.(this.createActionContext(action));
    this.gameState.gameHistory.push("action blocked");
    this.nextTurn();
  }

  private continueAfterDecision(after: DecisionAfter): void {
    if (this.finishIfWinner()) {
      return;
    }

    if (after === DecisionAfter.ACTION_CONTINUES) {
      this.afterActionChallengePassed();
      return;
    }
    if (after === DecisionAfter.ACTION_SUCCEEDS) {
      this.resolveAction();
      return;
    }
    if (after === DecisionAfter.ACTION_BLOCKED) {
      this.finishBlockedAction();
      return;
    }

    this.nextTurn();
  }

  private requireLoseCard(playerId: number, after: DecisionAfter): void {
    this.gameState.phase = Phase.AWAIT_DECISION;
    this.gameState.pendingDecision = {
      type: DecisionType.LOSE_CARD,
      playerId,
      after,
    };
  }

  private loseCards(
    playerId: number,
    cardIndexes: number[],
    count: number,
  ): void {
    const gamer = getGamerById(this.gameState.gamers, playerId);
    const uniqueIndexes = [...new Set(cardIndexes)];
    if (uniqueIndexes.length !== count) {
      throw new Error(`choose ${count} card`);
    }
    for (const index of uniqueIndexes) {
      if (index < 0 || index >= gamer.deck.length) {
        throw new Error("invalid card index");
      }
    }

    uniqueIndexes
      .sort((a, b) => b - a)
      .forEach((index) => {
        gamer.deck.splice(index, 1);
      });

    if (gamer.deck.length === 0) {
      gamer.isAlive = false;
    }
  }

  private exchangeCards(
    playerId: number,
    cardIndexes: number[],
    cards: Card[],
  ): void {
    const gamer = getGamerById(this.gameState.gamers, playerId);
    const uniqueIndexes = [...new Set(cardIndexes)];
    if (uniqueIndexes.length !== gamer.deck.length) {
      throw new Error(`choose ${gamer.deck.length} cards`);
    }
    for (const index of uniqueIndexes) {
      if (index < 0 || index >= cards.length) {
        throw new Error("invalid card index");
      }
    }

    const selected = uniqueIndexes.map((index) => cards[index]!);
    const returned = cards.filter((_, index) => !uniqueIndexes.includes(index));
    gamer.deck = selected;
    this.courtDeck.putBackMany(returned);
  }

  private replaceRevealedCard(gamer: Gamer, card: Card): void {
    const index = gamer.deck.indexOf(card);
    if (index === -1) {
      throw new Error("card not found");
    }

    gamer.deck.splice(index, 1);
    this.courtDeck.putBack(card);
    gamer.deck.push(this.courtDeck.draw());
  }

  private challengeEligibleIds(): number[] {
    const action = this.requirePendingAction();
    return this.gameState.gamers
      .filter((gamer) => gamer.isAlive && gamer.id !== action.actorId)
      .map((gamer) => gamer.id);
  }

  private blockEligibleIds(): number[] {
    const action = this.requirePendingAction();
    const actionInfo = actionMap[action.type];
    if (actionInfo.block?.scope === "anyone") {
      return this.gameState.gamers
        .filter((gamer) => gamer.isAlive && gamer.id !== action.actorId)
        .map((gamer) => gamer.id);
    }
    if (actionInfo.block?.scope === "target" && action.targetId) {
      const target = getGamerById(this.gameState.gamers, action.targetId);
      return target.isAlive ? [target.id] : [];
    }
    return [];
  }

  private blockChallengeEligibleIds(): number[] {
    const block = this.requirePendingBlock();
    return this.gameState.gamers
      .filter((gamer) => gamer.isAlive && gamer.id !== block.blockerId)
      .map((gamer) => gamer.id);
  }

  private assertBlockEligible(playerId: number): void {
    this.assertAlive(playerId);
    if (!this.blockEligibleIds().includes(playerId)) {
      throw new Error("player cannot block");
    }
  }

  private everyonePassed(eligibleIds: number[]): boolean {
    return eligibleIds.every(
      (id) =>
        this.gameState.challengePasses.includes(id) ||
        this.gameState.blockPasses.includes(id) ||
        this.gameState.blockChallengePasses.includes(id),
    );
  }

  private addPass(passes: number[], playerId: number): void {
    if (!passes.includes(playerId)) {
      passes.push(playerId);
    }
  }

  private createActionContext(action: Action): ActionContext {
    return {
      state: this.gameState,
      action,
      getGamer: (playerId) => getGamerById(this.gameState.gamers, playerId),
      drawCard: () => this.courtDeck.draw(),
      putBackCard: (card) => this.courtDeck.putBack(card),
      putBackCards: (cards) => this.courtDeck.putBackMany(cards),
    };
  }

  private finishIfWinner(): boolean {
    const aliveGamers = this.gameState.gamers.filter((gamer) => gamer.isAlive);
    if (aliveGamers.length === 1) {
      this.clearPending();
      this.gameState.phase = Phase.FINISHED;
      this.gameState.winner = aliveGamers[0]!;
      return true;
    }
    return false;
  }

  private clearPending(): void {
    this.gameState.pendingAction = null;
    this.gameState.pendingBlock = null;
    this.gameState.pendingDecision = null;
    this.gameState.challengePasses = [];
    this.gameState.blockPasses = [];
    this.gameState.blockChallengePasses = [];
  }

  private requirePendingAction(): Action {
    const action = this.gameState.pendingAction;
    if (!action) {
      throw new Error("no pending action");
    }
    return action;
  }

  private requirePendingBlock() {
    const block = this.gameState.pendingBlock;
    if (!block) {
      throw new Error("no pending block");
    }
    return block;
  }

  private requireTurnGamer(): Gamer {
    const turnGamer = this.gameState.turnGamer;
    if (!turnGamer.id) {
      throw new Error("game is not started");
    }
    return turnGamer;
  }

  private assertAlive(playerId: number): void {
    const gamer = getGamerById(this.gameState.gamers, playerId);
    if (!gamer.isAlive) {
      throw new Error("player is dead");
    }
  }

  private assertPhase(phase: Phase): void {
    if (this.gameState.phase !== phase) {
      throw new Error(`expected phase ${phase}`);
    }
  }
}
