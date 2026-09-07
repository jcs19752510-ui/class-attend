import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { purgeExpiredStudents } from "@/lib/dataLifecycle";

// docs/trd/att_u6_trd.md §2: POST /admin/data-lifecycle/purge-students
// franchise_admin 전용(AC-4). 실 배포에서 스케줄러가 이 엔드포인트를
// 주기적으로 호출하도록 연동하는 것은 harness_09(배포 런북) 소관.
export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["franchise_admin"] });
    const purgedCount = await prisma.$transaction((tx) => purgeExpiredStudents(tx, ctx.userId));
    return NextResponse.json({ data: { purgedCount } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
