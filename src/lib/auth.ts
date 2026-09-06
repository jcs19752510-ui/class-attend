import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { ApiError } from "./errors";

// harness/harness_13_tech_conventions.md §3: JWT + httpOnly 쿠키, 만료 24시간
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const JWT_EXPIRES_IN = "24h";
export const AUTH_COOKIE_NAME = "att_session";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  branchId: string | null;
  mustChangePassword: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// att_u1_trd.md §7 확정: 최소 8자, 영문/숫자/특수문자 중 2종류 이상 조합
export function validatePasswordPolicy(password: string): boolean {
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const categories = [hasLetter, hasDigit, hasSpecial].filter(Boolean).length;
  return categories >= 2;
}

// U1 §2: 계정 발급 시 서버가 생성하는 임시 비밀번호. 정책(위 함수)을
// 항상 만족하도록 문자/숫자/특수문자를 각각 포함시켜 생성한다.
export function generateTempPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const pick = (chars: string, count: number) =>
    Array.from({ length: count }, () => chars[Math.floor(Math.random() * chars.length)]).join(
      "",
    );
  const raw = pick(letters, 6) + pick(digits, 3) + pick(special, 1);
  return raw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

export function getAuthContext(request: Request): AuthTokenPayload {
  const token = readCookie(request, AUTH_COOKIE_NAME);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    throw new ApiError("INVALID_CREDENTIALS", "로그인이 필요합니다.");
  }
  return payload;
}

// att_u1_trd.md AC-3: 최초 로그인 후 비밀번호를 변경하기 전까지는
// 로그인/비밀번호 변경 API 외 다른 API 호출이 거부되어야 한다.
export function requirePasswordAlreadyChanged(ctx: AuthTokenPayload): void {
  if (ctx.mustChangePassword) {
    throw new ApiError(
      "PASSWORD_CHANGE_REQUIRED",
      "최초 로그인 시 비밀번호를 변경해야 합니다.",
    );
  }
}

export function requireRole(ctx: AuthTokenPayload, allowed: UserRole[]): void {
  if (!allowed.includes(ctx.role)) {
    throw new ApiError("FORBIDDEN_ROLE", "이 작업을 수행할 권한이 없습니다.");
  }
}

// ADR-001: franchise_admin은 지점 격리 예외. 그 외 role은 자신의 branchId와
// 대상 branchId가 일치해야만 접근을 허용한다.
export function requireBranchAccess(
  ctx: AuthTokenPayload,
  targetBranchId: string | null,
): void {
  if (ctx.role === "franchise_admin") return;
  if (!targetBranchId || ctx.branchId !== targetBranchId) {
    throw new ApiError("FORBIDDEN_BRANCH", "다른 지점의 데이터에 접근할 수 없습니다.");
  }
}

/**
 * 모든 보호된 API 라우트의 공통 진입점.
 * - skipPasswordCheck: 로그인/비밀번호변경 API 자신만 true로 둔다.
 * - allowedRoles: 지정 시 역할 검증까지 함께 수행한다.
 */
export function authenticate(
  request: Request,
  options: { allowedRoles?: UserRole[]; skipPasswordCheck?: boolean } = {},
): AuthTokenPayload {
  const ctx = getAuthContext(request);
  if (!options.skipPasswordCheck) {
    requirePasswordAlreadyChanged(ctx);
  }
  if (options.allowedRoles) {
    requireRole(ctx, options.allowedRoles);
  }
  return ctx;
}
