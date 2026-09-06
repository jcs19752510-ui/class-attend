"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function DataLifecyclePage() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runPurge() {
    if (!confirm("퇴원 후 365일이 지난 학생의 개인정보를 마스킹 처리합니다. 계속할까요?")) return;
    setRunning(true);
    setMessage(null);
    const res = await apiFetch<{ purgedCount: number }>("/api/admin/data-lifecycle/purge-students", {
      method: "POST",
    });
    setRunning(false);
    if (res.error) {
      setMessage(`실행 실패: ${res.error.message}`);
      return;
    }
    setMessage(`완료 — ${res.data?.purgedCount ?? 0}명의 개인정보가 마스킹되었습니다.`);
  }

  return (
    <div className="max-w-lg rounded-lg border bg-white p-4">
      <h1 className="mb-2 text-xl font-semibold">개인정보 생명주기</h1>
      <p className="mb-4 text-sm text-gray-600">
        퇴원(withdrawnAt) 후 365일이 지난 학생의 이름·연락처·생년월일을
        마스킹 처리합니다(ADR-005). 실제 운영에서는 매일 03:00(KST)에
        자동 실행되도록 크론이 이미 설정되어 있습니다(
        <code className="rounded bg-gray-100 px-1">vercel.json</code>) — 이
        버튼은 수동 확인/즉시 실행용입니다.
      </p>
      <button
        onClick={runPurge}
        disabled={running}
        className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
      >
        {running ? "실행 중..." : "지금 실행"}
      </button>
      {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
