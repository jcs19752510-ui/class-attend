# U5. 학부모-자녀 연결 — 단위 TRD

> `harness_01_trd_template.md` 기반. [AI 초안] 표시 항목은 사람 확정 전
> 초안입니다 — §7 미결 항목을 꼭 확인해주세요.

## 문서 정보
- 프로젝트: class-attend (att)
- 단위(화면/기능) 이름: U5. 학부모-자녀 연결
- 작성일 / 버전: 2026-09-06 / v0.2
- 상태: 확정 (2026-09-06, AC·미결항목 전체 승인 완료 — 구현 대기)

## §0. 범위 및 흐름 개요
- 이 단위가 담당하는 역할: 학부모가 자녀(학생) 연결을 요청하면, 해당 지점
  원장이 실제 학생 레코드와 대조해 승인/거부한다(요구사항 정의 ⑦ 답변:
  "원장이 직접 연결을 승인/배정"). 승인 전에는 학부모가 어떤 학생 데이터도
  볼 수 없다.
- 화면/기능 흐름:
  ```mermaid
  flowchart TD
      A[학부모 로그인] --> B[지점 선택 + 학생 이름·생년월일 입력]
      B --> C[연결 요청 생성 - status=pending]
      C --> D[원장: 지점 pending 요청 목록 확인]
      D --> E{원장 검토}
      E -- 승인 --> F[status=approved, student_id 확정]
      E -- 거부 --> G[status=rejected]
      F --> H((U4에서 해당 학생 출결 조회 가능))
      G --> I[학부모가 재요청 가능]
  ```
  > 학부모가 입력한 이름/생년월일이 실제로 일치하는지 시스템이 즉시
  > 알려주지 않는다(동명이인 등 정보 노출 방지 — 개인정보 처리 관점의
  > 보수적 설계). 매칭 확인은 원장의 검토 단계에서만 이뤄진다.
- 이 단위가 의존하는 다른 단위 (선행 조건): U1(학부모 계정, 원장 계정),
  U2(학생 레코드가 존재해야 매칭 가능).
- 이 단위에 의존하는 다른 단위 (후행 영향): U4(승인된 연결만 학부모의
  출결 조회 범위가 됨), U7(연결 요청/승인/거부가 감사로그 대상).

## §0-1. 비기능 요구사항 체크
- **동시성**: 동일 학부모가 동일 지점에 짧은 시간에 여러 번 요청을
  중복 제출하는 것은 막지 않되(오탈자 재시도 허용), 이미 `approved`된
  (parent, student) 조합에 대한 재요청만 명시적으로 차단한다(§5 AC-5).
- **권한**: 연결 요청 생성 = 학부모만. 요청 승인/거부 = **자기 지점** 요청에
  한해 원장만(ADR-001 `branch_id` 격리 적용). 프랜차이즈 관리자(본사)는
  이 단위에 개입하지 않음(조회도 하지 않음 — §7 확정).
- **감사(audit)**: 연결 요청 생성·승인·거부는 모두 개인정보(학생-보호자
  관계) 변경에 해당하므로 감사로그(U7)에 행위자·시각·대상·처리결과를
  기록해야 함.
- **개인정보**: 이 단위는 학부모가 입력한 "학생 이름·생년월일"(대조용
  임시 데이터)과 실제 `Student` 레코드를 연결하는 민감한 처리를 수행함.
  거부된 요청의 학생 이름/생년월일 입력값도 개인정보이므로 별도 삭제
  없이 남겨두되(감사 목적), 접근은 해당 지점 원장·본사(감사로그 조회
  권한 범위)로 제한.
- **삭제 정책**: ADR-003과 동일 원칙 — 연결 레코드는 물리 삭제하지 않음.
  연결 해제는 `status`를 `revoked`로 바꾸는 소프트 처리로만 한다.

## §1. 데이터 구조 [AI 초안]
```
ParentStudentLink
  id (PK)
  parent_user_id (FK -> User.id, role=parent, not null)
  branch_id (FK -> Branch.id, not null)         -- 요청 대상 지점
  requested_student_name (text, not null)       -- 학부모 입력값(매칭 전)
  requested_student_birth_date (date, not null) -- 학부모 입력값(매칭 전)
  student_id (FK -> Student.id, nullable)       -- 승인 시에만 채워짐
  status (enum: pending / approved / rejected / revoked)
  requested_at (timestamp, not null)
  reviewed_by (FK -> User.id, nullable)         -- 승인/거부한 원장
  reviewed_at (timestamp, nullable)
  reject_reason (text, nullable)
```

## §2. 함수/API 명세 [AI 초안]
| 함수/엔드포인트 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `POST /parent/link-requests` | branch_id, requested_student_name, requested_student_birth_date | link_request_id | 학부모의 연결 요청 생성 |
| `GET /directors/link-requests?status=pending` | - | 요청 목록(+ 이름·생년월일이 정확히 일치하는 학생이 있으면 `candidate_student_id` 함께 제공) | 원장의 검토 대기 목록 |
| `PATCH /directors/link-requests/{id}/approve` | student_id | - | 승인 — 지정한 student_id로 확정 |
| `PATCH /directors/link-requests/{id}/reject` | reject_reason(optional) | - | 거부 |
| `GET /parent/children` | - | 승인된 학생 목록 | 학부모의 자녀 목록(U4 진입점) |
| `PATCH /directors/link-requests/{id}/revoke` | - | - | 승인된 연결을 원장이 해제(소프트) |

## §3. 워크플로우 및 비즈니스 로직
- 정상 흐름: 위 §0 mermaid 순서.
- 승인 처리: 원장이 `candidate_student_id`를 참고하되, 다른 학생을 직접
  지정해서 승인할 수도 있다(자동 매칭은 힌트일 뿐 강제하지 않음).
- 거부 처리: 학부모는 거부 사유를 볼 수 있으며(§7 확인), 이후 동일하거나
  다른 정보로 재요청할 수 있다(재요청 자체는 막지 않음).
- 예외 상황:
  - 원장이 자기 지점이 아닌 요청을 승인/거부 시도 → 403 FORBIDDEN_BRANCH.
  - 승인 시 지정한 `student_id`가 요청의 `branch_id` 소속이 아님 →
    422 INVALID_STUDENT.
  - 이미 `approved`인 (parent_user_id, student_id) 조합에 대한 재요청 →
    409 ALREADY_LINKED.
  - `status=withdrawn`(퇴원)인 학생으로 승인 시도 → 409 STUDENT_WITHDRAWN.
  - 존재하지 않는 `branch_id`로 요청 → 404 NOT_FOUND.
- §0-1 정책 적용 위치: 승인/거부/해제 API 모두 요청자(원장)의 `branch_id`와
  대상 레코드의 `branch_id` 일치 여부를 먼저 검증.

## §4. 상태/에러 코드 [AI 초안]
| 코드 | 의미 | 발생 조건 |
|---|---|---|
| 403 FORBIDDEN_BRANCH | 타 지점 요청 처리 시도 | 원장이 자기 지점 아닌 요청을 승인/거부/해제 |
| 404 NOT_FOUND | 대상 없음 | 존재하지 않는 branch_id/link_request_id |
| 409 ALREADY_LINKED | 중복 연결 | 이미 approved인 (parent, student) 조합에 재요청 |
| 409 STUDENT_WITHDRAWN | 퇴원 학생 | 퇴원 처리된 학생으로 승인 시도 |
| 422 INVALID_STUDENT | 지점 불일치 | 승인 시 지정한 student_id가 요청 지점 소속이 아님 |

## §5. 인수 조건 (Acceptance Criteria)
- [ ] AC-1: 학부모가 연결 요청을 생성하면 `status=pending`인
      ParentStudentLink 레코드가 생성되고 `student_id`는 NULL이다.
- [ ] AC-2: 원장이 자기 지점이 아닌 연결 요청을 승인·거부·해제하려 하면
      403 FORBIDDEN_BRANCH를 반환한다.
- [ ] AC-3: 승인 시 지정한 `student_id`가 요청의 `branch_id` 소속이 아니면
      422 INVALID_STUDENT를 반환하고 승인되지 않는다.
- [ ] AC-4: 승인되면 `status=approved`, `student_id`가 채워지고,
      `GET /parent/children` 호출 시 해당 학생이 목록에 나타난다.
- [ ] AC-5: 이미 `approved`인 (parent_user_id, student_id) 조합에 대해
      동일 학부모가 동일 학생으로 재요청을 승인하려 하면
      409 ALREADY_LINKED를 반환한다.
- [ ] AC-6: `status=withdrawn`인 학생으로 승인을 시도하면
      409 STUDENT_WITHDRAWN을 반환한다.
- [ ] AC-7: 거부된 요청(`status=rejected`)이 있어도 학부모는 새 연결
      요청을 다시 생성할 수 있다(차단되지 않음).
- [ ] AC-8: 연결 요청 생성/승인/거부/해제 이벤트는 감사로그에 행위자·
      시각·대상·처리결과가 1건씩 기록된다.
- [ ] AC-9: 승인된 연결이 원장에 의해 해제(`revoke`)되면 `status=revoked`로
      바뀌며(물리 삭제 아님), 이후 `GET /parent/children`에서 해당 학생이
      더 이상 나타나지 않는다.

## §6. 테스트 시나리오
| 시나리오 | 입력/조건 | 기대 결과 | 대응 AC |
|---|---|---|---|
| 정상 연결 요청 | 학부모가 branch_id+이름+생년월일로 요청 | pending 레코드 생성, student_id=NULL | AC-1 |
| 타 지점 요청 승인 시도 | 원장(지점1)이 지점2 요청을 승인 | 403 FORBIDDEN_BRANCH | AC-2 |
| 지점 불일치 학생으로 승인 | 요청 branch_id=지점1, student_id는 지점2 소속 | 422 INVALID_STUDENT | AC-3 |
| 승인 후 자녀 목록 조회 | 승인 완료 후 GET /parent/children | 해당 학생 포함 | AC-4 |
| 이미 연결된 조합 재요청 승인 | 이미 approved인 (parent,student)에 재승인 시도 | 409 ALREADY_LINKED | AC-5 |
| 퇴원 학생 승인 시도 | withdrawn 학생 student_id로 승인 | 409 STUDENT_WITHDRAWN | AC-6 |
| 거부 후 재요청 | 거부된 학부모가 다시 요청 생성 | 새 pending 레코드 생성 | AC-7 |
| 승인/거부 후 감사로그 확인 | 원장이 요청 승인 | 감사로그 1건 생성 | AC-8 |
| 연결 해제 후 자녀 목록 재조회 | 원장이 revoke 처리 후 GET /parent/children | 해당 학생 제외됨 | AC-9 |

## §7. 확정된 항목 (2026-09-06)
| 항목 | 확정 내용 |
|---|---|
| 원장 검토 화면의 자동 매칭 후보 제공 여부 | 제공함 — 이름+생년월일 정확 일치 시 `candidate_student_id` 함께 반환 |
| 거부 사유의 학부모 노출 여부 | 노출함 — `reject_reason`(선택 입력)이 있으면 학부모 화면에 표시 |
| 승인된 연결의 학부모 셀프 해제 가능 여부 | 불가 — 해제(`revoke`)는 원장만 수행 가능 |
| 퇴원 처리된 학생에 대한 신규 연결 승인 가능 여부 | 불가 — 409 STUDENT_WITHDRAWN |
| 본사(프랜차이즈 관리자)의 연결 요청 현황 조회 가능 여부 | 불가 — 이 단위는 지점 원장 소관, 본사는 개입하지 않음 |
