import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";

// docs/trd/att_u7_trd.md §2, §7: GET /audit-logs — director는 자기 지점
// 강제, franchise_admin은 branchId 선택. 원장이 타 지점 지정 시 403.
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "franchise_admin"] });
    const url = new URL(request.url);
    const queryBranchId = url.searchParams.get("branchId") ?? undefined;
    const actionType = url.searchParams.get("actionType") ?? undefined;
    const targetType = url.searchParams.get("targetType") ?? undefined;
    const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
    const dateTo = url.searchParams.get("dateTo") ?? undefined;

    let branchId: string | undefined;
    if (ctx.role === "director") {
      if (queryBranchId && queryBranchId !== ctx.branchId) {
        throw new ApiError("FORBIDDEN_BRANCH", "다른 지점의 감사로그는 조회할 수 없습니다.");
      }
      branchId = ctx.branchId!;
    } else {
      branchId = queryBranchId;
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        branchId,
        actionType,
        targetType,
        occurredAt:
          dateFrom || dateTo
            ? {
                gte: dateFrom ? new Date(dateFrom) : undefined,
                lte: dateTo ? new Date(dateTo) : undefined,
              }
            : undefined,
      },
      orderBy: { occurredAt: "desc" },
    });

    return NextResponse.json({ data: logs });
  } catch (err) {
    return toErrorResponse(err);
  }
}
