import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, generateTempPassword, hashPassword, requireBranchAccess, requireRole } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { sendTempPasswordEmail } from "@/lib/email";

// docs/trd/att_u1_trd.md §2: POST /users (role=director/teacher)
// §7 확정: 원장 발급 = franchise_admin만, 강사 발급 = 원장만(자기 지점 한정)
const createStaffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["director", "teacher"]),
  branchId: z.string().min(1, "branchId는 필수입니다."), // AC-5
});

export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["franchise_admin", "director"] });
    const body = createStaffSchema.parse(await request.json());

    if (body.role === "director") {
      requireRole(ctx, ["franchise_admin"]);
    } else {
      requireRole(ctx, ["director"]);
      requireBranchAccess(ctx, body.branchId); // AC-8: 타 지점 발급 시도 차단
    }

    const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
    if (!branch) {
      throw new ApiError("NOT_FOUND", "지점을 찾을 수 없습니다.");
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          phone: body.phone,
          role: body.role,
          branchId: body.branchId,
          passwordHash,
          mustChangePassword: true,
        },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: body.branchId,
        actionType: "user.create",
        targetType: "User",
        targetId: created.id,
        afterValue: { email: created.email, role: created.role, branchId: created.branchId },
      });
      return created;
    });

    await sendTempPasswordEmail(user.email, tempPassword);

    return NextResponse.json({ data: { userId: user.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// GET /users?role=teacher|director — UI의 배정/계정 목록 화면에 필요해
// 추가함(원 TRD 표에는 없었으나 조회 전용, AUTO_CONFIRM_CONTENTS.MD 기록).
// director는 자기 지점만, franchise_admin은 branchId 쿼리로 선택.
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "franchise_admin"] });
    const url = new URL(request.url);
    const role = url.searchParams.get("role") ?? undefined;
    const queryBranchId = url.searchParams.get("branchId") ?? undefined;

    const branchId = ctx.role === "director" ? ctx.branchId! : queryBranchId;

    const users = await prisma.user.findMany({
      where: {
        role: role as never,
        branchId,
        status: "active",
      },
      select: { id: true, name: true, email: true, role: true, branchId: true },
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    return toErrorResponse(err);
  }
}
