import { describe, expect, it } from "vitest";
import { GET as getStudentSummary } from "@/app/api/students/[id]/attendance-summary/route";
import { GET as getClassSummary } from "@/app/api/classes/[id]/attendance-summary/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

const BRANCH_1 = "branch-1";
const BRANCH_2 = "branch-2";

describe("GET /api/students/{id}/attendance-summary (att_u4_trd.md AC-1~AC-4, AC-6, AC-7)", () => {
  it("AC-4: teacher is rejected outright with 403 FORBIDDEN_ROLE", async () => {
    const request = makeRequest("http://test/api/students/s1/attendance-summary", {
      method: "GET",
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await getStudentSummary(request, { params: Promise.resolve({ id: "s1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("AC-1: an unlinked parent is rejected with 403 FORBIDDEN_ROLE", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ id: "s1", branchId: BRANCH_1 } as never);
    prismaMock.parentStudentLink.findFirst.mockResolvedValue(null);

    const request = makeRequest("http://test/api/students/s1/attendance-summary", {
      method: "GET",
      user: { userId: "parent-1", role: "parent", branchId: null },
    });

    const response = await getStudentSummary(request, { params: Promise.resolve({ id: "s1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("AC-2 & AC-6: a linked parent gets counts restricted to the date range", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ id: "s1", branchId: BRANCH_1 } as never);
    prismaMock.parentStudentLink.findFirst.mockResolvedValue({ id: "link-1" } as never);
    prismaMock.attendance.findMany.mockResolvedValue([
      { status: "present" },
      { status: "present" },
      { status: "absent" },
    ] as never);

    const request = makeRequest(
      "http://test/api/students/s1/attendance-summary?dateFrom=2026-01-01&dateTo=2026-01-31",
      { method: "GET", user: { userId: "parent-1", role: "parent", branchId: null } },
    );

    const response = await getStudentSummary(request, { params: Promise.resolve({ id: "s1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.counts).toEqual({
      present: 2,
      absent: 1,
      late: 0,
      early_leave: 0,
      excused_absence: 0,
    });
  });

  it("AC-3: director from another branch is rejected with 403 FORBIDDEN_BRANCH", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ id: "s1", branchId: BRANCH_2 } as never);

    const request = makeRequest("http://test/api/students/s1/attendance-summary", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await getStudentSummary(request, { params: Promise.resolve({ id: "s1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_BRANCH");
  });

  it("AC-7: franchise_admin can query regardless of branch", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ id: "s1", branchId: BRANCH_2 } as never);
    prismaMock.attendance.findMany.mockResolvedValue([] as never);

    const request = makeRequest("http://test/api/students/s1/attendance-summary", {
      method: "GET",
      user: { userId: "admin-1", role: "franchise_admin", branchId: null },
    });

    const response = await getStudentSummary(request, { params: Promise.resolve({ id: "s1" }) });

    expect(response.status).toBe(200);
  });
});

describe("GET /api/classes/{id}/attendance-summary (att_u4_trd.md AC-5)", () => {
  it("AC-5: rejects a teacher who is not assigned to the class", async () => {
    prismaMock.class.findUnique.mockResolvedValue({ id: "class-1", branchId: BRANCH_1 } as never);
    prismaMock.classTeacher.findFirst.mockResolvedValue(null);

    const request = makeRequest("http://test/api/classes/class-1/attendance-summary", {
      method: "GET",
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await getClassSummary(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("returns per-student counts for an assigned teacher", async () => {
    prismaMock.class.findUnique.mockResolvedValue({ id: "class-1", branchId: BRANCH_1 } as never);
    prismaMock.classTeacher.findFirst.mockResolvedValue({ id: "ct-1" } as never);
    prismaMock.studentClass.findMany.mockResolvedValue([
      { student: { id: "s1", name: "학생1" } },
      { student: { id: "s2", name: "학생2" } },
    ] as never);
    prismaMock.attendance.findMany.mockResolvedValue([
      { studentId: "s1", status: "present" },
      { studentId: "s2", status: "absent" },
    ] as never);

    const request = makeRequest("http://test/api/classes/class-1/attendance-summary", {
      method: "GET",
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await getClassSummary(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.students).toHaveLength(2);
    expect(body.data.students[0].counts.present).toBe(1);
    expect(body.data.students[1].counts.absent).toBe(1);
  });
});
