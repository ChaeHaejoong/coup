import { Card } from "./types.js";

export default class CourtDeck {
  private deck: Card[];

  constructor(cards?: Card[]) {
    this.deck = cards ? [...cards] : this.createCourtDeck();
    if (!cards) {
      this.shuffle();
    }
  }

  private createCourtDeck(): Card[] {
    return [
      ...new Array(3).fill(Card.DUKE),
      ...new Array(3).fill(Card.CAPTAIN),
      ...new Array(3).fill(Card.ASSASSIN),
      ...new Array(3).fill(Card.CONTESSA),
      ...new Array(3).fill(Card.AMBASSADOR),
    ];
  }

  private shuffle(): void {
    this.deck.sort(() => Math.random() - 0.5);
  }

  draw(): Card {
    const card = this.deck.pop();

    if (!card) {
      throw new Error("Court deck is empty");
    }

    return card;
  }

  putBack(card: Card): void {
    this.deck.push(card);
    this.shuffle();
  }

  putBackMany(cards: Card[]): void {
    this.deck.push(...cards);
    this.shuffle();
  }
}
