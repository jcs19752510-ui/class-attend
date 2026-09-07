# 작업지시서 — U1. 지점·계정 관리

> `harness_02_work_order_template.md` 기반.

## 문서 정보
- 프로젝트/단위: class-attend (att) / U1. 지점·계정 관리
- 참조 TRD: `docs/trd/att_u1_trd.md` (확정, v0.2)
- 작성일: 2026-09-06

## §0. 전제 조건
- 이 작업 착수 전에 이미 완료되어 있어야 하는 것:
  - 마스터 TRD(`docs/trd/att_master_trd.md`), ADR-001~004
    (`harness/harness_08_adr.md`), 전역 기술 컨벤션
    (`harness/harness_13_tech_conventions.md`) 전부 확정 완료.
  - U1은 프로젝트의 최초 구현 단위라 선행 코드 없음(빈 저장소에서 시작).
- 사용 가능한 참고 자료: `docs/trd/att_master_trd.md`, `docs/trd/att_u1_trd.md`,
  `harness/harness_08_adr.md`, `harness/harness_13_tech_conventions.md`.
- **⚠️ 이 프로젝트 고유 규칙(CLAUDE.md 최우선 규칙)**: 구현 에이전트는
  git 관련 어떠한 작업도 하지 않는다(`status`/`diff`/`log` 같은 조회성
  명령 포함, `add`/`commit`/`branch`/`push` 등 전부 금지). 브랜치 생성·
  커밋·병합은 **사용자가 직접** 수행한다. 에이전트는 파일 변경(코드
  작성)까지만 담당한다.

## §1. 이번 단계 범위
- [ ] Prisma 스키마(`prisma/schema.prisma`)에 `Branch`, `User` 모델 추가
      (`att_u1_trd.md` §1)
- [ ] 지점 생성 API — `POST /api/branches` (franchise_admin 전용)
- [ ] 계정 발급 API — `POST /api/users` (role=director/teacher)
- [ ] 학부모 셀프 회원가입 API — `POST /api/auth/signup`
- [ ] 로그인 API — `POST /api/auth/login` (JWT 발급, httpOnly 쿠키)
- [ ] 비밀번호 변경 API — `POST /api/auth/change-password`
      (최초 로그인 강제 로직 포함)
- [ ] 계정 비활성화 API — `PATCH /api/users/{id}/deactivate`
- [ ] role·branch_id 검증 공통 미들웨어(`lib/auth`) — 이후 모든 단위가
      재사용할 인프라이므로 이번 단위에서 확실히 구현
- [ ] U7 감사로그 연동 — 계정 생성/비활성화 이벤트에 대해
      `lib/audit`의 `recordAuditLog(...)` 호출 (스키마는 `att_u7_trd.md` §1)
- [ ] `att_u1_trd.md` §5의 AC-1~AC-8에 대응하는 자동화 테스트 작성

## §2. 안 하는 것 (Out of Scope)
- 학생·반 관리(U2), 출결 체크(U3), 학부모-자녀 연결(U5)의 화면/로직 —
  이번 단위에서 손대지 않는다.
- 실제 이메일 발송 연동(Resend API 키 설정) — 개발 단계에서는 실제
  발송 대신 **콘솔에 로그로 출력하는 mock**으로 대체한다(§3 참고).
- 프론트엔드 디자인/스타일링 고도화 — 기능 동작을 확인할 수 있는
  최소 UI(로그인 폼, 지점/계정 생성 폼 정도)만 만든다.
- 배포 설정(Vercel 등 실제 배포 인프라) — `harness_09` 단계에서 별도 진행.

## §3. 착수 전 확정 정책
> `att_u1_trd.md` §7의 확정 항목 + 이번 세션에서 자동 확정된 세부 구현
> 항목(`AUTO_CONFIRM_CONTENTS.MD` 참고)을 반영. 전부 "적용"이며, "별도
> 확인 필요"로 남은 항목은 없음.

| 항목 | 확정값 | 적용 여부 |
|---|---|---|
| 원장 계정 발급 주체 | franchise_admin만 | 적용 |
| 계정 삭제 정책 | 물리 삭제 금지, 소프트 삭제(비활성화)만 (ADR-003) | 적용 |
| 초기 비밀번호 전달 방식 | 이메일 발송 — 개발 단계는 콘솔 로그 mock | 적용 |
| 학부모 1계정-다지점 자녀 지원 | 지원함 | 적용 |
| 비밀번호 정책 | 최소 8자, 영문/숫자/특수문자 중 2종류 이상 | 적용 |
| 인증 방식 | JWT + httpOnly 쿠키, 만료 24시간 (harness_13 §3) | 적용 |
| API 에러 응답 포맷 | `{ "error": { "code", "message" } }` (harness_13 §2) | 적용 |
| 테스트 프레임워크 | Vitest + Supertest (자동 확정 — `AUTO_CONFIRM_CONTENTS.MD` 참고) | 적용 |

## §4. 완료 후 받을 결과물
- [ ] 소스 코드 (경로: `/app/api/branches`, `/app/api/users`,
      `/app/api/auth/*`, `/lib/auth`, `/lib/audit`,
      `/prisma/schema.prisma`의 Branch·User 모델)
- [ ] 실행/테스트 결과 로그
- [ ] AC-1~AC-8 대비 pass/fail 표
- [ ] 판단 근거 요약 (스펙에 없는 부분을 어떻게 채웠는지 — 특히 이번
      세션부터는 "자동 확정" 항목이 있다면 `AUTO_CONFIRM_CONTENTS.MD`에도
      함께 기록)
- [ ] 발견된 TRD와의 편차 (있다면)

## §5. 프롬프트 예시
```
당신은 class-attend 프로젝트의 백엔드/프론트엔드 구현을 담당하는 개발
에이전트입니다. 다음 원칙을 반드시 지키세요:

1. 스펙에 없는 기능을 임의로 추가하지 마세요.
2. 정책이 불명확한 부분을 발견하면 임의로 판단하지 말고, 진행을
   멈추고 보고하세요. (단, §3 "착수 전 확정 정책"에 명시된 항목은
   그 값을 그대로 따라 진행하세요. 그 외 사소한 구현 세부사항까지
   전부 다시 물어볼 필요는 없습니다 — 합리적 기본값을 적용하고,
   무엇을 어떻게 정했는지 결과 보고에 남기세요.)
3. 원본 코드/실제 데이터가 스펙과 다르면 실제 쪽을 우선하고, 이
   사실을 반드시 보고하세요.
4. 작업이 끝나면 AC 각 항목에 대해 pass/fail을 스스로 점검한 결과를
   보고하세요.
5. 왜 그렇게 구현했는지 판단 근거를 결과 보고에 포함하세요.
6. ⚠️ git 관련 어떠한 작업도 하지 마세요 (status/diff/log 조회 포함
   전부 금지). 브랜치 생성·커밋·병합은 사용자가 직접 합니다. 당신은
   파일 변경(코드 작성)까지만 담당합니다.

[읽어야 할 문서 — 반드시 먼저 읽고 시작하세요]
- CLAUDE.md (프로젝트 전역 규칙)
- docs/trd/att_master_trd.md (전체 그림)
- docs/trd/att_u1_trd.md (이번 단위 상세 스펙 — §1~§6 전체)
- docs/trd/att_u7_trd.md §1 (AuditLog 스키마 — 이번 단위에서 계정
  생성/비활성화 이벤트 로깅에 필요)
- harness/harness_08_adr.md (ADR-001~004)
- harness/harness_13_tech_conventions.md (기술 스택·API·인증 표준)
- docs/workorder/att_u1_workorder.md (이 문서 — §1~§3)

[이번에 할 것]
(이 문서 §1 체크리스트 그대로)

[하지 않을 것]
(이 문서 §2 그대로)

[완료 기준]
att_u1_trd.md §5(AC-1~AC-8)와 §6(테스트 시나리오)이 최종 검증 기준입니다.
모든 AC가 자동화 테스트로 커버되어야 하며, 작업 완료 후 AC별 pass/fail
표를 보고하세요.

[결과물]
이 문서 §4 그대로.
```

## §6. 다음 단계 예고
- 이번 단계 완료 후 다음으로 진행할 단위: U2(학생·반 관리)
- 다음 단위 착수 전 이번 단계에서 확인해둬야 할 것: U1에서 만든
  `lib/auth`(role·branch_id 검증)와 `lib/audit`(감사로그 기록) 공통
  모듈을 U2가 그대로 재사용할 수 있는 형태로 만들어졌는지 확인.
