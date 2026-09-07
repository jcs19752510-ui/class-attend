import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/signup/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

describe("POST /api/auth/signup (att_u1_trd.md AC-2, AC-7 일부)", () => {
  it("AC-2: duplicate email results in 409 EMAIL_DUPLICATE", async () => {
    prismaMock.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.22.0",
      }),
    );

    const request = makeRequest("http://test/api/auth/signup", {
      body: {
        email: "parent@example.com",
        password: "abcd1234",
        name: "학부모",
        agreedToPrivacyPolicy: true,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("EMAIL_DUPLICATE");
  });

  it("rejects a password that violates the policy before hitting the database", async () => {
    const request = makeRequest("http://test/api/auth/signup", {
      body: {
        email: "parent2@example.com",
        password: "weak",
        name: "학부모",
        agreedToPrivacyPolicy: true,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it(
    "AC-7 (가입 부분만): parent signup succeeds with branchId=null " +
      "— 자녀 0명 조회 부분은 U5(GET /parent/children) 구현 후 별도 검증 필요",
    async () => {
      prismaMock.user.create.mockResolvedValue({
        id: "parent-1",
        email: "parent3@example.com",
        name: "학부모",
        phone: null,
        role: "parent",
        branchId: null,
        status: "active",
        mustChangePassword: false,
        createdAt: new Date(),
        passwordHash: "hashed",
      } as never);

      const request = makeRequest("http://test/api/auth/signup", {
        body: {
          email: "parent3@example.com",
          password: "abcd1234",
          name: "학부모",
          agreedToPrivacyPolicy: true,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.userId).toBe("parent-1");
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: null, role: "parent" }) }),
      );
    },
  );

  it("harness_10 §7: rejects signup without privacy policy agreement (422 VALIDATION_ERROR)", async () => {
    const request = makeRequest("http://test/api/auth/signup", {
      body: {
        email: "parent4@example.com",
        password: "abcd1234",
        name: "학부모",
        agreedToPrivacyPolicy: false,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});
