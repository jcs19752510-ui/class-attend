import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u2_trd.md §2: POST /students — director 전용, branch_id는
// 요청자 지점으로 서버가 강제 설정한다(AC-2, 입력값은 무시).
const createStudentSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().min(1, "생년월일을 입력하세요."),
  studentPhone: z.string().optional(),
  guardianPhone: z.string().min(1, "보호자 연락처는 필수입니다."),
  // harness_10_data_lifecycle.md §7: 미성년자 개인정보 수집 전 보호자 동의
  // 확인을 시스템에 남긴다(법률 검토를 대체하지 않는 기술적 안전장치).
  guardianConsent: z
    .boolean()
    .refine((v) => v === true, "보호자의 개인정보 수집·이용 동의 확인이 필요합니다."),
});

export async function POST(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const body = createStudentSchema.parse(await request.json());

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          branchId: ctx.branchId!,
          name: body.name,
          birthDate: new Date(body.birthDate),
          studentPhone: body.studentPhone,
          guardianPhone: body.guardianPhone,
          guardianConsentAt: new Date(),
        },
      });
      await recordAuditLog(tx, {
        actorUserId: ctx.userId,
        branchId: ctx.branchId,
        actionType: "student.create",
        targetType: "Student",
        targetId: created.id,
        afterValue: { name: created.name, branchId: created.branchId },
      });
      return created;
    });

    return NextResponse.json({ data: { studentId: student.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// GET /students — 목록 조회. director는 자기 지점 강제, franchise_admin은
// branchId 쿼리로 선택(§7: 목록 조회는 감사로그 대상 아님).
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director", "franchise_admin"] });
    const url = new URL(request.url);
    const queryBranchId = url.searchParams.get("branchId") ?? undefined;

    let branchId: string | undefined;
    if (ctx.role === "director") {
      branchId = ctx.branchId!;
    } else {
      branchId = queryBranchId;
    }

    if (ctx.role !== "franchise_admin" && !branchId) {
      throw new ApiError("FORBIDDEN_BRANCH", "지점 정보가 없습니다.");
    }

    const students = await prisma.student.findMany({
      where: branchId ? { branchId } : undefined,
      orderBy: { enrolledAt: "desc" },
    });

    return NextResponse.json({ data: students });
  } catch (err) {
    return toErrorResponse(err);
  }
}
