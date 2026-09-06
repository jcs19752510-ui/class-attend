import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, requireBranchAccess } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { assertNotFutureDate, assertValidAttendanceStatus } from "@/lib/attendance";

// docs/trd/att_u3_trd.md §2: POST /attendance (bulk) — 반 전체 출결을 한
// 번에 저장. 이미 존재하는 (student,class,date) 조합은 갱신한다(AC-4).
const bulkSchema = z
  .array(
    z.object({
      studentId: z.string().min(1),
      classId: z.string().min(1),
      date: z.string().min(1),
      status: z.string().min(1),
    }),
  )
  .min(1);

async function assertClassAccess(
  ctx: { role: string; userId: string; branchId: string | null },
  classId: string,
) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new ApiError("NOT_FOUND", "반을 찾을 수 없습니다.");

  if (ctx.role === "director") {
    requireBranchAccess(ctx as Parameters<typeof requireBranchAccess>[0], cls.branchId);
  } else {
    const assigned = await prisma.classTeacher.findFirst({
      where: { classId, teacherUserId: ctx.userId, unassignedAt: null },
    });
    if (!assigned) throw new ApiError("FORBIDDEN_ROLE", "배정되지 않은 반입니다.");
  }
  return cls;
}

export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "teacher"] });
    const items = bulkSchema.parse(await request.json());

    const results: Array<{ studentId: string; classId: string; date: string; attendanceId: string }> = [];

    for (const item of items) {
      const status = assertValidAttendanceStatus(item.status);
      const dateValue = assertNotFutureDate(item.date);
      const cls = await assertClassAccess(ctx, item.classId);

      const student = await prisma.student.findUnique({ where: { id: item.studentId } });
      if (!student) throw new ApiError("NOT_FOUND", "학생을 찾을 수 없습니다.");
      if (student.status === "withdrawn") {
        throw new ApiError("STUDENT_WITHDRAWN", "퇴원 처리된 학생은 출결을 입력할 수 없습니다.");
      }

      const existing = await prisma.attendance.findUnique({
        where: {
          studentId_classId_date: { studentId: item.studentId, classId: item.classId, date: dateValue },
        },
      });

      const attendance = await prisma.$transaction(async (tx) => {
        if (existing) {
          const updated = await tx.attendance.update({
            where: { id: existing.id },
            data: { status, updatedBy: ctx.userId, updatedAt: new Date() },
          });
          await recordAuditLog(tx, {
            actorUserId: ctx.userId,
            branchId: cls.branchId,
            actionType: "attendance.update",
            targetType: "Attendance",
            targetId: updated.id,
            beforeValue: { status: existing.status },
            afterValue: { status },
          });
          return updated;
        }
        const created = await tx.attendance.create({
          data: {
            branchId: cls.branchId,
            studentId: item.studentId,
            classId: item.classId,
            date: dateValue,
            status,
            recordedBy: ctx.userId,
          },
        });
        await recordAuditLog(tx, {
          actorUserId: ctx.userId,
          branchId: cls.branchId,
          actionType: "attendance.create",
          targetType: "Attendance",
          targetId: created.id,
          afterValue: { status },
        });
        return created;
      });

      results.push({
        studentId: item.studentId,
        classId: item.classId,
        date: item.date,
        attendanceId: attendance.id,
      });
    }

    return NextResponse.json({ data: results }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// docs/trd/att_u3_trd.md §2: GET /attendance?class_id=&date= — 체크 직후
// 확인용 목록 조회(상세 통계는 U4 소관).
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "teacher"] });
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");
    const date = url.searchParams.get("date");
    if (!classId || !date) {
      throw new ApiError("VALIDATION_ERROR", "classId와 date는 필수 쿼리 파라미터입니다.");
    }

    await assertClassAccess(ctx, classId);

    const records = await prisma.attendance.findMany({
      where: { classId, date: new Date(date) },
    });

    return NextResponse.json({ data: records });
  } catch (err) {
    return toErrorResponse(err);
  }
}
