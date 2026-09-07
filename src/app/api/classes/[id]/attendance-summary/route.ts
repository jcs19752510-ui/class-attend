import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { tallyAttendance } from "@/lib/attendance";

// docs/trd/att_u4_trd.md §2: GET /classes/{id}/attendance-summary
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "teacher"] });
    const { id: classId } = await params;
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");

    if (ctx.role === "director") {
      requireBranchAccess(ctx, cls.branchId);
    } else {
      const assigned = await prisma.classTeacher.findFirst({
        where: { classId, teacherUserId: ctx.userId, unassignedAt: null },
      });
      if (!assigned) {
        throw new ApiError("FORBIDDEN_ROLE", "배정되지 않은 반입니다.");
      }
    }

    const activeAssignments = await prisma.studentClass.findMany({
      where: { classId, unassignedAt: null },
      include: { student: true },
    });

    const records = await prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
      },
    });

    const students = activeAssignments.map((assignment) => ({
      studentId: assignment.student.id,
      name: assignment.student.name,
      counts: tallyAttendance(records.filter((record) => record.studentId === assignment.student.id)),
    }));

    return NextResponse.json({ data: { classId, dateFrom, dateTo, students } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
