import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/change-password/route";
import { hashPassword } from "@/lib/auth";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

describe("POST /api/auth/change-password (att_u1_trd.md AC-3)", () => {
  it("AC-3: succeeds even when mustChangePassword is true (the one allowed exception)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "t@example.com",
      name: "강사",
      phone: null,
      role: "teacher",
      branchId: "branch-1",
      status: "active",
      mustChangePassword: true,
      createdAt: new Date(),
      passwordHash: await hashPassword("temp1234!"),
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const request = makeRequest("http://test/api/auth/change-password", {
      body: { oldPassword: "temp1234!", newPassword: "newPass123!" },
      user: { userId: "user-1", role: "teacher", branchId: "branch-1", mustChangePassword: true },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.mustChangePassword).toBe(false);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ mustChangePassword: false }),
      }),
    );
  });

  it("rejects an incorrect current password with 401 INVALID_CREDENTIALS", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "t@example.com",
      name: "강사",
      phone: null,
      role: "teacher",
      branchId: "branch-1",
      status: "active",
      mustChangePassword: true,
      createdAt: new Date(),
      passwordHash: await hashPassword("temp1234!"),
    } as never);

    const request = makeRequest("http://test/api/auth/change-password", {
      body: { oldPassword: "wrong-old-pass", newPassword: "newPass123!" },
      user: { userId: "user-1", role: "teacher", branchId: "branch-1", mustChangePassword: true },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a new password that violates the policy (§7)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "t@example.com",
      name: "강사",
      phone: null,
      role: "teacher",
      branchId: "branch-1",
      status: "active",
      mustChangePassword: true,
      createdAt: new Date(),
      passwordHash: await hashPassword("temp1234!"),
    } as never);

    const request = makeRequest("http://test/api/auth/change-password", {
      body: { oldPassword: "temp1234!", newPassword: "weak" },
      user: { userId: "user-1", role: "teacher", branchId: "branch-1", mustChangePassword: true },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
