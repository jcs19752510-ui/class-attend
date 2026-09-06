import { beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

// 실제 DB 없이 U1 라우트를 테스트하기 위해 Prisma Client를 전역으로 mock한다.
// (개발 환경에 PostgreSQL이 없어도 이 테스트들은 항상 실행 가능하다 —
// 실제 DB 연동 통합 테스트는 docker-compose.yml로 별도 확인 필요.)
vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/email", () => ({
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(async () => {
  const { prisma } = await import("@/lib/prisma");
  const mocked = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
  mockReset(mocked);
  mocked.$transaction.mockImplementation(((cb: unknown) =>
    typeof cb === "function" ? (cb as (tx: unknown) => unknown)(mocked) : cb) as never);
});
