# 자동 확정 내역 (AUTO_CONFIRM_CONTENTS)

> 2026-09-06 사용자 지시에 따라, "아주 특별하게 확정해야 할 사항"이 아닌
> 세부 항목은 Claude가 추천 기본값을 자동으로 적용하고 진행합니다. 이
> 문서는 그렇게 자동 확정된 내역을 전부 기록해서 사용자가 언제든 검토·
> 수정할 수 있게 하기 위한 것입니다.

## 자동 확정 기준
- **자동 확정 대상(질문 없이 진행)**: API 응답/에러 포맷, 네이밍 규칙,
  로그 포맷, 디렉토리 구조, 문서 표현 방식, 에러 코드 세부 문구 등
  "나중에 바꾸는 데 며칠 안 걸리는" 구현 세부사항.
- **여전히 사용자 승인 필요(자동 확정 제외)**: CLAUDE.md 원칙 8 및
  `harness_08_adr.md` 체크리스트 대상 — 데이터 모델(스키마) 구조,
  삭제/보유 정책, 권한·역할 구조, 핵심 기술 스택, 개인정보 처리 범위
  등 되돌리기 어려운 결정. 이런 항목은 지금까지처럼 후보안 제시 →
  사용자 승인 절차를 계속 거칩니다.

## 2026-09-06 U2~U7 일괄 구현 시 자동 확정 내역
(사용자 지시: "특별히 확인할 사항이 아니면 자동 확정하고 끝까지 진행")

| 항목 | 적용 내용 | 근거 |
|---|---|---|
| U2~U7 작업지시서(work order) 문서 생략 | U1과 달리 U2~U7은 별도 `docs/workorder/*.md` 없이 TRD 확정 직후 바로 구현 진행 | TRD가 이미 충분히 상세하고, 사용자가 "끝까지 진행"을 명시적으로 요청 — 문서 한 벌 더 만드는 절차적 오버헤드보다 구현 속도 우선 |
| U2~U6 프론트엔드 화면 생략 | U1의 로그인 화면 외 추가 UI를 만들지 않고 API+테스트로만 구현 | 모든 AC가 API/로직 레벨이라 화면 없이도 검증 가능. 화면은 후속 작업으로 별도 진행 권장 |
| U4 통계 지표 범위 | 5종 상태별 건수 집계만 제공(출석률 %, 그래프 등 제외) | `att_u4_trd.md` §7에도 기록 — MVP 최소 범위 |
| U4 통계 조회의 감사로그 미기록 | 목록성 조회로 간주해 로깅 대상에서 제외 | U7 §7 "목록 조회 비로깅" 원칙과 일관 |
| U4 teacher의 학생별 요약 접근 차단 | 강사는 반별 요약만 가능, 학생 단위 조회는 불가 | 강사가 자신이 안 가르치는 반의 학생 이력까지 보는 권한 과다 방지 |
| U6 마스킹 값 | name="(파기됨)", studentPhone=null, guardianPhone="(파기됨)", birthDate=1970-01-01(센티널) | ADR-005의 "필드 마스킹" 방침을 구체적인 값으로 구현 |
| U6 파기 배치 실행 주체 | franchise_admin 전용 수동 트리거 API(실 스케줄러 연동은 harness_09 소관, 이번 세션 범위 아님) | 배포 인프라 결정(크론 등)은 코드 구현과 분리된 운영 이슈 |
| U6 파기 이벤트 로깅에 PII 미포함 | actionType/targetId/시각만 기록, beforeValue/afterValue 생략 | 파기 목적 자체가 PII 제거인데 영구보관 로그에 다시 남기면 무의미해짐(att_u6_trd.md §0-1) |

## 2026-09-06 (2차) 배포 인프라·법적 준수·관리자 UI 일괄 진행 시 자동 확정 내역
(사용자 지시: "20년차 기준으로 검토후 학생출결 관리하기 편한방법으로 모두 진행")

| 항목 | 적용 내용 | 근거 |
|---|---|---|
| `npm audit` 잔존 취약점 전량 해소 | vitest 2.1.9→5.0.0(+vitest-mock-extended 5.1.1, @types/node 22.15.0), next 15.5.25→16.3.4로 업그레이드. 97개 테스트·tsc·build 재검증 통과 | 20년차 판단: 코드 변경 없이 버전만 올려 검증했고 전부 통과했으므로, 굳이 취약점을 남겨둘 이유가 없음 |
| 배포 인프라 제안 | Vercel(Next.js 배포) + Neon/Supabase(관리형 PostgreSQL) 조합 제안, `harness_09_deployment_runbook.md`에 구체 절차 기록 | 계정 개설·결제가 필요한 외부 서비스라 Claude가 직접 만들 수 없음 — **실제 계정 생성/최초 배포는 사용자가 직접 수행 필요** |
| 파기 배치 스케줄러 연동 | `vercel.json`에 크론(`/api/cron/purge-students`, 매일 18:00 UTC=03:00 KST) 등록 + `CRON_SECRET` 헤더 인증 방식의 전용 GET 엔드포인트 신설(기존 관리자용 POST와 분리) | Vercel Cron은 GET만 지원 + 로그인 세션이 없는 시스템 트리거이므로 별도 인증 경로 필요 |
| 미성년자 개인정보 기술적 조치 | 학생 등록 시 `guardianConsent` 필수 체크(위반 시 422) + `guardianConsentAt` 기록, 학부모 가입 시 `agreedToPrivacyPolicy` 필수 체크 + `privacyAgreedAt` 기록 | 실무에서 흔한 "동의 확인" 절차의 디지털화. **실제 약관 문구의 법적 충분성은 별도 법무 검토 필요**(harness_10 §7에 명시) |
| 관리자 UI 프레임워크 | Tailwind CSS v4 추가(유틸리티 클래스 기반, 별도 디자인 시스템 없음) | 여러 화면을 빠르게, 일관된 스타일로 구현하기 위한 실용적 선택 |
| UI 화면 구성 및 인증 셸 | Next.js 라우트 그룹 `(app)`로 로그인 필수 화면을 묶고, 서버 컴포넌트에서 쿠키 기반 세션 확인 후 역할별 네비게이션 렌더링 | httpOnly 쿠키라 클라이언트에서 role을 직접 읽을 수 없어 서버 사이드 세션 조회 방식 채택 |
| 출결 체크 화면의 "전체 출석 처리" 버튼 | 반 전체를 한 번에 "출석"으로 표시한 뒤 개별 학생만 예외 처리하는 방식 지원 | 20년차 UX 판단 — 대부분의 수업일에 대다수 학생이 출석이므로, 매번 전원을 한 명씩 누르게 하는 것보다 훨씬 빠름 |
| UI 지원을 위한 신규 조회 전용 엔드포인트 6종 | `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/classes`(목록), `GET /api/classes/{id}/teachers`(배정 목록), `GET /api/branches`(목록), `GET /api/users`(역할별 목록) | 전부 조회 전용이며 기존 역할/지점 권한 검증 로직을 그대로 재사용 — 원 TRD 표에는 없었지만 화면 구현에 필수적이라 스코프 이탈로 보지 않음. 각 엔드포인트에 테스트 추가 완료(`tests/api/ui-support-endpoints.test.ts` 등) |

## 발견 후 수정한 버그
| 날짜 | 위치 | 증상 | 수정 내용 |
|---|---|---|---|
| 2026-09-06 | 계정 부트스트랩(전체 API) | **치명적**: 지점 생성(`POST /branches`)·계정 발급(`POST /users`)이 전부 "이미 로그인된 franchise_admin"을 전제하는데, 그 최초 franchise_admin 계정을 만들 방법 자체가 없었음(회원가입은 parent 전용) — 배포해도 아무도 로그인 못 하는 상태 | `prisma/seed.ts` 신규 작성 + `npm run db:seed` 스크립트 추가. `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 환경변수로 최초 franchise_admin 계정을 직접 DB에 생성. `harness_09_deployment_runbook.md`에 배포 절차 §2-1로 반영 |
| 2026-09-06 | `src/lib/attendance.ts` `assertNotFutureDate` (U3) | 로컬 타임존이 UTC보다 서쪽(음수 오프셋)인 서버에서, 날짜만 있는 문자열(UTC 자정 기준 파싱)을 로컬 `getHours/setHours`로 비교하면 하루가 밀려 "내일" 날짜를 미래로 인식하지 못함(AC-8 회귀 테스트로 재현) | 로컬시간 변환 없이 `toISOString()`의 날짜 부분(UTC 기준)끼리만 문자열 비교하도록 변경. `tests/unit/attendance.test.ts`에 회귀 테스트 추가 |

## 자동 확정 목록

| 날짜 | 항목 | 적용 내용 | 근거/비고 | 관련 파일 |
|---|---|---|---|---|
| 2026-09-06 | API URL 네이밍 규칙 | REST 리소스 기반, 소문자 복수형 (예: `/api/students`) | 업계 표준 관례, 되돌리기 쉬움 | `harness/harness_13_tech_conventions.md` §2 |
| 2026-09-06 | API 성공/에러 응답 공통 포맷 | 성공 `{ "data": ... }`, 에러 `{ "error": { "code", "message" } }` | 모든 단위 TRD §4 에러코드가 이 포맷을 공유하도록 표준화 | 〃 |
| 2026-09-06 | API 버저닝 정책 | v0.1은 버전 프리픽스 없음, 필요 시 `/api/v2` | 초기 단계에서 불필요한 복잡도 회피 | 〃 |
| 2026-09-06 | 인증 토큰 방식 세부 | JWT, httpOnly 쿠키, 만료 24시간, 리프레시 토큰은 MVP 제외 | MVP 범위에서 충분, 리프레시는 v0.2 이후 재검토 가능 | 〃 §3 |
| 2026-09-06 | 코드 네이밍 규칙 | TS 변수/함수 camelCase, 컴포넌트/타입 PascalCase, DB 컬럼 snake_case | 각 언어/프레임워크의 관용적 표기 | 〃 §4 |
| 2026-09-06 | 디렉토리 구조 제안 | `/app`, `/app/api/{resource}`, `/lib/auth`, `/lib/audit`, `/prisma/schema.prisma` | Next.js 관례 + U7 공통 로깅 함수 위치 명확화 | 〃 §4 |
| 2026-09-06 | 로그 포맷/레벨 기준 | 구조화 JSON, error/warn/info 3단계 | 표준적인 관례, 필요 시 손쉽게 조정 가능 | 〃 §5 |
| 2026-09-06 | 애플리케이션 일반 로그에 개인정보 값 마스킹 | 이름/연락처/생년월일 등은 ID만 로그, 값은 미출력 | 개인정보 노출 위험 최소화(원칙 7과 정합) — 단, 이건 보안 성격이 있어 "특별 확정" 경계선에 가까움. 이견 있으면 알려주시면 재검토 | 〃 §5 |
| 2026-09-06 | 이메일 발송 서비스 제안 | Resend 제안. API 키 없는 개발 단계에서는 실제 발송 대신 콘솔 로그로 대체(mock) | 외부 서비스 키는 사용자만 발급 가능 — 키 제공 전까지 개발 진행을 막지 않기 위한 임시 조치. **키 발급 전략(Resend 채택 여부 자체)은 별도 확인 환영** | 〃 §1 |
| 2026-09-06 | 테스트 프레임워크 | Vitest + Supertest | Next.js/TypeScript 생태계에서 흔히 쓰이는 조합, 되돌리기 쉬움 | `docs/workorder/att_u1_workorder.md` §3 |
| 2026-09-06 | 계정 비활성화 권한 범위 | franchise_admin은 전체 계정 비활성화 가능, director는 **자기 지점 소속 teacher 계정만** 비활성화 가능(다른 director·본사 계정은 불가) | `att_u1_trd.md`에 이 범위가 명시되어 있지 않아 역할 위계상 합리적으로 판단. 재검토 시 변경 쉬움(권한 매트릭스 한 곳만 수정) | `src/app/api/users/[id]/deactivate/route.ts`, `docs/trd/att_u1_trd.md` §4 |
| 2026-09-06 | 새 에러 코드 2종 추가 | `PASSWORD_CHANGE_REQUIRED`(403), `VALIDATION_ERROR`(422) | 원본 TRD §4에 없던 상황(AC-3 강제, 입력값 검증)을 표현할 코드가 필요해 기존 코드 체계와 일관되게 신설, TRD §4에 소급 반영함 | `src/lib/errors.ts`, `docs/trd/att_u1_trd.md` §4 |
| 2026-09-06 | 임시 비밀번호를 API 응답에 노출하지 않음 | `POST /api/users` 응답에는 `userId`만 반환, 임시 비밀번호는 이메일(mock)로만 전달 | TRD §7 "초기 비밀번호 전달 방식=이메일 발송" 정책과 일관성 유지(다른 경로로 노출하면 정책 취지 훼손) | `src/app/api/users/route.ts` |
| 2026-09-06 | ~~`npm audit` 잔존 취약점 수용~~ → **2026-09-06 전량 해소** | Next 15.5.25→15.5.25(유지) 단계에서 이미 RCE는 해결. 이후 사용자 요청으로 vitest 2.1.9→5.0.0(+vitest-mock-extended 5.1.1, @types/node 22.15.0), next 15.5.25→16.3.4까지 마저 올림. 84개 테스트·tsc·build 전부 재검증 통과 | `npm audit` = 0 vulnerabilities. 코드 변경 없이 버전만 올렸고, Next 16은 기본 번들러가 Turbopack으로 바뀐 점만 확인(빌드 정상) | `package.json`, `vitest.config.ts`(`__dirname`→`import.meta.dirname`, vitest5 권장사항 반영) |
