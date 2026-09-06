import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u1_trd.md §2: POST /branches — franchise_admin 전용 (AC-1)
const createBranchSchema = z.object({
  name: z.string().min(1, "지점명을 입력하세요."),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["franchise_admin"] });
    const body = createBranchSchema.parse(await request.json());

    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({ data: body });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: created.id,
        actionType: "branch.create",
        targetType: "Branch",
        targetId: created.id,
        afterValue: created,
      });
      return created;
    });

    return NextResponse.json({ data: { branchId: branch.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// GET /branches — 지점 id+이름 목록. 학부모가 연결 요청 시 지점을 선택해야
// 하므로 모든 인증된 역할에 열어둔다(민감정보 없음, UI 지원용 추가 —
// AUTO_CONFIRM_CONTENTS.MD 기록).
export async function GET(request: Request) {
  try {
    authenticate(request, {
      allowedRoles: ["franchise_admin", "director", "teacher", "parent"],
    });
    const branches = await prisma.branch.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: branches });
  } catch (err) {
    return toErrorResponse(err);
  }
}
