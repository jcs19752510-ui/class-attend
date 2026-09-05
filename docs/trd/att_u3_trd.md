# U3. 출결 체크 — 단위 TRD

> `harness_01_trd_template.md` 기반. [AI 초안] 표시 항목은 사람 확정 전
> 초안입니다 — §7 미결 항목을 꼭 확인해주세요.

## 문서 정보
- 프로젝트: class-attend (att)
- 단위(화면/기능) 이름: U3. 출결 체크
- 작성일 / 버전: 2026-09-05 / v0.2
- 상태: 확정 (2026-09-05, AC·미결항목 전체 승인 완료 — 구현 대기)

## §0. 범위 및 흐름 개요
- 이 단위가 담당하는 역할: 강사가 자신이 배정된 반의 학생 명단(roster)에서
  각 학생의 출결 상태를 수동으로 입력·저장·정정한다(요구사항 정의 ④·⑧
  답변 반영: 수동 체크, 5종 상태).
- 화면/기능 흐름:
  ```mermaid
  flowchart TD
      A[강사 로그인] --> B[담당 반 목록]
      B --> C[반 선택 + 날짜 선택 - 기본 오늘]
      C --> D[roster 조회 - 기존 출결 있으면 함께 표시]
      D --> E[학생별 상태 탭: 출석/결석/지각/조퇴/사유결석]
      E --> F[일괄 저장]
      F --> G{이미 저장된 기록?}
      G -- 아니오 --> H[신규 Attendance 레코드 생성]
      G -- 예 --> I[기존 레코드 갱신 + 감사로그에 이전값 기록]
  ```
- 이 단위가 의존하는 다른 단위 (선행 조건): U1(강사 로그인·역할),
  U2(학생-반, 반-강사 매핑, 학생 status).
- 이 단위에 의존하는 다른 단위 (후행 영향): U4(출결 조회·통계는 이 단위가
  쌓은 데이터를 읽음), U7(출결 변경 이력이 감사로그 대상).

## §0-1. 비기능 요구사항 체크
- **동시성**: 동일 (학생, 반, 날짜) 조합에 대해 두 사용자가 동시에 저장을
  시도하는 경우 "마지막 저장 우선(last write wins)"으로 처리하고, 두
  저장 모두 감사로그에 남긴다(누가 무엇으로 바꿨는지 추적 가능하도록).
  DB에는 `(student_id, class_id, date)` unique 제약을 둬 중복 레코드
  생성 자체를 막는다.
- **권한**: 출결 체크는 **자신에게 배정된 반(class_teacher 매핑)을 가진
  강사**, 그리고 **자기 지점 내 모든 반에 대한 원장**이 가능하다(§7 확정).
- **감사(audit)**: 출결 레코드 최초 생성 및 이후 모든 정정(상태값 변경)은
  행위자·시각·이전값·새값을 감사로그에 기록해야 함(요구사항 정의 ⑪ 답변).
- **개인정보**: 이 단위는 신규 개인정보를 추가로 수집하지 않음(U2에서
  이미 등록된 학생을 참조만 함). 다만 "출결 상태(특히 사유결석의 사유
  메모가 추가된다면)"는 그 자체로 민감할 수 있어 조회 권한 통제가 중요.
- **삭제 정책**: 출결 레코드는 ADR-003과 동일 원칙 연장 — **물리 삭제
  없음**. 정정은 상태값을 새 값으로 덮어쓰는 방식(PATCH)으로만 하고,
  이전 값은 감사로그에서 확인 가능하게 한다.

## §1. 데이터 구조 [AI 초안]
```
Attendance
  id (PK)
  branch_id (FK -> Branch.id, not null)   -- ADR-001 일관성 유지
  student_id (FK -> Student.id, not null)
  class_id (FK -> Class.id, not null)
  date (date, not null)
  status (enum: present / absent / late / early_leave / excused_absence)
  recorded_by (FK -> User.id, not null)   -- 최초 기록자
  recorded_at (timestamp, not null)
  updated_by (FK -> User.id, nullable)    -- 마지막 정정자
  updated_at (timestamp, nullable)

  UNIQUE (student_id, class_id, date)
```
> 상태값 5종은 요구사항 정의 ⑧ 답변(출석/결석/지각/조퇴/사유결석)을 그대로
> enum으로 사용. "사유결석"의 사유 텍스트를 별도로 남길지는 이번 단위에서
> 다루지 않음(§7 미결).

## §2. 함수/API 명세 [AI 초안]
| 함수/엔드포인트 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `GET /classes/{id}/roster?date=YYYY-MM-DD` | date | 학생 목록 + 기존 출결 상태(있으면) | 체크 화면 진입 시 초기 로드 |
| `POST /attendance` (bulk) | `[{student_id, class_id, date, status}, ...]` | 처리 결과(성공/실패 건수) | 반 전체 출결을 한 번에 저장. 이미 존재하면 갱신 |
| `PATCH /attendance/{id}` | status | - | 개별 레코드 정정 |
| `GET /attendance?class_id=&date=` | class_id, date | 출결 목록 | 체크 직후 확인용(상세 조회·통계는 U4 소관) |

## §3. 워크플로우 및 비즈니스 로직
- 정상 흐름: 위 §0 mermaid 순서. `POST /attendance`는 반 전체를 배치로
  받아 각 (student_id, class_id, date) 조합이 이미 있으면 갱신, 없으면
  생성한다.
- 정정 흐름: 강사가 roster 화면에서 이미 저장된 상태를 다시 탭하면
  `PATCH /attendance/{id}` 호출 → `updated_by`/`updated_at` 갱신 →
  감사로그에 "이전 status → 새 status" 기록.
- 예외 상황:
  - `class_teacher` 매핑에 없는 강사가 해당 반 roster/저장 요청 →
    403 FORBIDDEN_ROLE.
  - 자기 지점이 아닌 반에 접근 시도 → 403 FORBIDDEN_BRANCH.
  - `status=withdrawn`인 학생에 대해 신규 출결 입력 시도 →
    409 STUDENT_WITHDRAWN (U2 정책 재사용).
  - 5종 이외의 status 값 입력 → 422 INVALID_STATUS.
  - 오늘보다 미래인 날짜로 출결 입력 시도 → 422 INVALID_DATE (§7 미결
    — 기본값으로 금지 제안).
- §0-1 정책 적용 위치: `class_teacher` 매핑 검증은 roster 조회와 저장
  API 양쪽에서 모두 수행(조회만 되고 저장이 막히는 비일관 방지).

## §4. 상태/에러 코드 [AI 초안]
| 코드 | 의미 | 발생 조건 |
|---|---|---|
| 403 FORBIDDEN_ROLE | 미배정 강사 | class_teacher 매핑에 없는 반에 접근 |
| 403 FORBIDDEN_BRANCH | 타 지점 접근 | 자기 지점이 아닌 반/학생 데이터 접근 |
| 409 STUDENT_WITHDRAWN | 퇴원 학생 | 퇴원 처리된 학생에 신규 출결 입력 시도 |
| 422 INVALID_STATUS | 잘못된 상태값 | 5종 enum 외의 값 전달 |
| 422 INVALID_DATE | 잘못된 날짜 | 미래 날짜로 출결 입력 시도(§7 미결) |
| 404 NOT_FOUND | 대상 없음 | 존재하지 않는 class_id/student_id/attendance id |

## §5. 인수 조건 (Acceptance Criteria)
- [ ] AC-1: `class_teacher` 매핑에 없는 강사가 특정 반의 roster를
      요청하면 403 FORBIDDEN_ROLE을 반환한다.
- [ ] AC-2: 배정된 강사가 반 전체 출결을 저장하면, roster에 있던 학생
      수만큼 Attendance 레코드가 생성 또는 갱신된다.
- [ ] AC-3: 5종(출석/결석/지각/조퇴/사유결석) 이외의 status 값을 전달하면
      422 INVALID_STATUS를 반환하고 레코드가 저장되지 않는다.
- [ ] AC-4: 동일 (student_id, class_id, date)로 두 번째 저장을 시도하면
      새 레코드가 생성되지 않고 기존 레코드의 status/updated_by/
      updated_at만 갱신된다.
- [ ] AC-5: `status=withdrawn`인 학생에 대해 신규 출결 입력을 시도하면
      409 STUDENT_WITHDRAWN을 반환한다.
- [ ] AC-6: 출결 레코드가 최초 생성되면 `recorded_by`/`recorded_at`이
      채워지고, 이후 정정 시 `updated_by`/`updated_at`이 갱신되며,
      감사로그에 "이전 status → 새 status"가 함께 기록된다.
- [ ] AC-7: 출결 레코드에는 물리 삭제 API가 존재하지 않으며, 정정은
      `PATCH`(상태값 변경)로만 가능하다.
- [ ] AC-8: 오늘보다 미래인 날짜로 출결 입력을 시도하면
      422 INVALID_DATE를 반환한다.

## §6. 테스트 시나리오
| 시나리오 | 입력/조건 | 기대 결과 | 대응 AC |
|---|---|---|---|
| 미배정 강사의 roster 요청 | class_teacher에 없는 강사가 GET roster | 403 FORBIDDEN_ROLE | AC-1 |
| 정상 일괄 저장 | 배정 강사가 반 학생 10명 출결 저장 | Attendance 10건 생성 | AC-2 |
| 잘못된 상태값 전달 | status="tardy"(정의 안 된 값) | 422 INVALID_STATUS | AC-3 |
| 동일 조합 재저장 | 같은 학생/반/날짜로 두 번째 저장(다른 status) | 레코드 1건 유지, status만 갱신 | AC-4 |
| 퇴원 학생 출결 입력 | withdrawn 학생 대상 저장 시도 | 409 STUDENT_WITHDRAWN | AC-5 |
| 정정 후 감사로그 확인 | 출석→결석으로 PATCH | 감사로그에 이전값/새값 기록 | AC-6 |
| 출결 레코드 삭제 시도 | DELETE /attendance/{id} 요청(엔드포인트 없음) | 404 또는 라우트 없음 | AC-7 |
| 미래 날짜 입력 | date=내일 날짜로 저장 시도 | 422 INVALID_DATE | AC-8 |

## §7. 확정된 항목 (2026-09-05)
| 항목 | 확정 내용 |
|---|---|
| 원장의 직접 출결 체크 권한 | 가능 — 원장은 자기 지점 내 모든 반에 대해 강사와 동일한 체크 권한을 가짐. §0-1 권한 정책 및 마스터 TRD §1 역할 매트릭스에 반영 |
| 출결 수정(정정) 마감 기한 | 마감 없음 — 언제든 정정 가능하며 모든 변경은 감사로그에 남음 |
| 미래 날짜 출결 입력 허용 여부 | 금지 — 422 INVALID_DATE |
| 사유결석 "사유" 텍스트 별도 저장 | 저장 안 함 — 상태값 5종까지만, 자유텍스트 메모 없음 |
| 하루 여러 회차 수업과 `date` 컬럼 | 충분함 — 반이 다르면 별도 레코드로 구분되므로 `date`만으로 처리 |
