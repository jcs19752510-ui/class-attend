# U4. 출결 조회·통계 — 단위 TRD

> `harness_01_trd_template.md` 기반. 2026-09-06 사용자 지시("특별히 확인이
> 필요한 사항이 아니면 자동 확정하고 끝까지 진행")에 따라, 데이터모델/
> 삭제정책/권한구조급 결정이 아닌 세부 설계는 자동 확정하여 작성함
> (근거는 각 항목에 표기, `AUTO_CONFIRM_CONTENTS.MD`에도 기록).

## 문서 정보
- 프로젝트: class-attend (att)
- 단위(화면/기능) 이름: U4. 출결 조회·통계
- 작성일 / 버전: 2026-09-06 / v0.1
- 상태: 확정(자동 확정 절차로 진행) — 구현과 동시 진행

## §0. 범위 및 흐름 개요
- 원시 출결 목록 조회(`GET /attendance?classId=&date=`)는 이미 U3에 있음.
  이 단위는 **기간별 집계(통계)** 만 다룬다.
- 흐름:
  ```mermaid
  flowchart TD
      P[학부모] -->|자기 자녀만| S1["GET /students/{id}/attendance-summary"]
      D[원장] -->|자기 지점 학생| S1
      HQ[본사] -->|전체 지점, 조회전용| S1
      T[강사] -->|배정된 반만| S2["GET /classes/{id}/attendance-summary"]
      D --> S2
  ```
- 선행 조건: U3(Attendance 데이터), U5(학부모-자녀 승인 연결).
- 후행 영향: 없음(최종 소비 단위).

## §0-1. 비기능 요구사항 체크
- 동시성: 조회 전용 — N/A.
- 권한: §5 AC 참고. 학생별 요약은 director/franchise_admin(조회전용)/parent
  (본인 자녀만), 반별 요약은 director/teacher(배정된 반만). **teacher는
  학생별 요약 엔드포인트 접근 불가**(자동 확정 — 근거: 강사가 자신이
  가르치지 않는 반까지 포함해 학생 전체 이력을 볼 수 있게 되는 권한
  과다 부여를 막기 위함. 강사는 반 단위 요약으로 충분).
- 감사(audit): 이 단위의 조회는 **감사로그에 남기지 않는다**(자동 확정 —
  근거: `att_u7_trd.md` §7에서 "목록성 조회는 로깅 대상 아님"으로 이미
  확정된 원칙과 일관성 유지. 개별 학생 상세 열람은 이미 U2
  `GET /students/{id}`에서 별도로 로깅되고 있음).
- 개인정보: 신규 개인정보 항목 없음 — 기존 Attendance 데이터를 집계만 함.
- 삭제 정책: N/A(조회 전용, 데이터 변경 없음).

## §1. 데이터 구조
- 신규 테이블 없음. 기존 `Attendance` 레코드를 `groupBy`로 집계.

## §2. 함수/API 명세
| 엔드포인트 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `GET /students/{id}/attendance-summary` | dateFrom, dateTo (쿼리) | `{ studentId, dateFrom, dateTo, counts: { present, absent, late, early_leave, excused_absence } }` | 학생 1명의 기간별 상태별 건수 |
| `GET /classes/{id}/attendance-summary` | dateFrom, dateTo (쿼리) | `{ classId, dateFrom, dateTo, students: [{ studentId, name, counts: {...} }] }` | 반 소속 학생별 기간별 집계 |

## §3. 워크플로우 및 비즈니스 로직
- `GET /students/{id}/attendance-summary`:
  - director: `requireBranchAccess`로 자기 지점 학생만.
  - franchise_admin: 전체 허용(조회전용 역할이므로 항상 허용).
  - parent: 요청한 studentId가 자신의 **승인된**(status=approved)
    `ParentStudentLink`에 있어야 함 — 없으면 403 FORBIDDEN_ROLE.
  - teacher: 항상 403 FORBIDDEN_ROLE(§0-1 근거 참고).
- `GET /classes/{id}/attendance-summary`:
  - director: 자기 지점 반만(`requireBranchAccess`).
  - teacher: `class_teacher`에 활성 배정이 있어야 함(U3와 동일 검증 재사용).
- dateFrom/dateTo 범위 밖의 Attendance 레코드는 집계에서 제외한다.

## §4. 상태/에러 코드
| 코드 | 의미 | 발생 조건 |
|---|---|---|
| 403 FORBIDDEN_ROLE | 권한 없음 | teacher의 학생별 요약 요청, 학부모의 미승인 학생 요청, 미배정 강사의 반별 요약 요청 |
| 403 FORBIDDEN_BRANCH | 타 지점 접근 | director의 타 지점 학생/반 요청 |
| 404 NOT_FOUND | 대상 없음 | 존재하지 않는 studentId/classId |

## §5. 인수 조건 (Acceptance Criteria)
- [ ] AC-1: 학부모가 자신에게 승인 연결되지 않은 학생의 요약을 요청하면
      403 FORBIDDEN_ROLE을 반환한다.
- [ ] AC-2: 학부모가 자신의 승인된 자녀의 요약을 요청하면 상태별 건수가
      정상 반환된다.
- [ ] AC-3: director가 자기 지점이 아닌 학생의 요약을 요청하면
      403 FORBIDDEN_BRANCH를 반환한다.
- [ ] AC-4: teacher가 `GET /students/{id}/attendance-summary`를 호출하면
      403 FORBIDDEN_ROLE을 반환한다.
- [ ] AC-5: teacher가 배정되지 않은 반의 요약을 요청하면
      403 FORBIDDEN_ROLE을 반환한다.
- [ ] AC-6: dateFrom/dateTo 범위 밖의 출결 기록은 counts에 포함되지 않는다.
- [ ] AC-7: franchise_admin은 지점 구분 없이 모든 학생의 요약을 조회할 수
      있다.

## §6. 테스트 시나리오
| 시나리오 | 입력/조건 | 기대 결과 | 대응 AC |
|---|---|---|---|
| 미승인 학부모 요청 | 승인되지 않은 studentId로 요청 | 403 FORBIDDEN_ROLE | AC-1 |
| 승인된 학부모 요청 | 승인된 studentId로 요청, 출결 3건 존재 | counts 합계가 3건과 일치 | AC-2 |
| 타 지점 director 요청 | 원장(지점1)이 지점2 학생 요약 요청 | 403 FORBIDDEN_BRANCH | AC-3 |
| teacher의 학생별 요약 요청 | teacher가 GET /students/{id}/attendance-summary | 403 FORBIDDEN_ROLE | AC-4 |
| 미배정 teacher의 반별 요약 요청 | class_teacher에 없는 teacher가 요청 | 403 FORBIDDEN_ROLE | AC-5 |
| 기간 필터링 | dateFrom~dateTo 밖의 레코드 포함 데이터 | 범위 밖 레코드는 집계 제외 | AC-6 |
| 본사 전체 조회 | franchise_admin이 임의 지점 학생 요약 요청 | 200 정상 반환 | AC-7 |

## §7. 확정된 항목 (자동 확정, 2026-09-06)
| 항목 | 확정 내용 | 근거 |
|---|---|---|
| 통계 지표 범위 | 상태별(5종) 건수 집계만 제공(출석률 %, 그래프 등 고도화 지표는 제외) | MVP 범위 최소화 — 필요 시 v0.2에서 프론트엔드가 counts로부터 계산 가능 |
| 통계 조회의 감사로그 기록 여부 | 기록 안 함 | U7 §7 "목록성 조회 비로깅" 원칙과 일관 |
| teacher의 학생별 요약 접근 | 불가(반별 요약만 허용) | 권한 과다 부여 방지 |
