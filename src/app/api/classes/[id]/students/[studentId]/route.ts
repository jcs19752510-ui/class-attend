import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u2_trd.md §2: DELETE /classes/{id}/students/{student_id}
// 배정 해제 — 물리 삭제 대신 unassignedAt만 채운다(이력 보존, AC-9).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id: classId, studentId } = await params;

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");
    requireBranchAccess(ctx, cls.branchId);

    const active = await prisma.studentClass.findFirst({
      where: { studentId, classId, unassignedAt: null },
    });
    if (!active) {
      throw new ApiError("NOT_FOUND", "활성 배정 기록을 찾을 수 없습니다.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentClass.update({
        where: { id: active.id },
        data: { unassignedAt: new Date() },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: cls.branchId,
        actionType: "class_student.unassign",
        targetType: "StudentClass",
        targetId: active.id,
        beforeValue: { unassignedAt: null },
        afterValue: { unassignedAt: new Date().toISOString() },
      });
    });

    return NextResponse.json({ data: { assignmentId: active.id } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
