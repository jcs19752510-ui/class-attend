"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(`로그인 실패: ${body.error?.message ?? res.statusText}`);
      return;
    }
    router.push(body.data.mustChangePassword ? "/change-password" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto mt-16 max-w-sm rounded-lg border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">로그인</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="flex flex-col text-sm">
          이메일
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          로그인
        </button>
      </form>
      {message && (
        <p role="status" className="mt-3 text-sm text-red-600">
          {message}
        </p>
      )}
      <p className="mt-4 text-sm text-gray-500">
        학부모이신가요? <a href="/signup" className="text-blue-600 hover:underline">회원가입</a>
      </p>
    </main>
  );
}
