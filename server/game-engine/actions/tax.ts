import type { ActionContext } from "../action-types";

export function taxOnSuccess({ state }: ActionContext): void {
  state.turnGamer.coin += 3;
}
