import { describe, expect, it } from "vitest";
import { GET as getStudentDetail } from "@/app/api/students/[id]/route";
import { POST as createStudent } from "@/app/api/students/route";
import * as studentDetailRoute from "@/app/api/students/[id]/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

const BRANCH_1 = "branch-1";
const BRANCH_2 = "branch-2";

describe("POST /api/students (att_u2_trd.md AC-1, AC-2, AC-6)", () => {
  it("AC-1: rejects non-director roles with 403 FORBIDDEN_ROLE", async () => {
    const request = makeRequest("http://test/api/students", {
      body: {
        name: "학생",
        birthDate: "2015-01-01",
        guardianPhone: "010-0000-0000",
        guardianConsent: true,
      },
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await createStudent(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
    expect(prismaMock.student.create).not.toHaveBeenCalled();
  });

  it("AC-2 & AC-6: director's branchId is forced onto the student, and one audit log is recorded", async () => {
    prismaMock.student.create.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      name: "학생",
      birthDate: new Date("2015-01-01"),
      studentPhone: null,
      guardianPhone: "010-0000-0000",
      status: "enrolled",
      enrolledAt: new Date(),
      withdrawnAt: null,
    } as never);

    const request = makeRequest("http://test/api/students", {
      body: {
        name: "학생",
        birthDate: "2015-01-01",
        guardianPhone: "010-0000-0000",
        guardianConsent: true,
      },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await createStudent(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.studentId).toBe("student-1");
    expect(prismaMock.student.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: BRANCH_1 }) }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "student.create", targetType: "Student" }),
      }),
    );
  });

  it("harness_10 §7: rejects registration without guardian consent (422 VALIDATION_ERROR)", async () => {
    const request = makeRequest("http://test/api/students", {
      body: {
        name: "학생",
        birthDate: "2015-01-01",
        guardianPhone: "010-0000-0000",
        guardianConsent: false,
      },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await createStudent(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.student.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/students/{id} (att_u2_trd.md AC-4, AC-10)", () => {
  it("AC-4: blocks access to a student from another branch with 403 FORBIDDEN_BRANCH", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-2",
      branchId: BRANCH_2,
      name: "학생2",
      birthDate: new Date("2015-01-01"),
      studentPhone: null,
      guardianPhone: "010-1111-1111",
      status: "enrolled",
      enrolledAt: new Date(),
      withdrawnAt: null,
    } as never);

    const request = makeRequest("http://test/api/students/student-2", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await getStudentDetail(request, { params: Promise.resolve({ id: "student-2" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_BRANCH");
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("AC-10: logs exactly one personal_data.view event on detail lookup", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      name: "학생",
      birthDate: new Date("2015-01-01"),
      studentPhone: null,
      guardianPhone: "010-0000-0000",
      status: "enrolled",
      enrolledAt: new Date(),
      withdrawnAt: null,
    } as never);

    const request = makeRequest("http://test/api/students/student-1", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await getStudentDetail(request, { params: Promise.resolve({ id: "student-1" }) });

    expect(response.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "personal_data.view", targetType: "Student" }),
      }),
    );
  });

  it("AC-8: no physical delete route exists for students", () => {
    expect((studentDetailRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
