export type ParsedInput =
  | { type: "rooms" }
  | { type: "create"; roomName: string; playerName: string }
  | { type: "join"; roomId: number; playerName: string }
  | { type: "leave" }
  | { type: "start" }
  | { type: "status" }
  | { type: "help" }
  | { type: "chat"; message: string }
  | { type: "exit" }
  | { type: "menu"; index: number }
  | { type: "invalid"; message: string };

export function parseCliInput(line: string): ParsedInput {
  const trimmed = line.trim();
  const [command, ...args] = trimmed.split(/\s+/).filter(Boolean);

  if (!command) {
    return { type: "invalid", message: "명령을 입력하세요." };
  }

  if (/^\d+$/.test(command)) {
    return { type: "menu", index: Number(command) - 1 };
  }

  if (command === "/rooms") return { type: "rooms" };
  if (command === "/leave") return { type: "leave" };
  if (command === "/start") return { type: "start" };
  if (command === "/status") return { type: "status" };
  if (command === "/help") return { type: "help" };
  if (command === "/exit") return { type: "exit" };

  if (command === "/chat") {
    const message = args.join(" ").trim();
    if (!message) {
      return { type: "invalid", message: "사용법: /chat <message>" };
    }
    return { type: "chat", message };
  }

  if (command === "/create") {
    const roomName = args[0]?.trim() ?? "";
    const playerName = args.slice(1).join(" ").trim();
    if (!roomName || !playerName) {
      return {
        type: "invalid",
        message: "사용법: /create <roomName> <playerName>",
      };
    }
    return { type: "create", roomName, playerName };
  }

  if (command === "/join") {
    const roomId = Number(args[0]);
    const playerName = args.slice(1).join(" ").trim();
    if (!Number.isInteger(roomId) || roomId < 0 || !playerName) {
      return { type: "invalid", message: "사용법: /join <roomId> <playerName>" };
    }
    return { type: "join", roomId, playerName };
  }

  return { type: "invalid", message: `알 수 없는 명령입니다: ${command}` };
}
