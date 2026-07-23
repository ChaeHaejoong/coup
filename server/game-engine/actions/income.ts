import type { ActionContext } from "../action-types";

export function incomeOnSuccess({ state }: ActionContext): void {
  state.turnGamer.coin += 1;
}
