import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";

// docs/trd/att_u1_trd.md §2: POST /auth/signup (role=parent) — 학부모
// 셀프 회원가입. §7: 학부모는 branchId 없이 가입(다지점 자녀 지원).
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  // harness_10_data_lifecycle.md §7: 개인정보처리방침 동의 확인(기술적
  // 안전장치 — 실제 약관 내용의 법적 충분성은 별도 법무 검토 필요).
  agreedToPrivacyPolicy: z
    .boolean()
    .refine((v) => v === true, "개인정보처리방침 동의가 필요합니다."),
});

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await request.json());

    if (!validatePasswordPolicy(body.password)) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "비밀번호는 8자 이상이며 영문/숫자/특수문자 중 2종류 이상을 포함해야 합니다.",
      );
    }

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          phone: body.phone,
          role: "parent",
          branchId: null,
          passwordHash,
          mustChangePassword: false, // 본인이 직접 설정한 비밀번호이므로 강제 변경 불필요
          privacyAgreedAt: new Date(),
        },
      });
      await recordAuditLog(tx, {
        actorUserId: created.id,
        branchId: null,
        actionType: "user.create",
        targetType: "User",
        targetId: created.id,
        afterValue: { email: created.email, role: created.role },
      });
      return created;
    });

    return NextResponse.json({ data: { userId: user.id } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
