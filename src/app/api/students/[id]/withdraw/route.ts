import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u2_trd.md §2: PATCH /students/{id}/withdraw — 퇴원 처리.
// withdrawnAt은 U6(개인정보 생명주기) 보유기간 계산의 시작점이 된다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id } = await params;

    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError("NOT_FOUND", "학생을 찾을 수 없습니다.");
    }
    requireBranchAccess(ctx, existing.branchId);

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: { status: "withdrawn", withdrawnAt: new Date() },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: existing.branchId,
        actionType: "student.withdraw",
        targetType: "Student",
        targetId: id,
        beforeValue: { status: existing.status },
        afterValue: { status: "withdrawn" },
      });
    });

    return NextResponse.json({ data: { studentId: id, status: "withdrawn" } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
