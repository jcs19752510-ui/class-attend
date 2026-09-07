import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

// docs/trd/att_u5_trd.md §2: GET /parent/children — 승인된 연결만 반환(AC-4, AC-9)
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["parent"] });

    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: ctx.userId, status: "approved" },
    });
    const studentIds = links.map((link) => link.studentId).filter((id): id is string => !!id);
    const students = studentIds.length
      ? await prisma.student.findMany({ where: { id: { in: studentIds } } })
      : [];

    return NextResponse.json({ data: students });
  } catch (err) {
    return toErrorResponse(err);
  }
}
