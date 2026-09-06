import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyToken } from "./auth";
import { prisma } from "./prisma";

export interface CurrentUser {
  userId: string;
  role: "franchise_admin" | "director" | "teacher" | "parent";
  branchId: string | null;
  name: string;
  mustChangePassword: boolean;
}

// 서버 컴포넌트 전용(클라이언트에서 httpOnly 쿠키를 직접 읽을 수 없으므로
// 화면 셸(AppShell)이 이 함수로 로그인 상태를 판단한다).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status === "inactive") return null;

  return {
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
    name: user.name,
    mustChangePassword: user.mustChangePassword,
  };
}
