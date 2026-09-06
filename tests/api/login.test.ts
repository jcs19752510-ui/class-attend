import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

describe("POST /api/auth/login (att_u1_trd.md AC-4)", () => {
  it("AC-4: rejects login for a deactivated account with 423 ACCOUNT_DEACTIVATED", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "t@example.com",
      name: "강사",
      phone: null,
      role: "teacher",
      branchId: "branch-1",
      status: "inactive",
      mustChangePassword: false,
      createdAt: new Date(),
      passwordHash: await hashPassword("abcd1234"),
    } as never);

    const request = makeRequest("http://test/api/auth/login", {
      body: { email: "t@example.com", password: "abcd1234" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("rejects a wrong password with 401 INVALID_CREDENTIALS", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "t@example.com",
      name: "강사",
      phone: null,
      role: "teacher",
      branchId: "branch-1",
      status: "active",
      mustChangePassword: false,
      createdAt: new Date(),
      passwordHash: await hashPassword("abcd1234"),
    } as never);

    const request = makeRequest("http://test/api/auth/login", {
      body: { email: "t@example.com", password: "wrong-pass" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in successfully and reports mustChangePassword", async () => {
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
      passwordHash: await hashPassword("abcd1234"),
    } as never);

    const request = makeRequest("http://test/api/auth/login", {
      body: { email: "t@example.com", password: "abcd1234" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.mustChangePassword).toBe(true);
    expect(response.headers.get("set-cookie")).toContain("att_session=");
  });
});
