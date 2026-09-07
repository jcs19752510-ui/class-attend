"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface Child {
  id: string;
  name: string;
}
interface BranchOption {
  id: string;
  name: string;
}
interface Summary {
  counts: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  present: "출석",
  absent: "결석",
  late: "지각",
  early_leave: "조퇴",
  excused_absence: "사유결석",
};

export default function ParentChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [form, setForm] = useState({
    branchId: "",
    requestedStudentName: "",
    requestedStudentBirthDate: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<Child[]>("/api/parent/children").then(async (res) => {
      if (!res.data) return;
      setChildren(res.data);
      const entries = await Promise.all(
        res.data.map(async (child) => {
          const summary = await apiFetch<Summary>(`/api/students/${child.id}/attendance-summary`);
          return [child.id, summary.data] as const;
        }),
      );
      setSummaries(Object.fromEntries(entries.filter(([, v]) => v)) as Record<string, Summary>);
    });
  }

  useEffect(() => {
    load();
    apiFetch<BranchOption[]>("/api/branches").then((res) => {
      if (res.data) {
        setBranches(res.data);
        if (res.data.length > 0) setForm((f) => ({ ...f, branchId: res.data![0].id }));
      }
    });
  }, []);

  async function submitLinkRequest(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await apiFetch("/api/parent/link-requests", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (res.error) {
      setMessage(`요청 실패: ${res.error.message}`);
      return;
    }
    setMessage("연결 요청이 접수되었습니다. 원장 승인을 기다려주세요.");
    setForm({ ...form, requestedStudentName: "", requestedStudentBirthDate: "" });
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">자녀 출결</h1>

      <ul className="mb-6 space-y-3">
        {children.map((child) => {
          const counts = summaries[child.id]?.counts;
          return (
            <li key={child.id} className="rounded-lg border bg-white p-4">
              <div className="mb-2 font-medium">{child.name}</div>
              {counts ? (
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <span key={key}>
                      {label} {counts[key] ?? 0}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-400">최근 30일 출결 데이터 불러오는 중...</span>
              )}
            </li>
          );
        })}
        {children.length === 0 && (
          <li className="text-gray-500">아직 연결된 자녀가 없습니다. 아래에서 연결을 요청하세요.</li>
        )}
      </ul>

      <details className="rounded-lg border bg-white p-4">
        <summary className="cursor-pointer font-medium">자녀 연결 요청하기</summary>
        <form onSubmit={submitLinkRequest} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col text-sm">
            지점
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="mt-1 rounded border px-3 py-2"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            자녀 이름
            <input
              required
              value={form.requestedStudentName}
              onChange={(e) => setForm({ ...form, requestedStudentName: e.target.value })}
              className="mt-1 rounded border px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            자녀 생년월일
            <input
              required
              type="date"
              value={form.requestedStudentBirthDate}
              onChange={(e) => setForm({ ...form, requestedStudentBirthDate: e.target.value })}
              className="mt-1 rounded border px-3 py-2"
            />
          </label>
          <div className="col-span-full">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              연결 요청
            </button>
          </div>
        </form>
      </details>
      {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
