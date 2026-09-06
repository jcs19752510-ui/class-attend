import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME, signToken, verifyPassword } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";

// docs/trd/att_u1_trd.md §2: POST /auth/login — AC-4(비활성 계정 차단)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (!user) {
      throw new ApiError("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    if (user.status === "inactive") {
      throw new ApiError("ACCOUNT_DEACTIVATED", "비활성화된 계정입니다.");
    }

    const passwordMatches = await verifyPassword(body.password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      branchId: user.branchId,
      mustChangePassword: user.mustChangePassword,
    });

    const response = NextResponse.json({
      data: { mustChangePassword: user.mustChangePassword },
    });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  } catch (err) {
    return toErrorResponse(err);
  }
}
