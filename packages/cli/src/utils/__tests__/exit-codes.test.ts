import { describe, it, expect } from "vitest";
import {
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_VALIDATION_FAILURE,
} from "../exit-codes.js";

describe("exit-codes", () => {
  it("should have EXIT_SUCCESS as 0", () => {
    expect(EXIT_SUCCESS).toBe(0);
  });

  it("should have EXIT_ERROR as 1", () => {
    expect(EXIT_ERROR).toBe(1);
  });

  it("should have EXIT_VALIDATION_FAILURE as 2", () => {
    expect(EXIT_VALIDATION_FAILURE).toBe(2);
  });

  it("should have distinct exit code values", () => {
    const codes = [EXIT_SUCCESS, EXIT_ERROR, EXIT_VALIDATION_FAILURE];
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});
