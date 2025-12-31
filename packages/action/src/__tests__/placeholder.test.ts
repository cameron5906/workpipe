import { describe, it, expect } from "vitest";
import { run } from "../index.js";

describe("@workpipe/action", () => {
  it("exports run function", () => {
    expect(typeof run).toBe("function");
  });
});
