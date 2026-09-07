import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";

// UI 셸(네비게이션 등)이 현재 로그인한 사용자의 role/이름을 알아야 하므로
// 추가한 엔드포인트(JWT가 httpOnly 쿠키라 클라이언트 JS로 직접 못 읽음).
// att_u1_trd.md 원안에는 없었으나 프론트엔드 구현에 필수적인 조회 전용
// API라 스코프 이탈로 보지 않음(AUTO_CONFIRM_CONTENTS.MD 기록).
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, { skipPasswordCheck: true });
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user) {
      throw new ApiError("INVALID_CREDENTIALS", "로그인이 필요합니다.");
    }

    return NextResponse.json({
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
