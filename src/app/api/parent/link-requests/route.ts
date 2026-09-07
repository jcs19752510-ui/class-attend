import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u5_trd.md §2: POST /parent/link-requests — 학부모의 연결
// 요청 생성. 매칭 여부는 즉시 알려주지 않는다(개인정보 노출 방지).
const createLinkRequestSchema = z.object({
  branchId: z.string().min(1),
  requestedStudentName: z.string().min(1),
  requestedStudentBirthDate: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["parent"] });
    const body = createLinkRequestSchema.parse(await request.json());

    const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
    if (!branch) throw new ApiError("NOT_FOUND", "지점을 찾을 수 없습니다.");

    const created = await prisma.$transaction(async (tx) => {
      const link = await tx.parentStudentLink.create({
        data: {
          parentUserId: ctx.userId,
          branchId: body.branchId,
          requestedStudentName: body.requestedStudentName,
          requestedStudentBirthDate: new Date(body.requestedStudentBirthDate),
        },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: body.branchId,
        actionType: "parent_link.request",
        targetType: "ParentStudentLink",
        targetId: link.id,
        afterValue: { status: "pending" },
      });
      return link;
    });

    return NextResponse.json({ data: { linkRequestId: created.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
