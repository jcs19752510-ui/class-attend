import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u2_trd.md §2: POST /classes/{id}/teachers — 강사를 반에 배정
// (ADR-002 다대다, 공동수업 허용).
const assignSchema = z.object({ teacherUserId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id: classId } = await params;
    const body = assignSchema.parse(await request.json());

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");
    requireBranchAccess(ctx, cls.branchId);

    const teacher = await prisma.user.findUnique({ where: { id: body.teacherUserId } });
    if (!teacher || teacher.role !== "teacher") {
      throw new ApiError("NOT_FOUND", "강사를 찾을 수 없습니다.");
    }
    requireBranchAccess(ctx, teacher.branchId);

    const existingActive = await prisma.classTeacher.findFirst({
      where: { classId, teacherUserId: teacher.id, unassignedAt: null },
    });
    if (existingActive) {
      throw new ApiError("ALREADY_ASSIGNED", "이미 이 반에 배정된 강사입니다.");
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.classTeacher.create({
        data: { classId, teacherUserId: teacher.id },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: cls.branchId,
        actionType: "class_teacher.assign",
        targetType: "ClassTeacher",
        targetId: created.id,
        afterValue: { classId, teacherUserId: teacher.id },
      });
      return created;
    });

    return NextResponse.json({ data: { assignmentId: assignment.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// GET /classes/{id}/teachers — 현재 배정된 강사 목록(UI 지원용 추가,
// AUTO_CONFIRM_CONTENTS.MD 기록).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "teacher"] });
    const { id: classId } = await params;

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");
    if (ctx.role === "director") requireBranchAccess(ctx, cls.branchId);

    const assignments = await prisma.classTeacher.findMany({
      where: { classId, unassignedAt: null },
      include: { class: false },
    });
    const teacherUserIds = assignments.map((a) => a.teacherUserId);
    const teachers = teacherUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: teacherUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    return NextResponse.json({ data: teachers });
  } catch (err) {
    return toErrorResponse(err);
  }
}
