import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u2_trd.md §2: POST /classes/{id}/students — 학생을 반에 배정
// (ADR-002 다대다). AC-3(퇴원 학생 배정 차단), AC-7(중복 배정 차단).
const assignSchema = z.object({ studentId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id: classId } = await params;
    const body = assignSchema.parse(await request.json());

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");
    requireBranchAccess(ctx, cls.branchId);

    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) throw new ApiError("NOT_FOUND", "학생을 찾을 수 없습니다.");
    requireBranchAccess(ctx, student.branchId);

    if (student.status === "withdrawn") {
      throw new ApiError("STUDENT_WITHDRAWN", "퇴원 처리된 학생은 반에 배정할 수 없습니다.");
    }

    const existingActive = await prisma.studentClass.findFirst({
      where: { studentId: student.id, classId, unassignedAt: null },
    });
    if (existingActive) {
      throw new ApiError("ALREADY_ASSIGNED", "이미 이 반에 배정된 학생입니다.");
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.studentClass.create({
        data: { studentId: student.id, classId },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: cls.branchId,
        actionType: "class_student.assign",
        targetType: "StudentClass",
        targetId: created.id,
        afterValue: { studentId: student.id, classId },
      });
      return created;
    });

    return NextResponse.json({ data: { assignmentId: assignment.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
