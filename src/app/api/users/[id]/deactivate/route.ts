import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u1_trd.md §2: PATCH /users/{id}/deactivate (ADR-003: 소프트
// 삭제만 존재 — 물리 삭제 API는 만들지 않는다).
// 누가 누구를 비활성화할 수 있는지는 TRD에 명시되지 않아 역할 위계상
// 합리적으로 판단함(판단 근거): franchise_admin은 전체, director는 자기
// 지점 teacher만. 이 가정은 리뷰 시 재확인 필요.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["franchise_admin", "director"] });
    const { id } = await params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new ApiError("NOT_FOUND", "대상 계정을 찾을 수 없습니다.");
    }

    const allowed =
      ctx.role === "franchise_admin" ||
      (ctx.role === "director" && target.role === "teacher" && target.branchId === ctx.branchId);
    if (!allowed) {
      throw new ApiError("FORBIDDEN_ROLE", "이 계정을 비활성화할 권한이 없습니다.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: "inactive" } });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: target.branchId,
        actionType: "user.deactivate",
        targetType: "User",
        targetId: target.id,
        beforeValue: { status: target.status },
        afterValue: { status: "inactive" },
      });
    });

    return NextResponse.json({ data: { userId: id, status: "inactive" } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
