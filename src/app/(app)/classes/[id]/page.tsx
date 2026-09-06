"use client";

import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface Student {
  id: string;
  name: string;
  status: "enrolled" | "withdrawn";
}
interface Teacher {
  id: string;
  name: string;
  email: string;
}
interface RosterRow {
  studentId: string;
  name: string;
}

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<RosterRow[]>(`/api/classes/${id}/roster`).then((res) => res.data && setRoster(res.data));
    apiFetch<Teacher[]>(`/api/classes/${id}/teachers`).then((res) => res.data && setTeachers(res.data));
    apiFetch<Student[]>("/api/students").then(
      (res) => res.data && setAllStudents(res.data.filter((s) => s.status === "enrolled")),
    );
    apiFetch<Teacher[]>("/api/users?role=teacher").then((res) => res.data && setAllTeachers(res.data));
  }

  useEffect(load, [id]);

  const unassignedStudents = allStudents.filter(
    (s) => !roster.some((r) => r.studentId === s.id),
  );
  const unassignedTeachers = allTeachers.filter((t) => !teachers.some((a) => a.id === t.id));

  async function assignStudent(studentId: string) {
    const res = await apiFetch(`/api/classes/${id}/students`, {
      method: "POST",
      body: JSON.stringify({ studentId }),
    });
    if (res.error) setMessage(res.error.message);
    load();
  }

  async function unassignStudent(studentId: string) {
    const res = await apiFetch(`/api/classes/${id}/students/${studentId}`, { method: "DELETE" });
    if (res.error) setMessage(res.error.message);
    load();
  }

  async function assignTeacher(teacherUserId: string) {
    const res = await apiFetch(`/api/classes/${id}/teachers`, {
      method: "POST",
      body: JSON.stringify({ teacherUserId }),
    });
    if (res.error) setMessage(res.error.message);
    load();
  }

  async function unassignTeacher(teacherUserId: string) {
    const res = await apiFetch(`/api/classes/${id}/teachers/${teacherUserId}`, { method: "DELETE" });
    if (res.error) setMessage(res.error.message);
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">배정된 학생</h2>
        <ul className="mb-4 space-y-1 text-sm">
          {roster.map((r) => (
            <li key={r.studentId} className="flex items-center justify-between">
              {r.name}
              <button onClick={() => unassignStudent(r.studentId)} className="text-red-600 hover:underline">
                배정 해제
              </button>
            </li>
          ))}
          {roster.length === 0 && <li className="text-gray-500">배정된 학생이 없습니다.</li>}
        </ul>
        <h3 className="mb-2 text-sm text-gray-500">학생 추가</h3>
        <ul className="space-y-1 text-sm">
          {unassignedStudents.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              {s.name}
              <button onClick={() => assignStudent(s.id)} className="text-blue-600 hover:underline">
                배정
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">배정된 강사</h2>
        <ul className="mb-4 space-y-1 text-sm">
          {teachers.map((t) => (
            <li key={t.id} className="flex items-center justify-between">
              {t.name} ({t.email})
              <button onClick={() => unassignTeacher(t.id)} className="text-red-600 hover:underline">
                배정 해제
              </button>
            </li>
          ))}
          {teachers.length === 0 && <li className="text-gray-500">배정된 강사가 없습니다.</li>}
        </ul>
        <h3 className="mb-2 text-sm text-gray-500">강사 추가</h3>
        <ul className="space-y-1 text-sm">
          {unassignedTeachers.map((t) => (
            <li key={t.id} className="flex items-center justify-between">
              {t.name} ({t.email})
              <button onClick={() => assignTeacher(t.id)} className="text-blue-600 hover:underline">
                배정
              </button>
            </li>
          ))}
        </ul>
      </section>

      {message && <p className="col-span-full text-sm text-red-600">{message}</p>}
    </div>
  );
}
