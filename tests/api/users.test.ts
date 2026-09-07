import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/users/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

const BRANCH_1 = "branch-1";
const BRANCH_2 = "branch-2";

describe("POST /api/users (att_u1_trd.md AC-5, AC-6, AC-8)", () => {
  beforeEach(() => {
    prismaMock.branch.findUnique.mockResolvedValue({
      id: BRANCH_1,
      name: "지점1",
      address: null,
      phone: null,
      status: "active",
      createdAt: new Date(),
    } as never);
    prismaMock.user.create.mockResolvedValue({
      id: "user-1",
      email: "teacher@example.com",
      name: "강사",
      phone: null,
      role: "teacher",
      branchId: BRANCH_1,
      status: "active",
      mustChangePassword: true,
      createdAt: new Date(),
      passwordHash: "hashed",
    } as never);
  });

  it("AC-5: rejects teacher creation with no branchId (422 VALIDATION_ERROR)", async () => {
    const request = makeRequest("http://test/api/users", {
      body: { email: "t@example.com", name: "강사", role: "teacher" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("AC-8: director creating a teacher for another branch gets 403 FORBIDDEN_BRANCH", async () => {
    const request = makeRequest("http://test/api/users", {
      body: {
        email: "t@example.com",
        name: "강사",
        role: "teacher",
        branchId: BRANCH_2,
      },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_BRANCH");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("AC-6: director creating a teacher for their own branch succeeds and logs an audit event", async () => {
    const request = makeRequest("http://test/api/users", {
      body: {
        email: "teacher@example.com",
        name: "강사",
        role: "teacher",
        branchId: BRANCH_1,
      },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.userId).toBe("user-1");
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "user.create", targetType: "User" }),
      }),
    );
  });

  it("§7 확정: only franchise_admin can create director accounts (director attempt -> 403 FORBIDDEN_ROLE)", async () => {
    const request = makeRequest("http://test/api/users", {
      body: {
        email: "director2@example.com",
        name: "원장2",
        role: "director",
        branchId: BRANCH_1,
      },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });
});
