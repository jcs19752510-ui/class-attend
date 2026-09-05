# U2. 학생·반 관리 — 단위 TRD

> `harness_01_trd_template.md` 기반. [AI 초안] 표시 항목은 사람 확정 전
> 초안입니다 — §7 미결 항목을 꼭 확인해주세요.

## 문서 정보
- 프로젝트: class-attend (att)
- 단위(화면/기능) 이름: U2. 학생·반 관리
- 작성일 / 버전: 2026-09-05 / v0.2
- 상태: 확정 (2026-09-05, AC·미결항목 전체 승인 완료 — 구현 대기)

## §0. 범위 및 흐름 개요
- 이 단위가 담당하는 역할: 원장이 자기 지점의 학생을 등록·수정·퇴원 처리하고,
  반을 개설하며, 학생↔반·반↔강사를 배정한다(ADR-002의 다대다 구조).
- 화면/기능 흐름:
  ```mermaid
  flowchart TD
      A[원장 로그인] --> B[학생 등록]
      A --> C[반 개설]
      B --> D[학생을 반에 배정]
      C --> D
      C --> E[강사를 반에 배정]
      D --> F[U3 출결 체크로 이관]
      E --> F
      B --> G[학생 퇴원 처리]
      G -.보유기간 계산 시작.-> H((U6 개인정보 생명주기))
  ```
- 이 단위가 의존하는 다른 단위 (선행 조건): U1(지점·원장/강사 계정이 먼저
  존재해야 함).
- 이 단위에 의존하는 다른 단위 (후행 영향): U3(출결 체크는 학생-반-강사
  매핑이 있어야 동작), U5(학부모-자녀 연결은 학생 레코드가 있어야 함),
  U6(퇴원 이벤트가 개인정보 보유기간 계산의 시작점), U7(개인정보 조회/수정
  이력 기록 대상).

## §0-1. 비기능 요구사항 체크
- **동시성**: 동일 지점 내에서 같은 학생을 두 원장 계정(예: 공동 원장)이
  동시에 수정하는 상황은 MVP 범위에서 "마지막 저장 우선(last write wins)"
  으로 처리한다. 정교한 낙관적 잠금은 이번 단위에서 다루지 않음(N/A로 명시).
- **권한**: 학생/반 등록·수정·배정은 **원장만**. 강사는 자신이 배정된 반의
  학생 명단(roster)만 **조회** 가능, 수정 불가. 프랜차이즈 관리자(본사)는
  전체 지점 **조회만** 가능, 수정 권한 없음(§7 확정).
- **감사(audit)**: 학생 개인정보 등록/수정, 반-학생/반-강사 배정 변경
  이벤트는 감사로그(U7)에 기록. 추가로 **학생 상세 단건 조회**
  (`GET /students/{id}`)도 `personal_data.view` 이벤트로 기록한다
  (2026-09-06 확정 — 목록 조회는 로그 폭증 방지를 위해 제외, U7 TRD §7
  참고). U1과 동일하게 이 단위 구현 시 로깅 호출을 함께 심는다(릴리스
  계획 §5).
- **개인정보**: 이 단위가 다루는 개인정보는 요구사항 정의에서 확정한
  표준 범위(이름+생년월일+연락처(학생/보호자)+반 배정) 그대로다. 추가
  항목(주소, 학교명 등)은 수집하지 않는다.
- **삭제 정책**: 학생 레코드도 ADR-003과 동일 원칙 적용 — 물리 삭제 없음,
  퇴원 처리(소프트 삭제, `status=withdrawn` + `withdrawn_at` 기록)만
  허용. 보유기간 경과 후 개인정보 필드 마스킹/파기는 U6 소관.

## §1. 데이터 구조 [AI 초안]
```
Student
  id (PK)
  branch_id (FK -> Branch.id, not null)
  name
  birth_date
  student_phone (nullable)
  guardian_phone (not null)
  status (enrolled / withdrawn)
  enrolled_at
  withdrawn_at (nullable)

Class
  id (PK)
  branch_id (FK -> Branch.id, not null)
  name
  subject (nullable)
  status (active / closed)
  created_at

student_class  (학생-반 매핑, N:M — ADR-002)
  id (PK)
  student_id (FK -> Student.id)
  class_id (FK -> Class.id)
  assigned_at
  unassigned_at (nullable)  -- 배정 해제 시 물리삭제 대신 이 값을 채움(이력 보존)

class_teacher  (반-강사 매핑, N:M — ADR-002)
  id (PK)
  class_id (FK -> Class.id)
  teacher_user_id (FK -> User.id, role=teacher)
  assigned_at
  unassigned_at (nullable)
```
> `student_class`/`class_teacher`의 배정 해제를 물리 삭제 대신
> `unassigned_at`으로 남기는 이유: "이 강사가 이 반을 담당했던 적이 있는지"
> 이력이 과거 출결 기록(U3) 조회 시 필요하기 때문입니다(예: 담당 교체 전
> 출결 기록의 책임 소재 추적).

## §2. 함수/API 명세 [AI 초안]
| 함수/엔드포인트 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `POST /students` | name, birth_date, student_phone, guardian_phone | student_id | 학생 등록. `branch_id`는 요청자(원장)의 소속 지점으로 서버가 자동 설정(입력값 무시) |
| `PATCH /students/{id}` | 변경 필드 | - | 학생 정보 수정 |
| `PATCH /students/{id}/withdraw` | - | - | 퇴원 처리 (status=withdrawn, withdrawn_at=now) |
| `POST /classes` | name, subject | class_id | 반 개설 |
| `PATCH /classes/{id}` | 변경 필드 | - | 반 정보 수정 |
| `POST /classes/{id}/students` | student_id | - | 학생을 반에 배정 |
| `DELETE /classes/{id}/students/{student_id}` | - | - | 배정 해제(soft) |
| `POST /classes/{id}/teachers` | teacher_user_id | - | 강사를 반에 배정 |
| `DELETE /classes/{id}/teachers/{teacher_user_id}` | - | - | 배정 해제(soft) |
| `GET /classes/{id}/roster` | - | 학생 목록 | 반 학생 명단 (U3 출결 체크 화면에서 사용) |
| `GET /students` | 필터(status 등) | 학생 목록 | 지점 내 학생 목록 (역할별 범위 적용) |

## §3. 워크플로우 및 비즈니스 로직
- 정상 흐름: 원장 로그인 → 학생 등록 → 반 개설 → 학생을 반에 배정 →
  강사를 반에 배정 → (완료, U3로 이관).
- 퇴원 흐름: 원장이 퇴원 처리 → `status=withdrawn`, 기존 반 배정과 과거
  출결 기록은 그대로 보존(삭제하지 않음) → 이후 신규 반 배정은 차단 →
  `withdrawn_at`이 U6 보유기간 계산의 시작점이 됨.
- 예외 상황:
  - 원장이 아닌 역할이 학생/반 생성·수정 API 호출 → 403 FORBIDDEN_ROLE.
  - 원장이 자기 지점이 아닌 `branch_id`의 학생/반에 접근 시도 →
    403 FORBIDDEN_BRANCH (ADR-001 적용).
  - 퇴원 처리된 학생을 신규로 반에 배정하려는 시도 → 409 STUDENT_WITHDRAWN.
  - 이미 배정된 학생을 동일 반에 중복 배정 시도 → 409 ALREADY_ASSIGNED.
  - 강사가 자신이 배정되지 않은 반의 roster를 요청 → 403 FORBIDDEN_ROLE.
- §0-1 정책 적용 위치: 모든 API가 요청자의 `role`·`branch_id`를 검증(U1과
  동일한 미들웨어 재사용), roster 조회는 추가로 `class_teacher` 매핑 확인.

## §4. 상태/에러 코드 [AI 초안]
| 코드 | 의미 | 발생 조건 |
|---|---|---|
| 403 FORBIDDEN_ROLE | 권한 없는 역할 | 원장이 아닌 사용자가 CUD API 호출, 또는 배정 안 된 강사의 roster 요청 |
| 403 FORBIDDEN_BRANCH | 타 지점 접근 | 자기 지점이 아닌 학생/반 데이터 접근 시도 |
| 409 STUDENT_WITHDRAWN | 퇴원 학생 재배정 시도 | withdrawn 상태 학생을 반에 신규 배정 시도 |
| 409 ALREADY_ASSIGNED | 중복 배정 | 이미 배정된 학생/강사를 동일 반에 재배정 시도 |
| 404 NOT_FOUND | 대상 없음 | 존재하지 않는 student_id/class_id/teacher_user_id |

## §5. 인수 조건 (Acceptance Criteria)
- [ ] AC-1: 원장이 아닌 역할(강사/학부모/본사)이 학생 등록 API를 호출하면
      403 FORBIDDEN_ROLE을 반환하고 학생이 생성되지 않는다.
- [ ] AC-2: 학생 등록 시 요청 본문에 다른 `branch_id`를 넣어도 무시되고,
      요청자(원장)의 소속 지점으로 저장된다.
- [ ] AC-3: `status=withdrawn`인 학생을 반에 배정 시도하면
      409 STUDENT_WITHDRAWN을 반환하고 배정이 생성되지 않는다.
- [ ] AC-4: 원장이 자기 지점이 아닌 학생/반 데이터를 조회·수정하려 하면
      403 FORBIDDEN_BRANCH를 반환한다.
- [ ] AC-5: 강사가 자신이 배정되지 않은 반의 roster를 요청하면
      403 FORBIDDEN_ROLE을 반환한다.
- [ ] AC-6: 학생 등록/수정/퇴원, 반-학생/반-강사 배정·배정해제 이벤트는
      감사로그에 행위자·시각·대상·변경내용이 1건씩 기록된다.
- [ ] AC-7: 이미 배정된 학생을 동일 반에 중복 배정 시도하면
      409 ALREADY_ASSIGNED를 반환하고 중복 레코드가 생성되지 않는다.
- [ ] AC-8: 학생 레코드에는 물리 삭제 API가 존재하지 않으며, 퇴원 처리
      (`withdraw`)만이 유일한 비활성화 수단이다.
- [ ] AC-9: 배정 해제(`DELETE /classes/{id}/students/{student_id}`) 시
      레코드가 물리 삭제되지 않고 `unassigned_at`만 채워지며, 이후 같은
      학생-반 조합을 다시 배정하면 새 레코드가 아니라 기존 레코드가 재사용
      되거나(구현 선택) 이력 조회 시 과거 배정 기간이 그대로 남아있다.

## §6. 테스트 시나리오
| 시나리오 | 입력/조건 | 기대 결과 | 대응 AC |
|---|---|---|---|
| 강사의 학생 등록 시도 | role=teacher 토큰으로 POST /students | 403 FORBIDDEN_ROLE | AC-1 |
| branch_id 위조 시도 | 원장(지점1) 토큰, 요청 본문 branch_id=지점2 | 저장된 student.branch_id=지점1 | AC-2 |
| 퇴원 학생 재배정 | withdrawn 학생을 반에 배정 시도 | 409 STUDENT_WITHDRAWN | AC-3 |
| 타 지점 학생 조회 | 원장(지점1)이 지점2 student_id로 GET | 403 FORBIDDEN_BRANCH | AC-4 |
| 미배정 강사의 roster 요청 | class_teacher에 없는 강사가 GET roster | 403 FORBIDDEN_ROLE | AC-5 |
| 학생 등록 후 감사로그 확인 | 원장이 학생 등록 | 감사로그 1건 생성 | AC-6 |
| 중복 배정 시도 | 이미 배정된 student_id로 재배정 요청 | 409 ALREADY_ASSIGNED | AC-7 |
| 학생 물리 삭제 API 호출 | DELETE /students/{id} 요청(존재하지 않는 엔드포인트) | 404 또는 라우트 없음 | AC-8 |
| 배정 해제 후 이력 조회 | 배정 해제 → 배정 이력 조회 | unassigned_at 채워진 과거 레코드 확인 | AC-9 |

## §7. 확정된 항목 (2026-09-05)
| 항목 | 확정 내용 |
|---|---|
| 본사(프랜차이즈 관리자)의 학생/반 데이터 수정 권한 | 없음 — 본사는 조회 전용, 생성/수정/배정은 원장만. `GET` 계열 API만 본사 role에 허용, 그 외 호출 시 403 FORBIDDEN_ROLE |
| 반 정원(capacity) 관리 | 관리 안 함(이번 MVP 제외) — `Class` 테이블에 정원 컬럼을 두지 않음 |
| 퇴원 후 동일 학생 재등록 처리 | 신규 레코드로 등록(과거 이력과 자동 연결 안 함) — 재등록은 `POST /students`를 새로 호출하는 것과 동일하게 처리 |
| 반 개설 시 요일/시간 정보 | 남기지 않음(시간표 관리는 Out of Scope) — `Class`에는 요일/시간 컬럼 없음, U3에서 출결 체크 시 "날짜"만 선택 |
