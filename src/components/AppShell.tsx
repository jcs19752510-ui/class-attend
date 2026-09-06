import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";

const ROLE_LABELS: Record<CurrentUser["role"], string> = {
  franchise_admin: "본사 관리자",
  director: "원장",
  teacher: "강사",
  parent: "학부모",
};

const NAV_BY_ROLE: Record<CurrentUser["role"], { href: string; label: string }[]> = {
  franchise_admin: [
    { href: "/admin/branches", label: "지점 관리" },
    { href: "/admin/audit-logs", label: "감사로그" },
    { href: "/admin/data-lifecycle", label: "개인정보 파기" },
  ],
  director: [
    { href: "/students", label: "학생 관리" },
    { href: "/classes", label: "반 관리" },
    { href: "/attendance", label: "출결 체크" },
    { href: "/reports", label: "출결 통계" },
    { href: "/link-requests", label: "학부모 연결 승인" },
    { href: "/admin/audit-logs", label: "감사로그" },
  ],
  teacher: [
    { href: "/attendance", label: "출결 체크" },
    { href: "/reports", label: "출결 통계" },
  ],
  parent: [{ href: "/parent/children", label: "자녀 출결" }],
};

export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const navItems = NAV_BY_ROLE[user.role];

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold">
              class-attend
            </Link>
            <nav className="flex gap-4 text-sm">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="text-gray-600 hover:text-gray-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
