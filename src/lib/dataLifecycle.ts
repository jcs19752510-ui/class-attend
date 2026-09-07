import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditLog } from "./audit";

// ADR-005(2026-09-06 승인): 퇴원 후 365일 보관 → 개인정보 필드 마스킹.
export const STUDENT_RETENTION_DAYS = 365;

// harness_10_data_lifecycle.md §2-1의 마스킹 대상 필드/값.
const MASKED_NAME = "(파기됨)";
const MASKED_GUARDIAN_PHONE = "(파기됨)";
const MASKED_BIRTH_DATE = new Date("1970-01-01T00:00:00.000Z");

type Db = Prisma.TransactionClient | PrismaClient;

/**
 * 퇴원 후 보유기간(365일)이 지난 학생의 개인정보를 마스킹한다.
 * att_u6_trd.md §3: 행(row) 삭제가 아니라 필드 마스킹만 수행하며,
 * 감사로그에는 마스킹 전 실제 개인정보 값을 남기지 않는다(AC-5).
 */
export async function purgeExpiredStudents(db: Db, actorUserId: string): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STUDENT_RETENTION_DAYS);

  const targets = await db.student.findMany({
    where: { status: "withdrawn", withdrawnAt: { lte: cutoff }, purgedAt: null },
  });

  for (const student of targets) {
    await db.student.update({
      where: { id: student.id },
      data: {
        name: MASKED_NAME,
        studentPhone: null,
        guardianPhone: MASKED_GUARDIAN_PHONE,
        birthDate: MASKED_BIRTH_DATE,
        purgedAt: new Date(),
      },
    });
    await recordAuditLog(db, {
      actorUserId,
      branchId: student.branchId,
      actionType: "student.purge",
      targetType: "Student",
      targetId: student.id,
      // beforeValue/afterValue를 의도적으로 남기지 않는다(AC-5) — 파기의
      // 목적 자체가 PII 제거인데, 영구 보관되는 감사로그에 삭제 전 값을
      // 옮겨 적으면 파기가 무의미해진다.
    });
  }

  return targets.length;
}
