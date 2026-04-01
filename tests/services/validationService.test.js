const { describe, it, expect } = require("vitest");
const { requireConfirmation, ensureArray, ensureObject } = require("../../services/validationService");

describe("validationService", () => {
  it("throws when confirmation is missing", () => {
    expect(() => requireConfirmation({}, "confirm")).toThrow("confirm");
  });

  it("validates arrays", () => {
    expect(() => ensureArray([], "items")).not.toThrow();
    expect(() => ensureArray({}, "items")).toThrow("items must be an array.");
  });

  it("validates objects", () => {
    expect(() => ensureObject({ a: 1 }, "body")).not.toThrow();
    expect(() => ensureObject([], "body")).toThrow("body must be an object.");
  });
});
