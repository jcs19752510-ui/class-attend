# U1. 지점·계정 관리 — 단위 TRD

> `harness_01_trd_template.md` 기반. [AI 초안] 표시 항목은 사람 확정 전
> 초안입니다 — §7 미결 항목을 꼭 확인해주세요.

## 문서 정보
- 프로젝트: class-attend (att)
- 단위(화면/기능) 이름: U1. 지점·계정 관리
- 작성일 / 버전: 2026-09-05 / v0.2
- 상태: 확정 (2026-09-05, AC·미결항목 전체 승인 완료 — 구현 대기)

## §0. 범위 및 흐름 개요
- 이 단위가 담당하는 역할: 프랜차이즈 관리자가 지점을 생성하고, 지점 원장/강사
  계정을 발급·배정한다. 학부모는 셀프 회원가입한다. 모든 역할(4종)의 로그인·
  인증이 이 단위에 속한다.
- 화면/기능 흐름:
  ```mermaid
  flowchart TD
      A[프랜차이즈 관리자 로그인] --> B[지점 생성]
      B --> C[원장 계정 발급 + 지점 배정]
      C --> D[원장 최초 로그인 - 비밀번호 변경 강제]
      D --> E[원장이 강사 계정 발급 + 지점 배정]
      E --> F[강사 최초 로그인 - 비밀번호 변경 강제]
      G[학부모: 셀프 회원가입] --> H[학부모 로그인]
      H -.자녀 연결은 U5에서 처리.-> I((U5로 이동))
  ```
- 이 단위가 의존하는 다른 단위 (선행 조건): 없음 — 프로젝트의 최초 단위.
- 이 단위에 의존하는 다른 단위 (후행 영향): U2(학생·반 관리는 지점·강사 계정
  필요), U3(출결 체크는 강사 로그인 필요), U5(학부모 계정 필요), U7(계정
  생성/변경 이벤트가 감사로그 기록 대상).

## §0-1. 비기능 요구사항 체크
- **동시성**: 이메일은 전역 유니크 제약. 동시 회원가입 요청 시 DB unique
  constraint 위반으로 후행 요청이 자동 거부됨(409).
- **권한**: 지점 생성 = 프랜차이즈 관리자만. 원장 계정 발급 = 프랜차이즈
  관리자만(초안 — §7 미결). 강사 계정 발급 = 원장만. 학부모 = 셀프 가입.
- **감사(audit)**: 계정 생성·역할변경·비활성화 이벤트는 행위자/시각/대상/
  변경내용을 감사로그(U7)에 기록해야 함 — 이 단위 구현 시 로깅 호출을 함께
  심어야 함(§5 실행 순서 참고).
- **개인정보**: 이 단위에서 다루는 개인정보는 이메일·이름·연락처(계정
  소유자 본인 것)뿐. 학생 개인정보(생년월일 등)는 U2 소관.
- **삭제 정책**: 계정은 소프트 삭제(비활성화)만 허용, 물리 삭제는 제공하지
  않음 — **확정(ADR-003, 2026-09-05 승인)**.

## §1. 데이터 구조 [AI 초안]
```
Branch
  id (PK)
  name
  address
  phone
  status (active/closed)
  created_at

User
  id (PK)
  email (unique, not null)
  password_hash
  name
  phone
  role (enum: franchise_admin / director / teacher / parent)
  branch_id (FK -> Branch.id, nullable)
    - franchise_admin: NULL (전체 지점 대상)
    - director, teacher: NOT NULL (반드시 하나의 지점 소속)
    - parent: NULL (특정 지점에 속하지 않고 U5에서 자녀를 통해 간접 연결)
  status (active/inactive)
  must_change_password (bool, 최초 로그인 후 false로 전환)
  created_at
```
> `parent`의 `branch_id`를 NULL로 둔 이유: 학부모는 여러 지점에 자녀를 보낼
> 수도 있고(형제가 다른 지점), 가입 시점에는 아직 자녀와 연결되지 않았기
> 때문입니다. 다지점 소속 학부모 케이스가 실제로 있는지는 §7 미결 항목.

## §2. 함수/API 명세 [AI 초안]
| 함수/엔드포인트 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `POST /branches` | name, address, phone | branch_id | 지점 생성 (franchise_admin 전용) |
| `POST /users` (role=director/teacher) | email, name, phone, role, branch_id | user_id, temp_password | 계정 발급 + 임시 비밀번호 생성 |
| `POST /auth/signup` (role=parent) | email, password, name, phone | user_id | 학부모 셀프 회원가입 |
| `POST /auth/login` | email, password | token, must_change_password | 로그인 |
| `POST /auth/change-password` | old_password, new_password | - | 비밀번호 변경 (최초 로그인 시 강제) |
| `PATCH /users/{id}/deactivate` | - | - | 계정 비활성화(소프트 삭제) |

## §3. 워크플로우 및 비즈니스 로직
- 정상 흐름: 위 §0 mermaid 순서대로 진행.
- 예외 상황:
  - 이메일 중복 가입 시도 → 409 EMAIL_DUPLICATE, 계정 미생성.
  - 비활성화된 계정으로 로그인 시도 → 423 ACCOUNT_DEACTIVATED.
  - franchise_admin이 아닌 사용자가 지점 생성 API 호출 → 403 FORBIDDEN_ROLE.
  - 원장이 아닌 사용자가 강사 계정 발급 API 호출 → 403 FORBIDDEN_ROLE.
  - 원장이 자기 지점이 아닌 `branch_id`로 강사 계정을 발급하려는 시도 →
    403 FORBIDDEN_BRANCH (ADR-001의 `branch_id` 격리 규칙 적용 지점).
- §0-1 권한 정책 적용 위치: 모든 API가 요청자의 `role`과 `branch_id`를
  검증한 뒤에만 동작(ADR-001의 전역 규칙을 이 단위부터 적용).

## §4. 상태/에러 코드 [AI 초안]
| 코드 | 의미 | 발생 조건 |
|---|---|---|
| 409 EMAIL_DUPLICATE | 이메일 중복 | 이미 존재하는 이메일로 가입/발급 시도 |
| 403 FORBIDDEN_ROLE | 권한 없는 역할 | role 기준 접근 불가 API 호출 |
| 403 FORBIDDEN_BRANCH | 타 지점 접근 | 자기 지점이 아닌 branch_id 대상 조작 시도 |
| 401 INVALID_CREDENTIALS | 인증 실패 | 이메일/비밀번호 불일치 |
| 423 ACCOUNT_DEACTIVATED | 비활성 계정 | status=inactive 계정으로 로그인 시도 |
| 403 PASSWORD_CHANGE_REQUIRED | 비밀번호 미변경 | mustChangePassword=true 상태에서 change-password 외 API 호출 (AC-3 구현 중 추가 — 원본 TRD에 없던 코드) |
| 422 VALIDATION_ERROR | 입력값 검증 실패 | 필수 필드 누락(예: branchId), 비밀번호 정책 위반 등 (구현 중 추가) |

> 구현 중 판단 근거: 계정 비활성화(`PATCH /users/{id}/deactivate`) API를
> 누가 누구에게 실행할 수 있는지는 원 TRD에 명시되지 않아, 역할 위계상
> 합리적으로 "franchise_admin은 전체, director는 자기 지점 teacher만"으로
> 구현했다(코드: `src/app/api/users/[id]/deactivate/route.ts` 주석 참고).
> 이 가정은 재검토 대상 — `AUTO_CONFIRM_CONTENTS.MD`에도 기록함.

## §5. 인수 조건 (Acceptance Criteria)
- [ ] AC-1: franchise_admin role이 아닌 사용자가 지점 생성 API를 호출하면
      403 FORBIDDEN_ROLE을 반환하고 지점이 생성되지 않는다.
- [ ] AC-2: 동일 이메일로 두 번째 계정 생성을 시도하면 409 EMAIL_DUPLICATE를
      반환하고 기존 계정은 변경되지 않는다.
- [ ] AC-3: director/teacher 계정은 최초 로그인 성공 시
      `must_change_password=true`가 응답에 포함되며, 비밀번호를 변경하기
      전까지는 로그인 화면 외 다른 API 호출이 거부된다.
- [ ] AC-4: status=inactive 계정으로 로그인 시도하면 423
      ACCOUNT_DEACTIVATED를 반환하고 토큰이 발급되지 않는다.
- [ ] AC-5: teacher 계정 생성 시 branch_id가 없으면 생성 요청 자체가
      거부된다(필수 컬럼 검증).
- [ ] AC-6: 계정 생성/역할변경/비활성화가 발생하면 감사로그에 행위자·
      시각·대상 user_id·변경 내용이 1건씩 기록된다.
- [ ] AC-7: parent 회원가입은 branch_id 입력 없이 성공하며, 가입 직후
      조회 시 연결된 학생이 0명으로 조회된다.
- [ ] AC-8: 원장이 자기 소속 지점이 아닌 branch_id로 강사 계정을
      발급하려 하면 403 FORBIDDEN_BRANCH를 반환한다.

## §6. 테스트 시나리오
| 시나리오 | 입력/조건 | 기대 결과 | 대응 AC |
|---|---|---|---|
| 일반 사용자의 지점 생성 시도 | role=teacher 토큰으로 POST /branches | 403 FORBIDDEN_ROLE | AC-1 |
| 중복 이메일 가입 | 이미 존재하는 email로 POST /auth/signup | 409 EMAIL_DUPLICATE | AC-2 |
| 강사 최초 로그인 | teacher 계정, must_change_password=true 상태 | 비밀번호 변경 전 다른 API 403 | AC-3 |
| 비활성 계정 로그인 | status=inactive 계정으로 로그인 | 423 ACCOUNT_DEACTIVATED | AC-4 |
| branch_id 없는 강사 생성 | POST /users role=teacher, branch_id 누락 | 요청 거부(422 등 검증 에러) | AC-5 |
| 계정 발급 후 감사로그 확인 | 원장이 강사 계정 발급 | 감사로그 1건 생성, 행위자=원장 | AC-6 |
| 학부모 가입 직후 자녀 조회 | parent 신규 가입 후 연결 학생 목록 조회 | 빈 배열 반환 | AC-7 |
| 원장의 타 지점 계정 발급 시도 | 원장 A(지점1)가 branch_id=지점2로 강사 발급 | 403 FORBIDDEN_BRANCH | AC-8 |

## §7. 확정된 항목 (2026-09-05)
| 항목 | 확정 내용 |
|---|---|
| 원장 계정 발급 주체 | franchise_admin(본사)만 발급 가능. §2 `POST /users`(role=director)는 franchise_admin 토큰만 허용, 그 외 role 호출 시 403 FORBIDDEN_ROLE |
| 계정 물리 삭제 허용 여부 | 물리 삭제 없음, 소프트 삭제(비활성화)만 — ADR-003 승인 완료 |
| 초기 비밀번호 전달 방식 | 이메일 발송(임시 비밀번호 포함 메일 발송). 발송 실패 시 계정은 생성되지만 관리자 화면에서 재발송 가능해야 함(재발송 API는 구현 시 추가) |
| 학부모 1계정-다지점 자녀 지원 여부 | 지원함 — `branch_id`는 `User` 테이블이 아니라 U5의 학부모-학생 연결 테이블(`parent_student_link`) 쪽에서 학생별로 결정됨. §1의 `parent.branch_id = NULL` 설계와 일치 |
| 비밀번호 정책 | 최소 8자 이상, 영문/숫자/특수문자 중 2종류 이상 조합. 재설정은 가입 이메일로 재설정 링크 발송(초기 비밀번호 발송과 동일한 이메일 인프라 재사용). 표준적인 기본값으로 제안·확정 — 추후 `harness_13_tech_conventions.md` 작성 시 전역 규칙으로 승격 검토 |

> 위 5개 항목은 모두 이번 검토에서 확정되어 더 이상 미결 항목이 아닙니다.
> 남은 것은 실제 이메일 발송 인프라(어떤 서비스로 메일을 보낼지)를 U1 작업
> 지시서 작성 시점에 정하는 정도입니다.
