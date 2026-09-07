import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/branches/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

describe("POST /api/branches (att_u1_trd.md AC-1, AC-6)", () => {
  beforeEach(() => {
    prismaMock.branch.create.mockResolvedValue({
      id: "branch-1",
      name: "테스트 지점",
      address: null,
      phone: null,
      status: "active",
      createdAt: new Date(),
    } as never);
  });

  it("AC-1: rejects non franchise_admin roles with 403 FORBIDDEN_ROLE and does not create a branch", async () => {
    const request = makeRequest("http://test/api/branches", {
      body: { name: "테스트 지점" },
      user: { userId: "director-1", role: "director", branchId: "branch-0" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
    expect(prismaMock.branch.create).not.toHaveBeenCalled();
  });

  it("AC-6: creates the branch and records exactly one audit log entry for franchise_admin", async () => {
    const request = makeRequest("http://test/api/branches", {
      body: { name: "테스트 지점" },
      user: { userId: "admin-1", role: "franchise_admin", branchId: null },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.branchId).toBe("branch-1");
    expect(prismaMock.branch.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "admin-1",
          actionType: "branch.create",
          targetType: "Branch",
          targetId: "branch-1",
        }),
      }),
    );
  });
});
