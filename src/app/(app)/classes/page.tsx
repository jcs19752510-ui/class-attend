"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface ClassItem {
  id: string;
  name: string;
  subject: string | null;
  status: "active" | "closed";
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [form, setForm] = useState({ name: "", subject: "" });
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<ClassItem[]>("/api/classes").then((res) => {
      if (res.data) setClasses(res.data);
    });
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await apiFetch("/api/classes", { method: "POST", body: JSON.stringify(form) });
    if (res.error) {
      setMessage(`개설 실패: ${res.error.message}`);
      return;
    }
    setForm({ name: "", subject: "" });
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">반 관리</h1>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <label className="flex flex-col text-sm">
          반 이름
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          과목(선택)
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          반 개설
        </button>
        {message && <span className="text-sm text-gray-600">{message}</span>}
      </form>

      <ul className="space-y-2">
        {classes.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
            <span>
              {c.name} {c.subject && <span className="text-gray-500">· {c.subject}</span>}
            </span>
            <Link href={`/classes/${c.id}`} className="text-blue-600 hover:underline">
              배정 관리
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
