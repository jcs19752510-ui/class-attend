import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u5_trd.md §2/§5: PATCH /directors/link-requests/{id}/approve
// AC-2(타 지점 차단), AC-3(지점 불일치 학생), AC-5(중복 연결), AC-6(퇴원 학생)
const approveSchema = z.object({ studentId: z.string().min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id } = await params;
    const body = approveSchema.parse(await request.json());

    const link = await prisma.parentStudentLink.findUnique({ where: { id } });
    if (!link) throw new ApiError("NOT_FOUND", "연결 요청을 찾을 수 없습니다.");
    requireBranchAccess(ctx, link.branchId);

    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student || student.branchId !== link.branchId) {
      throw new ApiError("INVALID_STUDENT", "지정한 학생이 이 지점 소속이 아닙니다.");
    }
    if (student.status === "withdrawn") {
      throw new ApiError("STUDENT_WITHDRAWN", "퇴원 처리된 학생은 연결할 수 없습니다.");
    }

    const alreadyLinked = await prisma.parentStudentLink.findFirst({
      where: {
        parentUserId: link.parentUserId,
        studentId: body.studentId,
        status: "approved",
        NOT: { id: link.id },
      },
    });
    if (alreadyLinked) {
      throw new ApiError("ALREADY_LINKED", "이미 연결된 학부모-학생 조합입니다.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.parentStudentLink.update({
        where: { id },
        data: {
          status: "approved",
          studentId: body.studentId,
          reviewedBy: ctx.userId,
          reviewedAt: new Date(),
        },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: link.branchId,
        actionType: "parent_link.approve",
        targetType: "ParentStudentLink",
        targetId: id,
        beforeValue: { status: link.status },
        afterValue: { status: "approved", studentId: body.studentId },
      });
    });

    return NextResponse.json({ data: { linkRequestId: id, status: "approved" } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
