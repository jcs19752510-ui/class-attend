import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u2_trd.md §2 + §7(2026-09-06 확정): GET /students/{id}는
// personal_data.view 감사로그를 남긴다(목록 조회는 남기지 않음, AC-10).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "franchise_admin"] });
    const { id } = await params;

    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new ApiError("NOT_FOUND", "학생을 찾을 수 없습니다.");
    }
    requireBranchAccess(ctx, student.branchId);

    await recordAuditLog(prisma, {
      actorUserId: ctx.userId,
      branchId: student.branchId,
      actionType: "personal_data.view",
      targetType: "Student",
      targetId: student.id,
    });

    return NextResponse.json({ data: student });
  } catch (err) {
    return toErrorResponse(err);
  }
}

const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  studentPhone: z.string().optional(),
  guardianPhone: z.string().min(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id } = await params;
    const body = updateStudentSchema.parse(await request.json());

    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError("NOT_FOUND", "학생을 찾을 수 없습니다.");
    }
    requireBranchAccess(ctx, existing.branchId);

    await prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id }, data: body });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: existing.branchId,
        actionType: "student.update",
        targetType: "Student",
        targetId: id,
        beforeValue: existing,
        afterValue: body,
      });
    });

    return NextResponse.json({ data: { studentId: id } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
