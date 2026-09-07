import { describe, expect, it, vi } from "vitest";
import { ApiError, statusForCode, toErrorResponse } from "@/lib/errors";

describe("statusForCode (harness_13_tech_conventions.md §2)", () => {
  it("maps every documented code to the correct HTTP status", () => {
    expect(statusForCode("FORBIDDEN_ROLE")).toBe(403);
    expect(statusForCode("FORBIDDEN_BRANCH")).toBe(403);
    expect(statusForCode("EMAIL_DUPLICATE")).toBe(409);
    expect(statusForCode("INVALID_CREDENTIALS")).toBe(401);
    expect(statusForCode("ACCOUNT_DEACTIVATED")).toBe(423);
    expect(statusForCode("NOT_FOUND")).toBe(404);
  });
});

describe("toErrorResponse", () => {
  it("falls back to 500 INTERNAL_ERROR for unexpected errors without leaking details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = toErrorResponse(new Error("db connection reset"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    spy.mockRestore();
  });

  it("passes ApiError straight through with its own status/code", async () => {
    const response = toErrorResponse(new ApiError("FORBIDDEN_ROLE", "권한 없음"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });
});
