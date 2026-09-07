"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    agreedToPrivacyPolicy: false,
  });
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const signupRes = await apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(form) });
    if (signupRes.error) {
      setMessage(signupRes.error.message);
      return;
    }
    const loginRes = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: form.email, password: form.password }),
    });
    if (loginRes.error) {
      router.push("/login");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto mt-16 max-w-sm rounded-lg border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">학부모 회원가입</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="flex flex-col text-sm">
          이메일
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          비밀번호 (8자 이상, 영문/숫자/특수문자 중 2종류 이상)
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
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
          연락처(선택)
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            required
            type="checkbox"
            checked={form.agreedToPrivacyPolicy}
            onChange={(e) => setForm({ ...form, agreedToPrivacyPolicy: e.target.checked })}
            className="mt-1"
          />
          <span>
            (필수) 개인정보 수집·이용에 동의합니다. 자세한 내용은{" "}
            <a href="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
              개인정보처리방침
            </a>
            을 확인하세요.
          </span>
        </label>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          가입하기
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      <p className="mt-4 text-sm text-gray-500">
        이미 계정이 있나요? <a href="/login" className="text-blue-600 hover:underline">로그인</a>
      </p>
    </main>
  );
}
