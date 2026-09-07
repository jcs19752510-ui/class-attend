import { describe, expect, it } from "vitest";
import { assertNotFutureDate, assertValidAttendanceStatus } from "@/lib/attendance";
import { ApiError } from "@/lib/errors";

describe("assertNotFutureDate (att_u3_trd.md §7 확정 — 회귀 테스트)", () => {
  it("accepts today and past dates", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(() => assertNotFutureDate(todayStr)).not.toThrow();
    expect(() => assertNotFutureDate("2000-01-01")).not.toThrow();
  });

  it("rejects a date one day in the future regardless of local timezone", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(() => assertNotFutureDate(tomorrow)).toThrow(ApiError);
  });

  it("rejects an invalid date string", () => {
    expect(() => assertNotFutureDate("not-a-date")).toThrow(ApiError);
  });
});

describe("assertValidAttendanceStatus (att_u3_trd.md §7 확정 — 5종)", () => {
  it("accepts all five documented statuses", () => {
    for (const status of ["present", "absent", "late", "early_leave", "excused_absence"]) {
      expect(() => assertValidAttendanceStatus(status)).not.toThrow();
    }
  });

  it("rejects an undefined status", () => {
    expect(() => assertValidAttendanceStatus("tardy")).toThrow(ApiError);
  });
});
