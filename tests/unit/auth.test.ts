import { describe, expect, it } from "vitest";
import {
  generateTempPassword,
  hashPassword,
  requireBranchAccess,
  requirePasswordAlreadyChanged,
  requireRole,
  signToken,
  validatePasswordPolicy,
  verifyPassword,
  verifyToken,
} from "@/lib/auth";
import { ApiError } from "@/lib/errors";

describe("validatePasswordPolicy (att_u1_trd.md §7)", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePasswordPolicy("Ab1!")).toBe(false);
  });

  it("rejects passwords with only one character category", () => {
    expect(validatePasswordPolicy("abcdefgh")).toBe(false);
  });

  it("accepts passwords with 8+ chars and 2+ categories", () => {
    expect(validatePasswordPolicy("abcd1234")).toBe(true);
    expect(validatePasswordPolicy("Abcdefg!")).toBe(true);
  });
});

describe("generateTempPassword", () => {
  it("always produces a password that satisfies the policy", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(validatePasswordPolicy(generateTempPassword())).toBe(true);
    }
  });
});

describe("password hashing round-trip", () => {
  it("hashes and verifies correctly", async () => {
    const hash = await hashPassword("abcd1234");
    expect(await verifyPassword("abcd1234", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("JWT round-trip", () => {
  it("signs and verifies a token", () => {
    const token = signToken({
      userId: "u1",
      role: "teacher",
      branchId: "b1",
      mustChangePassword: false,
    });
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ userId: "u1", role: "teacher", branchId: "b1" });
  });

  it("rejects a tampered token", () => {
    expect(verifyToken("not-a-real-token")).toBeNull();
  });
});

describe("requirePasswordAlreadyChanged (AC-3)", () => {
  it("throws PASSWORD_CHANGE_REQUIRED when mustChangePassword is true", () => {
    expect(() =>
      requirePasswordAlreadyChanged({
        userId: "u1",
        role: "teacher",
        branchId: "b1",
        mustChangePassword: true,
      }),
    ).toThrow(ApiError);
  });

  it("does nothing when mustChangePassword is false", () => {
    expect(() =>
      requirePasswordAlreadyChanged({
        userId: "u1",
        role: "teacher",
        branchId: "b1",
        mustChangePassword: false,
      }),
    ).not.toThrow();
  });
});

describe("requireRole (AC-1)", () => {
  it("throws FORBIDDEN_ROLE when role is not allowed", () => {
    expect(() =>
      requireRole(
        { userId: "u1", role: "teacher", branchId: "b1", mustChangePassword: false },
        ["franchise_admin"],
      ),
    ).toThrow(ApiError);
  });
});

describe("requireBranchAccess (ADR-001 / AC-8)", () => {
  it("allows franchise_admin regardless of branch", () => {
    expect(() =>
      requireBranchAccess(
        { userId: "u1", role: "franchise_admin", branchId: null, mustChangePassword: false },
        "b2",
      ),
    ).not.toThrow();
  });

  it("throws FORBIDDEN_BRANCH when branch does not match", () => {
    expect(() =>
      requireBranchAccess(
        { userId: "u1", role: "director", branchId: "b1", mustChangePassword: false },
        "b2",
      ),
    ).toThrow(ApiError);
  });

  it("allows when branch matches", () => {
    expect(() =>
      requireBranchAccess(
        { userId: "u1", role: "director", branchId: "b1", mustChangePassword: false },
        "b1",
      ),
    ).not.toThrow();
  });
});
