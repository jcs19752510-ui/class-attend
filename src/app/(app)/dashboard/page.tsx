import { getCurrentUser } from "@/lib/session";

const QUICK_LINKS: Record<string, { href: string; label: string; desc: string }[]> = {
  franchise_admin: [
    { href: "/admin/branches", label: "지점 관리", desc: "지점 생성, 원장 계정 발급" },
    { href: "/admin/audit-logs", label: "감사로그", desc: "전체 지점 활동 이력 조회" },
    { href: "/admin/data-lifecycle", label: "개인정보 파기", desc: "퇴원 365일 경과 학생 마스킹 배치 실행" },
  ],
  director: [
    { href: "/attendance", label: "출결 체크", desc: "오늘 수업 반의 출결을 입력하세요" },
    { href: "/students", label: "학생 관리", desc: "학생 등록·퇴원 처리" },
    { href: "/classes", label: "반 관리", desc: "반 개설, 학생·강사 배정" },
    { href: "/link-requests", label: "학부모 연결 승인", desc: "대기 중인 연결 요청 확인" },
  ],
  teacher: [
    { href: "/attendance", label: "출결 체크", desc: "담당 반의 출결을 입력하세요" },
    { href: "/reports", label: "출결 통계", desc: "반별 출결 현황 확인" },
  ],
  parent: [{ href: "/parent/children", label: "자녀 출결", desc: "자녀의 출결 현황을 확인하세요" }],
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const links = user ? QUICK_LINKS[user.role] : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">
        {user ? `${user.name}님, 안녕하세요` : "대시보드"}
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-lg border bg-white p-4 shadow-sm hover:border-blue-400 hover:shadow"
          >
            <div className="font-medium">{link.label}</div>
            <div className="mt-1 text-sm text-gray-500">{link.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
