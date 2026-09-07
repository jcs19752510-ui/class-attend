export const metadata = { title: "개인정보처리방침 | class-attend" };

// 초안 — docs/legal/privacy_policy_draft.md와 내용을 동기화해서 유지할 것.
// [대괄호] 항목은 법무 검토·사업자 확정 후 실제 값으로 교체 필요.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-gray-800">
      <h1 className="mb-2 text-xl font-semibold">개인정보처리방침</h1>
      <p className="mb-6 rounded-md bg-amber-50 p-3 text-amber-800">
        이 문서는 초안이며, 법무 검토 및 사업자 정보 확정 전까지는 실제
        서비스 약관으로 사용되지 않습니다.
      </p>

      <section className="mb-5">
        <h2 className="mb-1 font-semibold">제1조 (개인정보의 처리 목적)</h2>
        <p>학원 출결 관리, 이용자 식별 및 인증, 학부모-학생 연계 서비스 제공, 민원 처리를 위해 개인정보를 처리합니다.</p>
      </section>

      <section className="mb-5">
        <h2 className="mb-1 font-semibold">제2조 (처리하는 개인정보의 항목)</h2>
        <ul className="list-disc pl-5">
          <li>학생: 이름, 생년월일, 학생 연락처(선택), 보호자 연락처, 소속 지점·반</li>
          <li>학부모(회원): 이메일, 이름, 연락처(선택), 비밀번호(암호화 저장)</li>
          <li>원장·강사: 이메일, 이름, 연락처(선택)</li>
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="mb-1 font-semibold">제3조 (개인정보의 처리 및 보유 기간)</h2>
        <p>학생 개인정보는 퇴원 처리일로부터 365일간 보유 후 마스킹 처리됩니다. 학부모 회원 정보는 회원 탈퇴 시까지 보유합니다.</p>
      </section>

      <section className="mb-5">
        <h2 className="mb-1 font-semibold">제7조 (만 14세 미만 아동의 개인정보 처리)</h2>
        <p>
          학생 등록 시 보호자(법정대리인)의 동의를 지점 담당자가 확인하며, 이 확인 사실과 시각을 시스템에 기록합니다. 개인정보는 목적 달성에
          필요한 최소한의 범위로만 수집합니다.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="mb-1 font-semibold">제8조 (개인정보의 파기절차 및 방법)</h2>
        <p>보유기간 경과 시 개인정보 항목을 마스킹 처리합니다(행 삭제 아님, 출결 통계 연속성을 위함). 파기 이력은 별도로 기록하되 파기된 개인정보의 실제 값은 남기지 않습니다.</p>
      </section>

      <section className="mb-5">
        <h2 className="mb-1 font-semibold">제9조 (개인정보의 안전성 확보조치)</h2>
        <ul className="list-disc pl-5">
          <li>비밀번호는 암호화(bcrypt)하여 저장</li>
          <li>지점 간 데이터 접근 격리</li>
          <li>역할별 접근 권한 제한</li>
          <li>개인정보 조회·수정·파기 이력 기록</li>
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="mb-1 font-semibold">제10조 (개인정보 보호책임자)</h2>
        <p className="text-gray-500">[담당자 성명/직책/연락처 — 사업자 확정 후 기재]</p>
      </section>

      <p className="mt-8 text-xs text-gray-400">
        전체 조항은 <code>docs/legal/privacy_policy_draft.md</code> 참고 · 초안 v0.1 · 2026-09-06
      </p>
    </main>
  );
}
