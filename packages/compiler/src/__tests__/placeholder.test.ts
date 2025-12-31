import { describe, it, expect } from "vitest";
import { VERSION, LANG_VERSION } from "../index.js";

describe("@workpipe/compiler", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBe("0.0.1");
  });

  it("re-exports LANG_VERSION from @workpipe/lang", () => {
    expect(LANG_VERSION).toBe("0.0.1");
  });
});
