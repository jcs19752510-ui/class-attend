"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type AttendanceStatus = "present" | "absent" | "late" | "early_leave" | "excused_absence";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: "present", label: "출석", activeClass: "bg-green-600 text-white border-green-600" },
  { value: "absent", label: "결석", activeClass: "bg-red-600 text-white border-red-600" },
  { value: "late", label: "지각", activeClass: "bg-amber-500 text-white border-amber-500" },
  { value: "early_leave", label: "조퇴", activeClass: "bg-blue-500 text-white border-blue-500" },
  { value: "excused_absence", label: "사유결석", activeClass: "bg-gray-500 text-white border-gray-500" },
];

interface ClassOption {
  id: string;
  name: string;
}

interface RosterRow {
  studentId: string;
  name: string;
  attendance: { id: string; status: AttendanceStatus } | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selections, setSelections] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setLoading(true);
    setMessage(null);
    apiFetch<RosterRow[]>(`/api/classes/${classId}/roster?date=${date}`).then((res) => {
      setLoading(false);
      if (res.error) {
        setMessage(`불러오기 실패: ${res.error.message}`);
        setRoster([]);
        return;
      }
      const rows = res.data ?? [];
      setRoster(rows);
      const initial: Record<string, AttendanceStatus> = {};
      for (const row of rows) {
        if (row.attendance) initial[row.studentId] = row.attendance.status;
      }
      setSelections(initial);
    });
  }, [classId, date]);

  const allPresentApplied = useMemo(
    () => roster.length > 0 && roster.every((r) => selections[r.studentId] === "present"),
    [roster, selections],
  );

  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    for (const row of roster) next[row.studentId] = status;
    setSelections(next);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const items = roster
      .filter((row) => selections[row.studentId])
      .map((row) => ({
        studentId: row.studentId,
        classId,
        date,
        status: selections[row.studentId],
      }));

    const res = await apiFetch("/api/attendance", { method: "POST", body: JSON.stringify(items) });
    setSaving(false);
    if (res.error) {
      setMessage(`저장 실패: ${res.error.message}`);
      return;
    }
    setMessage(`저장 완료 (${items.length}명)`);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">출결 체크</h1>

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
        <label className="flex flex-col text-sm">
          반 선택
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-1 rounded border px-3 py-2"
          >
            {classes.length === 0 && <option value="">배정된 반이 없습니다</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          날짜
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded border px-3 py-2"
          />
        </label>
        <button
          onClick={() => markAll("present")}
          disabled={roster.length === 0}
          className="rounded-md border border-green-600 px-3 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-40"
        >
          전체 출석 처리
        </button>
        {allPresentApplied && (
          <span className="text-sm text-green-700">전원 출석으로 표시됨</span>
        )}
      </div>

      {loading && <p className="text-gray-500">불러오는 중...</p>}
      {!loading && roster.length === 0 && classId && (
        <p className="text-gray-500">이 반에 배정된 학생이 없습니다.</p>
      )}

      <ul className="space-y-2">
        {roster.map((row) => (
          <li
            key={row.studentId}
            className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium">{row.name}</span>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((opt) => {
                const active = selections[row.studentId] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setSelections((prev) => ({ ...prev, [row.studentId]: opt.value }))
                    }
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      active ? opt.activeClass : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      {roster.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      )}
    </div>
  );
}
