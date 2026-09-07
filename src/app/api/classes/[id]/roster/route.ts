import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";

// docs/trd/att_u2_trd.md §2 + docs/trd/att_u3_trd.md §2:
// GET /classes/{id}/roster — director(자기 지점) 또는 배정된 teacher만
// 조회 가능. U3 구현 시 ?date= 파라미터로 기존 출결 상태를 함께 반환하도록
// 확장한다(이 파일은 그 확장을 포함한 최종본).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "teacher"] });
    const { id: classId } = await params;
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? undefined;

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
      where: { classId, unassignedAt: null, student: { status: "enrolled" } },
      include: { student: true },
    });

    let attendanceByStudent = new Map<string, { id: string; status: string }>();
    if (date) {
      const attendances = await prisma.attendance.findMany({
        where: { classId, date: new Date(date) },
      });
      attendanceByStudent = new Map(attendances.map((a) => [a.studentId, { id: a.id, status: a.status }]));
    }

    const roster = activeAssignments.map((assignment) => ({
      studentId: assignment.student.id,
      name: assignment.student.name,
      attendance: date ? attendanceByStudent.get(assignment.student.id) ?? null : undefined,
    }));

    return NextResponse.json({ data: roster });
  } catch (err) {
    return toErrorResponse(err);
  }
}
