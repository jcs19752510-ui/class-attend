import { describe, expect, it } from "vitest";
import { POST as postAttendance, GET as getAttendance } from "@/app/api/attendance/route";
import { PATCH as patchAttendance } from "@/app/api/attendance/[id]/route";
import * as attendanceRoute from "@/app/api/attendance/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

const BRANCH_1 = "branch-1";
const CLASS_1 = { id: "class-1", branchId: BRANCH_1, name: "수학반", subject: null, status: "active", createdAt: new Date() };

function teacherAssigned() {
  prismaMock.classTeacher.findFirst.mockResolvedValue({ id: "ct-1" } as never);
}

describe("POST /api/attendance (att_u3_trd.md AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-8)", () => {
  it("AC-1: rejects a teacher not assigned to the class", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.classTeacher.findFirst.mockResolvedValue(null);

    const request = makeRequest("http://test/api/attendance", {
      body: [{ studentId: "s1", classId: "class-1", date: "2026-01-01", status: "present" }],
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await postAttendance(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("AC-3: rejects an undefined status value with 422 INVALID_STATUS", async () => {
    const request = makeRequest("http://test/api/attendance", {
      body: [{ studentId: "s1", classId: "class-1", date: "2020-01-01", status: "tardy" }],
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await postAttendance(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("AC-8: rejects a future date with 422 INVALID_DATE", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const request = makeRequest("http://test/api/attendance", {
      body: [{ studentId: "s1", classId: "class-1", date: tomorrow, status: "present" }],
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await postAttendance(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("INVALID_DATE");
  });

  it("AC-5: rejects attendance for a withdrawn student", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.student.findUnique.mockResolvedValue({ id: "s1", status: "withdrawn" } as never);

    const request = makeRequest("http://test/api/attendance", {
      body: [{ studentId: "s1", classId: "class-1", date: "2020-01-01", status: "present" }],
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await postAttendance(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("STUDENT_WITHDRAWN");
  });

  it("AC-2 & AC-4: creates a new record on first save, updates in place on the second (AC-6 audit trail)", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.student.findUnique.mockResolvedValue({ id: "s1", status: "enrolled" } as never);
    prismaMock.attendance.findUnique.mockResolvedValueOnce(null);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-1", status: "present" } as never);

    const firstRequest = makeRequest("http://test/api/attendance", {
      body: [{ studentId: "s1", classId: "class-1", date: "2020-01-01", status: "present" }],
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });
    const firstResponse = await postAttendance(firstRequest);
    expect(firstResponse.status).toBe(201);
    expect(prismaMock.attendance.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();

    prismaMock.attendance.findUnique.mockResolvedValueOnce({
      id: "att-1",
      status: "present",
    } as never);
    prismaMock.attendance.update.mockResolvedValue({ id: "att-1", status: "absent" } as never);

    const secondRequest = makeRequest("http://test/api/attendance", {
      body: [{ studentId: "s1", classId: "class-1", date: "2020-01-01", status: "absent" }],
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });
    const secondResponse = await postAttendance(secondRequest);
    expect(secondResponse.status).toBe(201);
    expect(prismaMock.attendance.create).toHaveBeenCalledTimes(1); // still just once
    expect(prismaMock.attendance.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "attendance.update",
          beforeValue: { status: "present" },
          afterValue: { status: "absent" },
        }),
      }),
    );
  });

  it("AC-7: no DELETE route exists for /api/attendance", () => {
    expect((attendanceRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });
});

describe("PATCH /api/attendance/{id} (att_u3_trd.md AC-6, §7 마감 없음)", () => {
  it("allows a teacher assigned to the class to correct a record", async () => {
    teacherAssigned();
    prismaMock.attendance.findUnique.mockResolvedValue({
      id: "att-1",
      branchId: BRANCH_1,
      classId: "class-1",
      status: "present",
    } as never);
    prismaMock.attendance.update.mockResolvedValue({ id: "att-1", status: "late" } as never);

    const request = makeRequest("http://test/api/attendance/att-1", {
      method: "PATCH",
      body: { status: "late" },
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await patchAttendance(request, { params: Promise.resolve({ id: "att-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("late");
  });
});

describe("GET /api/attendance", () => {
  it("requires classId and date query parameters", async () => {
    const request = makeRequest("http://test/api/attendance", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await getAttendance(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
