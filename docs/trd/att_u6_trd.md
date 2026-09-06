# U6. 개인정보 생명주기 — 단위 TRD

> `harness_01_trd_template.md` 기반. ADR-005(2026-09-06 승인)에서 확정된
> "퇴원 후 365일 보관 → 마스킹" 정책을 실제 배치 로직으로 옮긴다.

## 문서 정보
- 프로젝트: class-attend (att)
- 단위(화면/기능) 이름: U6. 개인정보 생명주기
- 작성일 / 버전: 2026-09-06 / v0.1
- 상태: 확정 — 구현과 동시 진행

## §0. 범위 및 흐름 개요
- 퇴원 트리거는 이미 U2(`PATCH /students/{id}/withdraw`)에 존재. 이 단위는
  **보유기간 경과 후 자동 파기(마스킹) 배치**만 다룬다.
- 흐름:
  ```mermaid
  flowchart TD
      A[U2: 학생 퇴원 처리, withdrawnAt 기록] --> B{withdrawnAt으로부터 365일 경과?}
      B -- No --> C[대상 아님]
      B -- Yes --> D{이미 purgedAt 존재?}
      D -- Yes --> C
      D -- No --> E[개인정보 필드 마스킹 + purgedAt 기록]
      E --> F[감사로그에 student.purge 기록 - PII 값은 남기지 않음]
  ```
- 선행 조건: U2(Student.withdrawnAt), U1(franchise_admin 인증).
- 후행 영향: U4/U7 조회 시 마스킹된 학생은 이름 대신 마스킹 값이 보임
  (통계용 Attendance 레코드 자체는 삭제되지 않으므로 U4 집계에는 영향 없음).

## §0-1. 비기능 요구사항 체크
- 동시성: 배치가 중복 실행돼도 `purgedAt IS NULL` 조건으로 대상을 거르므로
  멱등적이다(N/A 수준).
- 권한: 배치 실행 API는 **franchise_admin 전용**(자동 확정 — 지점 단위가
  아니라 전사 배치이므로 지점 원장 권한 밖).
- 감사(audit): 파기 이벤트는 기록하되, **실제 개인정보 값(before)은 로그에
  남기지 않는다**(자동 확정 — 근거: 파기의 목적 자체가 PII 제거인데,
  삭제 전 값을 영구보관 로그에 옮겨 적으면 파기가 무의미해짐). `targetId`
  (학생 id)와 처리 시각만 기록한다.
- 개인정보: 이 단위가 다루는 항목 = `harness_10_data_lifecycle.md` §2-1의
  마스킹 대상 필드.
- 삭제 정책: 행(row) 물리 삭제는 하지 않는다(ADR-005) — 필드 마스킹만.

## §1. 데이터 구조
- `Student.purgedAt`(nullable DateTime) 컬럼 추가 — 파기 처리 여부/시각.
- 마스킹 값(자동 확정):
  - `name` → `"(파기됨)"`
  - `studentPhone` → `null`
  - `guardianPhone` → `"(파기됨)"`
  - `birthDate` → `1970-01-01`(고정 센티널 값 — DateTime 컬럼은 NULL 허용
    안 하므로 의미 없는 고정값으로 대체)

## §2. 함수/API 명세
| 함수/엔드포인트 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `POST /admin/data-lifecycle/purge-students` | - | `{ purgedCount }` | franchise_admin이 배치를 수동 실행(실 배포 시 스케줄러 연동은 `harness_09` 소관) |

## §3. 워크플로우 및 비즈니스 로직
- 대상 조회: `status='withdrawn' AND withdrawnAt <= now-365일 AND purgedAt IS NULL`.
- 각 대상에 대해 트랜잭션으로 필드 마스킹 + `purgedAt=now()` 갱신 +
  감사로그(`student.purge`, before/after 값 없이 targetId만) 기록.
- 재직 학생(`status='enrolled'`)은애초에 조회 조건에서 제외되므로 절대
  파기되지 않는다(AC-6).

## §4. 상태/에러 코드
| 코드 | 의미 | 발생 조건 |
|---|---|---|
| 403 FORBIDDEN_ROLE | 권한 없음 | franchise_admin이 아닌 역할의 호출 |

## §5. 인수 조건 (Acceptance Criteria)
- [ ] AC-1: 퇴원 후 365일이 지나지 않은 학생은 파기 대상에서 제외된다.
- [ ] AC-2: 퇴원 후 365일이 지난 학생은 name/studentPhone/guardianPhone/
      birthDate가 마스킹 값으로 바뀌고 `purgedAt`이 채워진다.
- [ ] AC-3: 이미 `purgedAt`이 있는 학생은 재처리되지 않는다(멱등성).
- [ ] AC-4: franchise_admin이 아닌 역할이 배치 API를 호출하면
      403 FORBIDDEN_ROLE을 반환한다.
- [ ] AC-5: 파기 이벤트의 감사로그에는 마스킹 전 실제 개인정보 값이
      포함되지 않는다.
- [ ] AC-6: `status='enrolled'`인(퇴원하지 않은) 학생은 보유기간 계산
      대상 자체가 아니므로 파기되지 않는다.

## §6. 테스트 시나리오
| 시나리오 | 입력/조건 | 기대 결과 | 대응 AC |
|---|---|---|---|
| 경과 기간 미달 | withdrawnAt = 100일 전 | 파기 대상에서 제외 | AC-1 |
| 경과 기간 충족 | withdrawnAt = 400일 전 | name 등 마스킹, purgedAt 채워짐 | AC-2 |
| 이미 파기된 학생 재실행 | purgedAt 존재 | 재처리 안 됨 | AC-3 |
| 비-franchise_admin 호출 | director 토큰으로 호출 | 403 FORBIDDEN_ROLE | AC-4 |
| 파기 후 감사로그 확인 | 파기 실행 | beforeValue/afterValue에 PII 없음 | AC-5 |
| 재직 학생 포함 데이터셋 | enrolled 학생 다수 + 대상 학생 1명 | enrolled 학생은 변경 없음 | AC-6 |

## §7. 확정된 항목 (ADR-005 + 자동 확정, 2026-09-06)
| 항목 | 확정 내용 |
|---|---|
| 보유기간 | 퇴원 후 365일 (ADR-005) |
| 파기 방식 | 행 삭제 아님 — 개인정보 필드 마스킹만 (ADR-005) |
| 배치 실행 주체 | franchise_admin 전용 API(수동 트리거) — 실 스케줄러 연동은 harness_09에서 별도 |
| 파기 이벤트 로깅 범위 | targetId·시각만 기록, PII 값은 로그에 남기지 않음 |
