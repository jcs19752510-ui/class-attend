"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface Branch {
  id: string;
  name: string;
}

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchForm, setBranchForm] = useState({ name: "", address: "", phone: "" });
  const [directorForm, setDirectorForm] = useState({ email: "", name: "", phone: "", branchId: "" });
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<Branch[]>("/api/branches").then((res) => {
      if (res.data) {
        setBranches(res.data);
        if (res.data.length > 0) setDirectorForm((f) => ({ ...f, branchId: res.data![0].id }));
      }
    });
  }

  useEffect(load, []);

  async function createBranch(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch("/api/branches", { method: "POST", body: JSON.stringify(branchForm) });
    if (res.error) {
      setMessage(`지점 생성 실패: ${res.error.message}`);
      return;
    }
    setBranchForm({ name: "", address: "", phone: "" });
    load();
  }

  async function createDirector(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({ ...directorForm, role: "director" }),
    });
    if (res.error) {
      setMessage(`원장 계정 발급 실패: ${res.error.message}`);
      return;
    }
    setMessage("원장 계정이 발급되었습니다(임시 비밀번호는 이메일로 발송됨).");
    setDirectorForm({ ...directorForm, email: "", name: "", phone: "" });
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">지점 생성</h2>
        <form onSubmit={createBranch} className="space-y-3">
          <input
            required
            placeholder="지점명"
            value={branchForm.name}
            onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            placeholder="주소(선택)"
            value={branchForm.address}
            onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            지점 생성
          </button>
        </form>
        <ul className="mt-4 space-y-1 text-sm text-gray-600">
          {branches.map((b) => (
            <li key={b.id}>{b.name}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">원장 계정 발급</h2>
        <form onSubmit={createDirector} className="space-y-3">
          <select
            value={directorForm.branchId}
            onChange={(e) => setDirectorForm({ ...directorForm, branchId: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            required
            type="email"
            placeholder="이메일"
            value={directorForm.email}
            onChange={(e) => setDirectorForm({ ...directorForm, email: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="이름"
            value={directorForm.name}
            onChange={(e) => setDirectorForm({ ...directorForm, name: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            원장 계정 발급
          </button>
        </form>
      </section>
      {message && <p className="col-span-full text-sm text-gray-600">{message}</p>}
    </div>
  );
}
