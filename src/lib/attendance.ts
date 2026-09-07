import type { AttendanceStatus } from "@prisma/client";
import { ApiError } from "./errors";

// docs/trd/att_u3_trd.md §7 확정: 출석/결석/지각/조퇴/사유결석 5종.
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "early_leave",
  "excused_absence",
];

// docs/trd/att_u4_trd.md §2: 상태별 건수 집계(자동 확정 — 통계 지표는
// 5종 상태 카운트까지만 제공).
export function emptyAttendanceCounts(): Record<AttendanceStatus, number> {
  return Object.fromEntries(ATTENDANCE_STATUSES.map((status) => [status, 0])) as Record<
    AttendanceStatus,
    number
  >;
}

export function tallyAttendance(records: { status: AttendanceStatus }[]): Record<AttendanceStatus, number> {
  const counts = emptyAttendanceCounts();
  for (const record of records) {
    counts[record.status] += 1;
  }
  return counts;
}

export function assertValidAttendanceStatus(status: string): AttendanceStatus {
  if (!ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
    throw new ApiError("INVALID_STATUS", `허용되지 않는 출결 상태입니다: ${status}`);
  }
  return status as AttendanceStatus;
}

// §7 확정: 미래 날짜 출결 입력 금지.
// 주의(버그 수정 이력): 서버 로컬 타임존에 따라 date-only 문자열(UTC 자정
// 기준으로 파싱됨)을 local getHours/setHours로 비교하면 UTC보다 서쪽
// (음수 오프셋) 타임존에서 하루가 밀려 미래 날짜를 걸러내지 못하는 버그가
// 있었다. UTC 기준(toISOString의 날짜 부분)끼리만 비교해 타임존에 무관하게
// 만든다.
export function assertNotFutureDate(dateStr: string): Date {
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) {
    throw new ApiError("INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }
  const todayUtc = new Date().toISOString().slice(0, 10);
  const targetUtc = target.toISOString().slice(0, 10);
  if (targetUtc > todayUtc) {
    throw new ApiError("INVALID_DATE", "미래 날짜에는 출결을 입력할 수 없습니다.");
  }
  return target;
}
