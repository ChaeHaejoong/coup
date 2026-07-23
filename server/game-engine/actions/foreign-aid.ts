import type { ActionContext } from "../action-types";

export function foreignAidOnSuccess({ state }: ActionContext): void {
  state.turnGamer.coin += 2;
}
