import { describe, expect, test } from "vitest";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  test("returns the API health message", () => {
    const controller = new AppController(new AppService());

    expect(controller.getHealth()).toEqual({ status: "ok" });
  });
});
