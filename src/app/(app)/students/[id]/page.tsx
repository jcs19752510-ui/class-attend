"use client";

import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface Student {
  id: string;
  name: string;
  birthDate: string;
  studentPhone: string | null;
  guardianPhone: string;
  status: "enrolled" | "withdrawn";
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<Student | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<Student>(`/api/students/${id}`).then((res) => {
      if (res.data) setStudent(res.data);
      if (res.error) setMessage(res.error.message);
    });
  }

  useEffect(load, [id]);

  async function handleWithdraw() {
    if (!confirm("이 학생을 퇴원 처리하시겠습니까?")) return;
    const res = await apiFetch(`/api/students/${id}/withdraw`, { method: "PATCH" });
    if (res.error) {
      setMessage(`퇴원 처리 실패: ${res.error.message}`);
      return;
    }
    setMessage("퇴원 처리되었습니다.");
    load();
  }

  if (!student) return <p className="text-gray-500">{message ?? "불러오는 중..."}</p>;

  return (
    <div className="max-w-md rounded-lg border bg-white p-4">
      <h1 className="mb-4 text-xl font-semibold">{student.name}</h1>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-gray-500">생년월일</dt>
          <dd>{student.birthDate.slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">학생 연락처</dt>
          <dd>{student.studentPhone ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">보호자 연락처</dt>
          <dd>{student.guardianPhone}</dd>
        </div>
        <div>
          <dt className="text-gray-500">상태</dt>
          <dd>{student.status === "enrolled" ? "재원" : "퇴원"}</dd>
        </div>
      </dl>
      {student.status === "enrolled" && (
        <button
          onClick={handleWithdraw}
          className="mt-4 rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          퇴원 처리
        </button>
      )}
      {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
