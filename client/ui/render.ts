import type { GameView } from "../../shared/game-contract";
import type { Room } from "../../shared/room-contract";
import type { MenuItem } from "../game-menu";
import { renderCard, renderEvent, renderMenuLabel } from "./messages";

export function renderRooms(rooms: Room[]): string {
  if (rooms.length === 0) {
    return "rooms: empty";
  }

  return rooms
    .map((room) => `[${room.roomId}] ${room.roomName} (${room.players.length} 명)`)
    .join("\n");
}

export function renderRoom(room: Room): string {
  const players = room.players
    .map((player) => `${player.id}. ${player.name} (${player.role})`)
    .join("\n");
  return `[${room.roomId}] ${room.roomName}\n${players || "참가자가 없습니다."}`;
}

export function renderGameView(view: GameView): string {
  const players = view.players
    .map((player) => {
      const cards = player.cards
        ? ` [${player.cards.map(renderCard).join(", ")}]`
        : "";
      return `${player.id}. ${player.name} coin=${player.coin} influence=${player.influenceCount}${cards}`;
    })
    .join("\n");
  const myCards = view.private?.cards.map(renderCard).join(", ") ?? "없음";
  const decisionCards = view.private?.decisionCards
    ? `\n선택 카드: ${view.private.decisionCards.map(renderCard).join(", ")}`
    : "";
  const events = view.events.slice(-5).map(renderEvent).join("\n");

  return [
    `phase=${view.phase} turn=${view.turnPlayerId ?? "-"}`,
    players,
    `내 카드: ${myCards}${decisionCards}`,
    events,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderMenu(menu: MenuItem[]): string {
  return menu
    .map((item, index) => `${index + 1}. ${renderMenuLabel(item)}`)
    .join("\n");
}
