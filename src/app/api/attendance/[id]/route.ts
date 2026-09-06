import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { assertValidAttendanceStatus } from "@/lib/attendance";

// docs/trd/att_u3_trd.md §2: PATCH /attendance/{id} — 개별 레코드 정정.
// §7 확정: 정정 마감 기한 없음, 모든 변경은 감사로그에 남는다(AC-6).
const patchSchema = z.object({ status: z.string().min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "teacher"] });
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const status = assertValidAttendanceStatus(body.status);

    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) throw new ApiError("NOT_FOUND", "출결 기록을 찾을 수 없습니다.");

    if (ctx.role === "director") {
      requireBranchAccess(ctx, existing.branchId);
    } else {
      const assigned = await prisma.classTeacher.findFirst({
        where: { classId: existing.classId, teacherUserId: ctx.userId, unassignedAt: null },
      });
      if (!assigned) throw new ApiError("FORBIDDEN_ROLE", "배정되지 않은 반입니다.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendance.update({
        where: { id },
        data: { status, updatedBy: ctx.userId, updatedAt: new Date() },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: existing.branchId,
        actionType: "attendance.update",
        targetType: "Attendance",
        targetId: id,
        beforeValue: { status: existing.status },
        afterValue: { status },
      });
    });

    return NextResponse.json({ data: { attendanceId: id, status } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
