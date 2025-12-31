import { describe, it, expect } from "vitest";

describe("extension", () => {
  it("should export activate function", async () => {
    const extension = await import("../extension.js");
    expect(typeof extension.activate).toBe("function");
  });

  it("should export deactivate function", async () => {
    const extension = await import("../extension.js");
    expect(typeof extension.deactivate).toBe("function");
  });
});
