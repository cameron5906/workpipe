import { describe, it, expect } from "vitest";
import { VERSION } from "../index.js";

describe("@workpipe/lang", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBe("0.0.1");
  });
});
