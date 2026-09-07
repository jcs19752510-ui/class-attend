"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    if (res.error) {
      setMessage(res.error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto mt-16 max-w-sm rounded-lg border bg-white p-6">
      <h1 className="mb-1 text-xl font-semibold">비밀번호 변경</h1>
      <p className="mb-4 text-sm text-gray-500">최초 로그인 시 비밀번호를 변경해야 합니다.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="flex flex-col text-sm">
          현재(임시) 비밀번호
          <input
            required
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          새 비밀번호 (8자 이상, 영문/숫자/특수문자 중 2종류 이상)
          <input
            required
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          변경
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
    </main>
  );
}
