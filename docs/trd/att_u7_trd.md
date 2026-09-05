# U7. 감사로그 — 단위 TRD

> `harness_01_trd_template.md` 기반. [AI 초안] 표시 항목은 사람 확정 전
> 초안입니다 — §7 미결 항목(특히 "개인정보 조회 로깅 범위")을 꼭 확인해주세요.
> 릴리스 계획(`harness_07_release_planning.md`)상 "기록" 부분은 Must(v0.1),
> "조회 화면" 부분은 Should(v0.2)입니다. 이 TRD는 기록 스키마 + 최소 조회
> API까지만 다루고, 화면 UX(필터·페이지네이션 등)는 v0.2에서 별도 확정.

## 문서 정보
- 프로젝트: class-attend (att)
- 단위(화면/기능) 이름: U7. 감사로그
- 작성일 / 버전: 2026-09-06 / v0.2
- 상태: 확정 (2026-09-06, AC·미결항목 전체 승인 완료 — 구현 대기)

## §0. 범위 및 흐름 개요
- 이 단위가 담당하는 역할: U1·U2·U3·U5에서 발생하는 계정/개인정보/출결/
  연결 변경 이벤트를 공통 스키마로 기록하고, 원장(자기 지점)·본사(전체
  지점)가 조회할 수 있게 한다.
- 화면/기능 흐름:
  ```mermaid
  flowchart TD
      U1[U1 계정 생성/비활성화] --> LOG[record_audit_log 호출]
      U2[U2 학생 등록/수정/퇴원, 배정변경] --> LOG
      U3[U3 출결 생성/정정] --> LOG
      U5[U5 연결요청 생성/승인/거부/해제] --> LOG
      LOG --> DB[(AuditLog 테이블)]
      DB --> Q[GET /audit-logs 조회]
      Q --> Director[원장 - 자기 지점만]
      Q --> HQ[본사 - 전체 지점]
  ```
- 이 단위가 의존하는 다른 단위 (선행 조건): 없음(공통 인프라) — 단, 실제
  호출은 U1·U2·U3·U5 구현 시점에 함께 이뤄져야 함(릴리스 계획 §5).
- 이 단위에 의존하는 다른 단위 (후행 영향): 없음. 다른 모든 단위가 이
  단위의 `record_audit_log` 함수를 호출하는 방향으로 의존.

## §0-1. 비기능 요구사항 체크
- **동시성**: 감사로그는 append-only이므로 동시 기록에 의한 충돌이
  구조적으로 발생하지 않음(각 이벤트가 독립된 새 행).
- **권한**: 조회는 원장(자기 지점만, `branch_id` 강제 필터)과 본사(전체
  지점, 필터 선택 가능)만. 강사·학부모는 조회 불가.
- **감사(audit)**: 이 단위 자체가 감사 인프라이므로 해당 없음(N/A) —
  단, 감사로그 조회 행위 자체를 다시 로깅할지는 §7 미결.
- **개인정보**: `before_value`/`after_value`에 학생 이름·생년월일·연락처
  등 개인정보가 그대로 포함될 수 있음 — 감사로그 자체가 민감정보
  저장소가 되므로 조회 권한(원장/본사만)을 엄격히 지켜야 함.
- **삭제 정책**: **물리 삭제·수정 모두 금지(append-only)**. ADR-003보다
  한 단계 더 엄격 — 감사로그는 정정조차 허용하지 않는다(정정이 필요하면
  원본 이벤트에 대한 정정 이벤트를 새로 追加 기록).

## §1. 데이터 구조 [AI 초안]
```
AuditLog
  id (PK)
  branch_id (FK -> Branch.id, nullable)   -- 지점 생성 이전 행위 등 예외적 NULL 허용
  actor_user_id (FK -> User.id, not null) -- 행위자
  action_type (text, not null)            -- 예: 'user.create', 'student.update',
                                           --     'attendance.create', 'parent_link.approve' 등
  target_type (text, not null)            -- 예: 'User', 'Student', 'Attendance', 'ParentStudentLink'
  target_id (not null)
  before_value (JSON, nullable)           -- 수정/거부/해제 계열
  after_value (JSON, nullable)            -- 생성/수정/승인 계열
  occurred_at (timestamp, not null)
```
> `action_type`을 enum이 아닌 문자열로 둔 이유: 새 단위(U4/U6 등)가 추가될
> 때마다 스키마 마이그레이션 없이 새 이벤트 종류를 등록할 수 있게 하기
> 위함. 다만 실제 사용되는 값의 목록은 이 TRD와 각 단위 TRD에 명시된
> 것으로 제한한다(코드 리뷰에서 임의 값 추가 여부를 확인).

## §2. 함수/API 명세 [AI 초안]
| 함수/엔드포인트 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `record_audit_log(...)` (내부 함수, HTTP로 노출 안 함) | actor_user_id, branch_id, action_type, target_type, target_id, before_value, after_value | - | U1·U2·U3·U5가 호출하는 공통 로깅 함수 |
| `GET /audit-logs` | branch_id(본사만 선택 가능), action_type, target_type, date_from, date_to | 로그 목록 | 원장은 자기 branch_id로 강제 필터, 본사는 필터 선택 |

## §3. 워크플로우 및 비즈니스 로직
- 정상 흐름: 각 단위의 상태 변경 로직 마지막에 `record_audit_log` 호출 →
  트랜잭션 내에서 원본 변경과 함께 커밋(원본 변경은 성공했는데 로그만
  실패하는 상황 방지 — 같은 트랜잭션에 포함).
- 조회 흐름: 원장/본사가 `GET /audit-logs` 호출 → 권한에 따라 `branch_id`
  필터가 강제 또는 선택적으로 적용.
- 예외 상황:
  - 강사/학부모가 `GET /audit-logs` 호출 → 403 FORBIDDEN_ROLE.
  - 원장이 `branch_id` 파라미터로 타 지점을 지정 시도 →
    403 FORBIDDEN_BRANCH(§7 확정).
- §0-1 정책 적용 위치: 모든 쓰기 계열 API(U1/U2/U3/U5)의 서비스 계층에서
  `record_audit_log`를 누락 없이 호출하는지가 이 단위의 핵심 리스크이므로,
  코드 리뷰 체크리스트에 "이 API는 감사로그를 남기는가?" 항목을 추가할 것.

## §4. 상태/에러 코드 [AI 초안]
| 코드 | 의미 | 발생 조건 |
|---|---|---|
| 403 FORBIDDEN_ROLE | 조회 권한 없음 | 강사/학부모가 GET /audit-logs 호출 |
| 403 FORBIDDEN_BRANCH | 타 지점 조회 시도 | 원장이 자기 지점 아닌 branch_id로 조회 시도 |

## §5. 인수 조건 (Acceptance Criteria)
- [ ] AC-1: U1의 계정 생성/비활성화, U2의 학생 등록/수정/퇴원 및 배정
      변경, U3의 출결 생성/정정, U5의 연결요청 생성/승인/거부/해제 각
      이벤트 발생 시 AuditLog가 1건씩 생성된다.
- [ ] AC-2: 원장이 `GET /audit-logs`를 호출하면 자기 `branch_id`의 로그만
      반환되고 타 지점 로그는 포함되지 않는다.
- [ ] AC-3: 본사(franchise_admin)가 `GET /audit-logs`를 호출하면
      `branch_id` 필터 없이 전체 지점 로그를 조회할 수 있다.
- [ ] AC-4: 강사·학부모 role이 `GET /audit-logs`를 호출하면
      403 FORBIDDEN_ROLE을 반환한다.
- [ ] AC-5: 수정 계열 이벤트는 `before_value`·`after_value`가 모두
      채워지고, 생성 계열 이벤트는 `after_value`만 채워진다.
- [ ] AC-6: AuditLog 레코드를 수정하거나 삭제하는 API는 존재하지 않는다
      (append-only 검증).
- [ ] AC-7: 원본 이벤트(예: 학생 등록)와 그 감사로그 기록은 같은
      트랜잭션에서 커밋되어, 원본 변경이 성공했는데 로그가 누락되는
      경우가 없다(트랜잭션 롤백 시 둘 다 롤백).

## §6. 테스트 시나리오
| 시나리오 | 입력/조건 | 기대 결과 | 대응 AC |
|---|---|---|---|
| 학생 등록 후 로그 확인 | U2에서 학생 등록 | AuditLog 1건, action_type=student.create | AC-1 |
| 원장의 타 지점 로그 조회 | 원장(지점1)이 GET /audit-logs | 지점1 로그만 반환 | AC-2 |
| 본사의 전체 조회 | franchise_admin이 GET /audit-logs (필터 없음) | 전체 지점 로그 반환 | AC-3 |
| 강사의 조회 시도 | role=teacher로 GET /audit-logs | 403 FORBIDDEN_ROLE | AC-4 |
| 출결 정정 후 로그 확인 | U3에서 status 정정(PATCH) | before_value/after_value 모두 채워짐 | AC-5 |
| 로그 수정 API 호출 시도 | PATCH /audit-logs/{id} (엔드포인트 없음) | 404 또는 라우트 없음 | AC-6 |
| DB 트랜잭션 실패 시뮬레이션 | 학생 등록 중 로그 insert 강제 실패 | 학생 등록 자체도 롤백됨 | AC-7 |

## §7. 확정된 항목 (2026-09-06)
| 항목 | 확정 내용 |
|---|---|
| 개인정보 "조회"(view) 이벤트 로깅 범위 | 학생 **상세 단건 조회**(`GET /students/{id}`)만 `personal_data.view`로 로깅, 목록 조회는 제외 — U2 TRD AC-10으로 소급 반영 완료 |
| 원장의 타 지점 `branch_id` 조회 시도 처리 | 403 FORBIDDEN_BRANCH 반환(다른 단위와 일관된 에러 방식) |
| 감사로그 조회 행위 자체의 메타 로깅 여부 | 로깅 안 함(무한 재귀·로그 폭증 방지) |
| 감사로그 보관기간 | 영구 보관 — 학생/계정 데이터의 파기(U6)와 무관하게 유지 |
