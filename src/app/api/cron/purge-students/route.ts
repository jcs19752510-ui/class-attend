import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toErrorResponse, ApiError } from "@/lib/errors";
import { purgeExpiredStudents } from "@/lib/dataLifecycle";

// docs/trd/att_u6_trd.md §2 + harness_09_deployment_runbook.md: Vercel Cron
// Jobs는 설정된 경로로 주기적 GET 요청을 보낸다. 이 엔드포인트는 관리자
// 로그인 세션이 아니라 CRON_SECRET 공유 비밀로만 인증한다(로그인 UI를
// 통하지 않는 시스템 트리거이므로 별도 경로로 분리 — 관리자가 수동으로
// 실행하는 POST /admin/data-lifecycle/purge-students와는 별개).
const SYSTEM_CRON_ACTOR = "system-cron";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      throw new ApiError("INVALID_CREDENTIALS", "유효하지 않은 크론 인증입니다.");
    }

    const purgedCount = await prisma.$transaction((tx) =>
      purgeExpiredStudents(tx, SYSTEM_CRON_ACTOR),
    );

    return NextResponse.json({ data: { purgedCount } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
