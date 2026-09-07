import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u2_trd.md §2: POST /classes — director 전용
const createClassSchema = z.object({
  name: z.string().min(1),
  subject: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const body = createClassSchema.parse(await request.json());

    const created = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: { branchId: ctx.branchId!, name: body.name, subject: body.subject },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: ctx.branchId,
        actionType: "class.create",
        targetType: "Class",
        targetId: cls.id,
        afterValue: { name: cls.name, branchId: cls.branchId },
      });
      return cls;
    });

    return NextResponse.json({ data: { classId: created.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// GET /classes — 목록 조회. UI의 반 선택 화면에 필요해 추가함(원 TRD 표에는
// 없었으나 조회 전용이라 스코프 이탈로 보지 않음, AUTO_CONFIRM_CONTENTS.MD 기록).
// director: 자기 지점, teacher: 자신이 배정된 반만, franchise_admin: 전체/선택.
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, {
      allowedRoles: ["director", "teacher", "franchise_admin"],
    });

    if (ctx.role === "teacher") {
      const assignments = await prisma.classTeacher.findMany({
        where: { teacherUserId: ctx.userId, unassignedAt: null },
        include: { class: true },
      });
      return NextResponse.json({ data: assignments.map((a) => a.class) });
    }

    const url = new URL(request.url);
    const branchId =
      ctx.role === "director" ? ctx.branchId! : (url.searchParams.get("branchId") ?? undefined);

    const classes = await prisma.class.findMany({
      where: branchId ? { branchId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: classes });
  } catch (err) {
    return toErrorResponse(err);
  }
}
