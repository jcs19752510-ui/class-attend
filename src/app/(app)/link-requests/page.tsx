"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface LinkRequest {
  id: string;
  requestedStudentName: string;
  requestedStudentBirthDate: string;
  candidateStudentId: string | null;
  requestedAt: string;
}

export default function LinkRequestsPage() {
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<LinkRequest[]>("/api/directors/link-requests?status=pending").then(
      (res) => res.data && setRequests(res.data),
    );
  }

  useEffect(load, []);

  async function approve(request: LinkRequest) {
    if (!request.candidateStudentId) {
      setMessage("일치하는 학생을 자동으로 찾지 못했습니다 — 이름/생년월일을 직접 확인 후 처리하세요.");
      return;
    }
    const res = await apiFetch(`/api/directors/link-requests/${request.id}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ studentId: request.candidateStudentId }),
    });
    if (res.error) {
      setMessage(`승인 실패: ${res.error.message}`);
      return;
    }
    load();
  }

  async function reject(id: string) {
    const reason = prompt("거부 사유(선택)") ?? undefined;
    const res = await apiFetch(`/api/directors/link-requests/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
    if (res.error) setMessage(`거부 실패: ${res.error.message}`);
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">학부모 연결 승인 대기</h1>
      {message && <p className="mb-3 text-sm text-red-600">{message}</p>}
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
            <div>
              <div className="font-medium">
                {r.requestedStudentName} ({r.requestedStudentBirthDate.slice(0, 10)})
              </div>
              <div className="text-sm text-gray-500">
                {r.candidateStudentId ? "일치하는 학생 후보 발견" : "일치하는 학생을 찾지 못함 — 직접 확인 필요"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => approve(r)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                승인
              </button>
              <button
                onClick={() => reject(r.id)}
                className="rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                거부
              </button>
            </div>
          </li>
        ))}
        {requests.length === 0 && <li className="text-gray-500">대기 중인 요청이 없습니다.</li>}
      </ul>
    </div>
  );
}
