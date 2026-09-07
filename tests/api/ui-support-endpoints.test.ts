import { describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { GET as getBranches } from "@/app/api/branches/route";
import { GET as getUsers } from "@/app/api/users/route";
import { GET as getClassTeachers } from "@/app/api/classes/[id]/teachers/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

describe("GET /api/auth/me", () => {
  it("returns the current user's profile", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "director-1",
      email: "d@example.com",
      name: "원장",
      role: "director",
      branchId: "branch-1",
      mustChangePassword: false,
    } as never);

    const request = makeRequest("http://test/api/auth/me", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: "branch-1" },
    });

    const response = await getMe(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("원장");
  });

  it("rejects an unauthenticated request", async () => {
    const request = new Request("http://test/api/auth/me");
    const response = await getMe(request);
    expect(response.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const response = await postLogout();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("att_session=;");
  });
});

describe("GET /api/branches (UI 지원용)", () => {
  it("allows a parent to list active branches", async () => {
    prismaMock.branch.findMany.mockResolvedValue([{ id: "b1", name: "지점1" }] as never);

    const request = makeRequest("http://test/api/branches", {
      method: "GET",
      user: { userId: "parent-1", role: "parent", branchId: null },
    });

    const response = await getBranches(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: "b1", name: "지점1" }]);
  });
});

describe("GET /api/users (UI 지원용)", () => {
  it("forces a director's own branch when listing teachers", async () => {
    prismaMock.user.findMany.mockResolvedValue([] as never);

    const request = makeRequest("http://test/api/users?role=teacher", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: "branch-1" },
    });

    await getUsers(request);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: "branch-1", role: "teacher" }) }),
    );
  });
});

describe("GET /api/classes/{id}/teachers (UI 지원용)", () => {
  it("returns the active teacher assignments for a class", async () => {
    prismaMock.class.findUnique.mockResolvedValue({ id: "class-1", branchId: "branch-1" } as never);
    prismaMock.classTeacher.findMany.mockResolvedValue([
      { teacherUserId: "teacher-1" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "teacher-1", name: "강사1", email: "t1@example.com" },
    ] as never);

    const request = makeRequest("http://test/api/classes/class-1/teachers", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: "branch-1" },
    });

    const response = await getClassTeachers(request, { params: Promise.resolve({ id: "class-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: "teacher-1", name: "강사1", email: "t1@example.com" }]);
  });
});
