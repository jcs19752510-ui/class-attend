import { describe, expect, it } from "vitest";
import { POST as assignStudent } from "@/app/api/classes/[id]/students/route";
import { POST as assignTeacher } from "@/app/api/classes/[id]/teachers/route";
import { GET as getRoster } from "@/app/api/classes/[id]/roster/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

const BRANCH_1 = "branch-1";

const CLASS_1 = {
  id: "class-1",
  branchId: BRANCH_1,
  name: "수학반",
  subject: "수학",
  status: "active",
  createdAt: new Date(),
};

describe("POST /api/classes/{id}/students (att_u2_trd.md AC-3, AC-7)", () => {
  it("AC-3: refuses to assign a withdrawn student (409 STUDENT_WITHDRAWN)", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      status: "withdrawn",
    } as never);

    const request = makeRequest("http://test/api/classes/class-1/students", {
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await assignStudent(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("STUDENT_WITHDRAWN");
    expect(prismaMock.studentClass.create).not.toHaveBeenCalled();
  });

  it("AC-7: refuses a duplicate active assignment (409 ALREADY_ASSIGNED)", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      status: "enrolled",
    } as never);
    prismaMock.studentClass.findFirst.mockResolvedValue({ id: "sc-1" } as never);

    const request = makeRequest("http://test/api/classes/class-1/students", {
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await assignStudent(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("ALREADY_ASSIGNED");
  });

  it("succeeds for an enrolled, unassigned student", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      status: "enrolled",
    } as never);
    prismaMock.studentClass.findFirst.mockResolvedValue(null);
    prismaMock.studentClass.create.mockResolvedValue({ id: "sc-1" } as never);

    const request = makeRequest("http://test/api/classes/class-1/students", {
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await assignStudent(request, { params: Promise.resolve({ id: "class-1" }) });

    expect(response.status).toBe(201);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "class_student.assign" }),
      }),
    );
  });
});

describe("POST /api/classes/{id}/teachers", () => {
  it("rejects assigning a non-teacher user", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "director",
      branchId: BRANCH_1,
    } as never);

    const request = makeRequest("http://test/api/classes/class-1/teachers", {
      body: { teacherUserId: "user-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await assignTeacher(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("succeeds for a teacher in the same branch and logs an audit event", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "teacher-1",
      role: "teacher",
      branchId: BRANCH_1,
    } as never);
    prismaMock.classTeacher.findFirst.mockResolvedValue(null);
    prismaMock.classTeacher.create.mockResolvedValue({ id: "ct-1" } as never);

    const request = makeRequest("http://test/api/classes/class-1/teachers", {
      body: { teacherUserId: "teacher-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await assignTeacher(request, { params: Promise.resolve({ id: "class-1" }) });

    expect(response.status).toBe(201);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actionType: "class_teacher.assign" }) }),
    );
  });
});

describe("GET /api/classes/{id}/roster (att_u2_trd.md AC-5, att_u3_trd.md §7 원장 체크 허용)", () => {
  it("AC-5: rejects a teacher who is not assigned to the class", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.classTeacher.findFirst.mockResolvedValue(null);

    const request = makeRequest("http://test/api/classes/class-1/roster", {
      method: "GET",
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await getRoster(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("allows the director to view the roster directly (att_u3_trd.md §7 확정)", async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS_1 as never);
    prismaMock.studentClass.findMany.mockResolvedValue([
      { student: { id: "student-1", name: "학생" } },
    ] as never);

    const request = makeRequest("http://test/api/classes/class-1/roster", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await getRoster(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ studentId: "student-1", name: "학생", attendance: undefined }]);
  });
});
