import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface AuditLogInput {
  actorUserId: string;
  branchId?: string | null;
  actionType: string;
  targetType: string;
  targetId: string;
  beforeValue?: unknown;
  afterValue?: unknown;
}

// docs/trd/att_u7_trd.md AC-7: 원본 변경과 감사로그 기록은 같은 트랜잭션
// 안에서 커밋되어야 하므로, 호출자는 반드시 prisma.$transaction(tx => ...)
// 안에서 이 함수에 tx를 넘겨야 한다.
export async function recordAuditLog(tx: Tx, input: AuditLogInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      branchId: input.branchId ?? null,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeValue: (input.beforeValue ?? undefined) as Prisma.InputJsonValue | undefined,
      afterValue: (input.afterValue ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
