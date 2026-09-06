import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  authenticate,
  hashPassword,
  signToken,
  validatePasswordPolicy,
  verifyPassword,
} from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";

// docs/trd/att_u1_trd.md §2: POST /auth/change-password — AC-3의 유일한
// 예외 경로이므로 skipPasswordCheck: true로 인증한다.
const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string(),
});

export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { skipPasswordCheck: true });
    const body = changePasswordSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user) {
      throw new ApiError("INVALID_CREDENTIALS", "로그인이 필요합니다.");
    }

    const oldMatches = await verifyPassword(body.oldPassword, user.passwordHash);
    if (!oldMatches) {
      throw new ApiError("INVALID_CREDENTIALS", "현재 비밀번호가 올바르지 않습니다.");
    }
    if (!validatePasswordPolicy(body.newPassword)) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "비밀번호는 8자 이상이며 영문/숫자/특수문자 중 2종류 이상을 포함해야 합니다.",
      );
    }

    const newPasswordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash, mustChangePassword: false },
    });

    const token = signToken({
      userId: user.id,
      role: user.role,
      branchId: user.branchId,
      mustChangePassword: false,
    });

    const response = NextResponse.json({ data: { mustChangePassword: false } });
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
