"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface ClassOption {
  id: string;
  name: string;
}
interface StudentSummary {
  studentId: string;
  name: string;
  counts: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  present: "출석",
  absent: "결석",
  late: "지각",
  early_leave: "조퇴",
  excused_absence: "사유결석",
};

function monthAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ClassOption[]>("/api/classes").then((res) => {
      if (res.data) {
        setClasses(res.data);
        if (res.data.length > 0) setClassId(res.data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    apiFetch<{ students: StudentSummary[] }>(
      `/api/classes/${classId}/attendance-summary?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    ).then((res) => {
      if (res.error) {
        setMessage(res.error.message);
        setStudents([]);
        return;
      }
      setMessage(null);
      setStudents(res.data?.students ?? []);
    });
  }, [classId, dateFrom, dateTo]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">출결 통계</h1>

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
        <label className="flex flex-col text-sm">
          반
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 rounded border px-3 py-2">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          시작일
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 rounded border px-3 py-2" />
        </label>
        <label className="flex flex-col text-sm">
          종료일
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 rounded border px-3 py-2" />
        </label>
      </div>

      {message && <p className="text-red-600">{message}</p>}

      <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="px-3 py-2">학생</th>
            {Object.values(STATUS_LABELS).map((label) => (
              <th key={label} className="px-3 py-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.studentId} className="border-t">
              <td className="px-3 py-2">{s.name}</td>
              {Object.keys(STATUS_LABELS).map((key) => (
                <td key={key} className="px-3 py-2">
                  {s.counts[key] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
