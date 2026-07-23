import { ActionType, Card } from "../../server/game-engine/types";
import {
  GameErrorCode,
  type GameEventView,
} from "../../shared/game-contract";
import type { MenuItem } from "../game-menu";

export function renderMenuLabel(item: MenuItem): string {
  const [key, value = ""] = item.labelKey.split(":");
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
    "choose.exchange": `${value
      .split(",")
      .map((index) => Number(index) + 1)
      .join(", ")}번 카드 유지`,
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
  if (event.type === "GAME_STARTED") {
    return `${event.playerCount}명으로 게임을 시작했습니다.`;
  }
  if (event.type === "TURN_STARTED") {
    return `${event.playerId}번 플레이어의 턴입니다.`;
  }
  if (event.type === "ACTION_DECLARED" && event.actionType) {
    return `${event.actorId}번 플레이어가 ${renderAction(event.actionType)} 행동을 선언했습니다.`;
  }
  if (event.type === "ACTION_BLOCKED") {
    return `${event.playerId ?? event.actorId ?? ""}번 플레이어의 행동이 블록되었습니다.`;
  }
  if (event.type === "INFLUENCE_LOST") {
    return `${event.playerId}번 플레이어가 영향력 1개를 잃었습니다.`;
  }
  if (event.type === "GAME_FINISHED") {
    return `${event.winnerId}번 플레이어가 승리했습니다.`;
  }
  return event.type;
}

export function renderHelp(): string {
  return [
    "commands:",
    "/rooms",
    "/create <roomName> <playerName>",
    "/join <roomId> <playerName>",
    "/start",
    "/status",
    "/chat <message>",
    "/leave",
    "/exit",
  ].join("\n");
}
