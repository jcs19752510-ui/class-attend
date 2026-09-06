"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface Student {
  id: string;
  name: string;
  birthDate: string;
  guardianPhone: string;
  status: "enrolled" | "withdrawn";
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({
    name: "",
    birthDate: "",
    studentPhone: "",
    guardianPhone: "",
    guardianConsent: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<Student[]>("/api/students").then((res) => {
      if (res.data) setStudents(res.data);
    });
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const res = await apiFetch("/api/students", { method: "POST", body: JSON.stringify(form) });
    setSubmitting(false);
    if (res.error) {
      setMessage(`등록 실패: ${res.error.message}`);
      return;
    }
    setMessage("학생이 등록되었습니다.");
    setForm({ name: "", birthDate: "", studentPhone: "", guardianPhone: "", guardianConsent: false });
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">학생 관리</h1>

      <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <label className="flex flex-col text-sm">
          이름
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          생년월일
          <input
            required
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          학생 연락처(선택)
          <input
            value={form.studentPhone}
            onChange={(e) => setForm({ ...form, studentPhone: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          보호자 연락처
          <input
            required
            value={form.guardianPhone}
            onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="col-span-full flex items-center gap-2 text-sm">
          <input
            required
            type="checkbox"
            checked={form.guardianConsent}
            onChange={(e) => setForm({ ...form, guardianConsent: e.target.checked })}
          />
          보호자로부터 개인정보 수집·이용 동의를 확인했습니다(
          <a href="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
            처리방침 보기
          </a>
          ). 학생이 만 14세 미만이면 법정대리인 동의가 필요합니다.
        </label>
        <div className="col-span-full">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "학생 등록"}
          </button>
          {message && <span className="ml-3 text-sm text-gray-600">{message}</span>}
        </div>
      </form>

      <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="px-3 py-2">이름</th>
            <th className="px-3 py-2">생년월일</th>
            <th className="px-3 py-2">보호자 연락처</th>
            <th className="px-3 py-2">상태</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-3 py-2">{s.name}</td>
              <td className="px-3 py-2">{s.birthDate.slice(0, 10)}</td>
              <td className="px-3 py-2">{s.guardianPhone}</td>
              <td className="px-3 py-2">{s.status === "enrolled" ? "재원" : "퇴원"}</td>
              <td className="px-3 py-2">
                <Link href={`/students/${s.id}`} className="text-blue-600 hover:underline">
                  상세
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
