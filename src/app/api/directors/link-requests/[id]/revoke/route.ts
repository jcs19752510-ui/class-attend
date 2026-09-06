import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u5_trd.md §7 확정: 승인된 연결의 해제는 원장만 가능(AC-9).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id } = await params;

    const link = await prisma.parentStudentLink.findUnique({ where: { id } });
    if (!link) throw new ApiError("NOT_FOUND", "연결 요청을 찾을 수 없습니다.");
    requireBranchAccess(ctx, link.branchId);

    await prisma.$transaction(async (tx) => {
      await tx.parentStudentLink.update({ where: { id }, data: { status: "revoked" } });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: link.branchId,
        actionType: "parent_link.revoke",
        targetType: "ParentStudentLink",
        targetId: id,
        beforeValue: { status: link.status },
        afterValue: { status: "revoked" },
      });
    });

    return NextResponse.json({ data: { linkRequestId: id, status: "revoked" } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
