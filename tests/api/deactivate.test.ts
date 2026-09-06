import { describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/users/[id]/deactivate/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/users/{id}/deactivate (att_u1_trd.md AC-6 + 구현 중 판단근거)", () => {
  it("AC-6: franchise_admin deactivating any user succeeds and logs one audit entry", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "teacher-1",
      email: "t@example.com",
      name: "강사",
      phone: null,
      role: "teacher",
      branchId: "branch-1",
      status: "active",
      mustChangePassword: false,
      createdAt: new Date(),
      passwordHash: "hashed",
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const request = makeRequest("http://test/api/users/teacher-1/deactivate", {
      method: "PATCH",
      user: { userId: "admin-1", role: "franchise_admin", branchId: null },
    });

    const response = await PATCH(request, withParams("teacher-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("inactive");
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "teacher-1" }, data: { status: "inactive" } }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "user.deactivate", targetType: "User" }),
      }),
    );
  });

  it("판단근거: director cannot deactivate a teacher from another branch (403 FORBIDDEN_ROLE)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "teacher-2",
      email: "t2@example.com",
      name: "강사2",
      phone: null,
      role: "teacher",
      branchId: "branch-2",
      status: "active",
      mustChangePassword: false,
      createdAt: new Date(),
      passwordHash: "hashed",
    } as never);

    const request = makeRequest("http://test/api/users/teacher-2/deactivate", {
      method: "PATCH",
      user: { userId: "director-1", role: "director", branchId: "branch-1" },
    });

    const response = await PATCH(request, withParams("teacher-2"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("판단근거: director cannot deactivate another director account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "director-2",
      email: "d2@example.com",
      name: "원장2",
      phone: null,
      role: "director",
      branchId: "branch-1",
      status: "active",
      mustChangePassword: false,
      createdAt: new Date(),
      passwordHash: "hashed",
    } as never);

    const request = makeRequest("http://test/api/users/director-2/deactivate", {
      method: "PATCH",
      user: { userId: "director-1", role: "director", branchId: "branch-1" },
    });

    const response = await PATCH(request, withParams("director-2"));

    expect(response.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
