import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

// harness/harness_13_tech_conventions.md §2의 공통 에러 포맷을 따른다.
// 코드 목록 출처: docs/trd/att_u1_trd.md §4 (+ 구현 중 판단근거로 추가한
// PASSWORD_CHANGE_REQUIRED, VALIDATION_ERROR — 아래 주석 참고).
export type ErrorCode =
  | "EMAIL_DUPLICATE"
  | "FORBIDDEN_ROLE"
  | "FORBIDDEN_BRANCH"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DEACTIVATED"
  | "NOT_FOUND"
  // 아래 두 코드는 att_u1_trd.md §4에 명시되어 있지 않아 구현 중 추가함.
  // 판단 근거: AC-3(비밀번호 변경 강제)·입력값 검증을 표현할 코드가
  // 원본 TRD에 없어, 기존 코드 체계(HTTP 상태 매핑)와 일관되게 신설.
  | "PASSWORD_CHANGE_REQUIRED"
  | "VALIDATION_ERROR"
  // U2(att_u2_trd.md §4)
  | "STUDENT_WITHDRAWN"
  | "ALREADY_ASSIGNED"
  // U3(att_u3_trd.md §4)
  | "INVALID_STATUS"
  | "INVALID_DATE"
  // U5(att_u5_trd.md §4)
  | "ALREADY_LINKED"
  | "INVALID_STUDENT";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  EMAIL_DUPLICATE: 409,
  FORBIDDEN_ROLE: 403,
  FORBIDDEN_BRANCH: 403,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DEACTIVATED: 423,
  NOT_FOUND: 404,
  PASSWORD_CHANGE_REQUIRED: 403,
  VALIDATION_ERROR: 422,
  STUDENT_WITHDRAWN: 409,
  ALREADY_ASSIGNED: 409,
  INVALID_STATUS: 422,
  INVALID_DATE: 422,
  ALREADY_LINKED: 409,
  INVALID_STUDENT: 422,
};

export class ApiError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function errorResponse(error: ApiError) {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status: STATUS_BY_CODE[error.code] },
  );
}

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}

// 모든 API Route Handler가 catch 블록에서 공통으로 호출하는 변환 함수.
// harness_13_tech_conventions.md §2의 에러 포맷으로 통일한다.
export function toErrorResponse(err: unknown) {
  if (err instanceof ApiError) return errorResponse(err);

  if (err instanceof ZodError) {
    return errorResponse(
      new ApiError("VALIDATION_ERROR", err.issues.map((issue) => issue.message).join(", ")),
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    // 이 스키마에서 유니크 제약은 User.email뿐이므로 EMAIL_DUPLICATE로 매핑한다.
    return errorResponse(new ApiError("EMAIL_DUPLICATE", "이미 사용 중인 이메일입니다."));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return errorResponse(new ApiError("NOT_FOUND", "대상을 찾을 수 없습니다."));
  }

  // 예상하지 못한 오류 — 원칙 6(원본 우선)에 따라 숨기지 않고 로그로 남긴다.
  console.error("[unhandled_error]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
    { status: 500 },
  );
}
