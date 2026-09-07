import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const { id } = await params;
    const body = updateClassSchema.parse(await request.json());

    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");
    }
    requireBranchAccess(ctx, existing.branchId);

    await prisma.$transaction(async (tx) => {
      await tx.class.update({ where: { id }, data: body });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: existing.branchId,
        actionType: "class.update",
        targetType: "Class",
        targetId: id,
        beforeValue: existing,
        afterValue: body,
      });
    });

    return NextResponse.json({ data: { classId: id } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
