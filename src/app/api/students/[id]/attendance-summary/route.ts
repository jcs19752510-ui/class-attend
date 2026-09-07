import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { tallyAttendance } from "@/lib/attendance";

// docs/trd/att_u4_trd.md §2: GET /students/{id}/attendance-summary
// teacher는 allowedRoles에서 제외되어 있어 AC-4가 authenticate()에서
// 자동으로 충족된다.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, {
      allowedRoles: ["director", "franchise_admin", "parent"],
    });
    const { id: studentId } = await params;
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new ApiError("NOT_FOUND", "학생을 찾을 수 없습니다.");

    if (ctx.role === "director") {
      requireBranchAccess(ctx, student.branchId);
    } else if (ctx.role === "parent") {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentUserId: ctx.userId, studentId, status: "approved" },
      });
      if (!link) {
        throw new ApiError("FORBIDDEN_ROLE", "연결되지 않은 학생입니다.");
      }
    }
    // franchise_admin: 조회 전용 역할이므로 지점 무관 항상 허용.

    const records = await prisma.attendance.findMany({
      where: {
        studentId,
        date: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
      },
    });

    return NextResponse.json({
      data: { studentId, dateFrom, dateTo, counts: tallyAttendance(records) },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
