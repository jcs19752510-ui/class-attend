import type { PrismaClient } from "@prisma/client";
import type { DeepMockProxy } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";

// tests/setup.ts의 전역 vi.mock("@/lib/prisma") 덕분에 이 값은 실제로는
// DeepMockProxy<PrismaClient>이다. 테스트에서 타입 지원을 받기 위한 캐스팅.
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
