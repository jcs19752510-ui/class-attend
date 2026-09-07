import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

const rejectSchema = z.object({ reason: z.string().optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id } = await params;
    const body = rejectSchema.parse(await request.json().catch(() => ({})));

    const link = await prisma.parentStudentLink.findUnique({ where: { id } });
    if (!link) throw new ApiError("NOT_FOUND", "연결 요청을 찾을 수 없습니다.");
    requireBranchAccess(ctx, link.branchId);

    await prisma.$transaction(async (tx) => {
      await tx.parentStudentLink.update({
        where: { id },
        data: {
          status: "rejected",
          reviewedBy: ctx.userId,
          reviewedAt: new Date(),
          rejectReason: body.reason,
        },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: link.branchId,
        actionType: "parent_link.reject",
        targetType: "ParentStudentLink",
        targetId: id,
        beforeValue: { status: link.status },
        afterValue: { status: "rejected", reason: body.reason },
      });
    });

    return NextResponse.json({ data: { linkRequestId: id, status: "rejected" } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
