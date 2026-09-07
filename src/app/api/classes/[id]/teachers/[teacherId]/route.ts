import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; teacherId: string }> },
) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id: classId, teacherId } = await params;

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");
    requireBranchAccess(ctx, cls.branchId);

    const active = await prisma.classTeacher.findFirst({
      where: { classId, teacherUserId: teacherId, unassignedAt: null },
    });
    if (!active) {
      throw new ApiError("NOT_FOUND", "활성 배정 기록을 찾을 수 없습니다.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.classTeacher.update({
        where: { id: active.id },
        data: { unassignedAt: new Date() },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: cls.branchId,
        actionType: "class_teacher.unassign",
        targetType: "ClassTeacher",
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
