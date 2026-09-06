import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// 부트스트랩 문제: 모든 계정/지점 생성 API가 franchise_admin 로그인을
// 전제하는데, 그 첫 franchise_admin 계정을 만들 방법이 없었다(회원가입은
// parent 전용). 이 시드 스크립트가 최초 1회 franchise_admin 계정을
// 직접 DB에 생성해 이 문제를 해결한다.
//
// 실행: `npm run db:seed` (DATABASE_URL이 가리키는 DB에 실행됨 — 운영 DB
// 대상으로 실행할 때는 SEED_ADMIN_PASSWORD를 반드시 강력한 값으로 지정할 것)
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@class-attend.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] franchise_admin 계정이 이미 존재합니다: ${email} (건너뜀)`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: {
      email,
      name: "본사 관리자",
      role: "franchise_admin",
      branchId: null,
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log(`[seed] franchise_admin 계정 생성 완료: ${admin.email}`);
  console.log(`[seed] 임시 비밀번호: ${password} (최초 로그인 후 반드시 변경하세요)`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "[seed] 경고: SEED_ADMIN_PASSWORD 환경변수를 지정하지 않아 기본값을 사용했습니다. " +
        "운영 DB에 시딩한 경우 즉시 로그인해서 비밀번호를 변경하세요.",
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
