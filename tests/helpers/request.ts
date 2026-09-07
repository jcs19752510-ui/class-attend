import type { UserRole } from "@prisma/client";
import { AUTH_COOKIE_NAME, signToken } from "@/lib/auth";

export function makeRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    user?: {
      userId: string;
      role: UserRole;
      branchId: string | null;
      mustChangePassword?: boolean;
    };
  } = {},
): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.user) {
    const token = signToken({
      userId: options.user.userId,
      role: options.user.role,
      branchId: options.user.branchId,
      mustChangePassword: options.user.mustChangePassword ?? false,
    });
    headers.set("cookie", `${AUTH_COOKIE_NAME}=${token}`);
  }
  return new Request(url, {
    method: options.method ?? "POST",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
