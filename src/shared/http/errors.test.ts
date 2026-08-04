import { describe, expect, it } from "vitest";
import { AppError, toErrorResponse } from "./errors";

describe("errors", () => {
  it("maps an AppError to the single envelope shape", () => {
    const err = new AppError("AUTH_INVALID_CREDENTIALS", "Invalid credentials");

    expect(toErrorResponse(err)).toEqual({
      error: {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials",
      },
    });
  });

  it("includes details when provided", () => {
    const err = new AppError("VALIDATION_ERROR", "Invalid payload", {
      details: { field: "email" },
    });

    expect(toErrorResponse(err)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid payload",
        details: { field: "email" },
      },
    });
  });

  it("omits details entirely when not provided (no `details: undefined` key)", () => {
    const err = new AppError("NOT_FOUND", "Not found");

    expect(Object.keys(toErrorResponse(err).error)).toEqual([
      "code",
      "message",
    ]);
  });

  it("defaults to a 500 status unless overridden", () => {
    expect(new AppError("X", "y").status).toBe(500);
    expect(new AppError("X", "y", { status: 404 }).status).toBe(404);
  });

  it("maps an unrecognized error to a generic envelope without leaking internals", () => {
    const response = toErrorResponse(new Error("some raw internal detail"));

    expect(response).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });

  it("maps a thrown non-Error value to the same generic envelope", () => {
    const response = toErrorResponse("just a string");

    expect(response.error.code).toBe("INTERNAL_ERROR");
  });
});
