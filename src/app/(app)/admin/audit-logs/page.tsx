"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface AuditLog {
  id: string;
  actorUserId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  occurredAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionType, setActionType] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const query = actionType ? `?actionType=${encodeURIComponent(actionType)}` : "";
    apiFetch<AuditLog[]>(`/api/audit-logs${query}`).then((res) => {
      if (res.error) {
        setMessage(res.error.message);
        return;
      }
      setMessage(null);
      setLogs(res.data ?? []);
    });
  }, [actionType]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">감사로그</h1>
      <input
        placeholder="이벤트 종류로 필터(예: student.create)"
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
        className="mb-4 w-full max-w-sm rounded border px-3 py-2 text-sm"
      />
      {message && <p className="text-red-600">{message}</p>}
      <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="px-3 py-2">시각</th>
            <th className="px-3 py-2">행위자</th>
            <th className="px-3 py-2">이벤트</th>
            <th className="px-3 py-2">대상</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t">
              <td className="px-3 py-2">{new Date(log.occurredAt).toLocaleString("ko-KR")}</td>
              <td className="px-3 py-2">{log.actorUserId}</td>
              <td className="px-3 py-2">{log.actionType}</td>
              <td className="px-3 py-2">
                {log.targetType} / {log.targetId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
