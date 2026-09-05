# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트에서 세션을 시작할 때마다 자동으로 읽는
지속 지침 파일입니다. 절대 임의로 무시하지 마세요.

## ⚠️ Git 관련 작업 금지 (사용자 지시 — 최우선 규칙)

**Claude는 이 저장소에서 git과 관련된 어떠한 작업도 스스로 수행하지 않는다.**
`git status`/`diff`/`log` 같은 조회성 명령을 포함해 `add`/`commit`/`merge`/
`branch`/`push`/`rm` 등 상태를 바꾸는 명령까지 전부 금지 대상이다. 브랜치
생성, 커밋, 병합, 파일 삭제 등의 git 조작은 항상 사용자가 직접 수행한다.
git으로 확인해야 할 정보가 필요하면 사용자에게 직접 실행해달라고 요청하고
결과를 받아서 참고한다. 파일 내용 편집 자체(Read/Edit/Write)는 이 규칙의
대상이 아니다 — git 명령 실행만 금지다.

## 프로젝트 개요
- 프로젝트명: 학원관리 프로그램 (class-attend)
- 이 저장소는 `HARNESS_BASIC`(범용 하네스 템플릿)을 기반으로 생성된 **실제
  구현 프로젝트**입니다. `harness/` 아래 20종 문서는 그대로 가져온 절차/규칙
  이고, `docs/`, `src/`, `tests/`는 이 프로젝트의 실제 TRD·코드·테스트로
  채워 나갑니다.
- 신규 개발 — Phase A-1 요구사항 정의 진행 중 (마스터 TRD 초안 확정,
  단위별 상세 TRD·AC는 아직 작성 전)
- 기준 브랜치: `PROD_SCH` (사용자 확정, 2026-09-05)

## 요구사항 / 완성 정의 (Definition of Done)
- 1차 범위(MVP): 출결관리 중심 — 학생 등록/반 편성 + 출결 체크·조회.
  수납/시간표/성적/상담은 이번 범위 제외.
- 마스터 TRD(단위 분할 포함): `docs/trd/att_master_trd.md`
- 데이터모델·테넌시 관련 승인된 결정: `harness/harness_08_adr.md`
  ADR-001(지점 데이터 격리), ADR-002(학생-반-강사 관계)
- 단위(Unit) 목록: U1 지점·계정 관리 / U2 학생·반 관리 / U3 출결 체크 /
  U4 출결 조회·통계 / U5 학부모-자녀 연결 / U6 개인정보 생명주기 /
  U7 감사로그 — 각 단위의 상세 TRD·AC는 아직 미작성(다음 단계).
- 미결 항목(확정 필요): 개인정보 보유기간 정확 일수, 지점 신설/폐쇄 절차,
  출결 마감 시간, 통계 지표 — 상세는 `att_master_trd.md` §5 참고.

## 하네스 원칙 (harness/harness_00_overview.md 기반, 반드시 준수)

1. **스코프 준수**: `docs/trd/`에 없는 기능을 임의로 추가하지 않는다.
2. **에스컬레이션**: 정책이 불명확하면 임의로 판단하지 말고, 진행을 멈추고
   구체적으로 무엇이 불명확한지 보고한다. (예외: 작업지시서 §3에 기본값이
   명시된 항목은 그 기본값을 따라 진행)
3. **선행 확인**: 작업 시작 전 반드시 해당 단위의 TRD(`docs/trd/`)와
   작업지시서(`docs/workorder/`)를 먼저 읽는다.
4. **자기 검증**: 작업 완료 후 TRD의 AC(§5) 각 항목에 대해 스스로
   pass/fail을 점검하고 결과를 보고한다.
5. **판단 근거 기록**: 스펙에 명시 안 된 세부사항을 채웠다면, 왜 그렇게
   채웠는지 근거를 결과 보고에 포함한다.
6. **원본 우선**: 스펙과 실제 코드/데이터가 다르면 실제 쪽을 우선하고,
   이 사실을 반드시 보고한다.
7. **개인정보 보호**: 학생/보호자/교사 등 실제 개인정보는 실제 값 대신
   항상 샘플/마스킹 데이터만 사용한다. 실제 개인정보를 코드나 시드
   데이터에 하드코딩하지 않는다.
8. **되돌리기 어려운 결정 금지**: 데이터 모델 변경, 삭제 정책(물리삭제 등),
   권한 구조는 스스로 확정하지 말고 후보만 제시한 뒤 사람의 승인을 받는다.

## Git 워크플로우
- 프로젝트 착수 시 기준(base) 브랜치를 하나만 정하고 여기 명시한다 —
  선언한 기준 브랜치와 실제 push/PR 대상이 항상 일치하는지 확인한다.
- 기준 브랜치에는 직접 커밋하지 않는다.
- 작업 단위마다 `feature/{단위코드}` 브랜치를 새로 만들어 작업한다.
- 커밋 메시지 형식: `[{단위코드}] {한 일 요약}`
- 브랜치는 base에 실제로 병합된 것을 확인(`git merge-base --is-ancestor`)한
  뒤에만 삭제한다.

## 참고 문서 경로

### 기본 문서 (00~06)
- **처음 읽는 5분 요약**: `harness/harness_00_definition.md`
- 전체 SOP 및 타협 불가 규칙: `harness/harness_00_overview.md`
- TRD 템플릿: `harness/harness_01_trd_template.md`
- 작업지시서 템플릿: `harness/harness_02_work_order_template.md`
- 인수인계(A0) 템플릿: `harness/harness_03_handoff_template.md`
- 프롬프트 생성 규칙: `harness/harness_04_prompt_generator_template.md`
- 실행 인프라(브랜치/CI/권한/에스컬레이션): `harness/harness_05_execution_infra.md`
- 회고 및 실패 패턴 라이브러리: `harness/harness_06_meta_improvement.md`

### 확장 문서 (v1.1)
- 🔴 릴리스/우선순위 계획: `harness/harness_07_release_planning.md`
- 🔴 아키텍처 결정 기록(ADR): `harness/harness_08_adr.md`
- 🔴 배포/롤백 절차: `harness/harness_09_deployment_runbook.md`
- 🔴 개인정보 생애주기 정책: `harness/harness_10_data_lifecycle.md`
- 🟡 역할과 책임(RACI): `harness/harness_11_raci.md`
- 🟡 변경관리 프로세스: `harness/harness_12_change_management.md`
- 🟡 전역 기술 컨벤션: `harness/harness_13_tech_conventions.md`
- 🟡 테스트 데이터/시드 관리: `harness/harness_14_test_data_management.md`
- 🟡 병렬 작업/인터페이스 계약 관리: `harness/harness_15_parallel_work.md`
- 🟢 기술 부채 로그: `harness/harness_16_tech_debt_log.md`
- 🟢 모니터링/알림 기준: `harness/harness_17_monitoring.md`
- 🟢 AI 세션 비용/시간 추적: `harness/harness_18_cost_tracking.md`
- 🟢 템플릿 검증 체크: `harness/harness_19_template_validation.md`

## 알려진 실패 패턴
프로젝트 진행 중 새로 발견한 실패 패턴은 `harness/harness_06_meta_improvement.md`
§3 "실패 패턴 라이브러리"에 일반화된 형태로 누적하세요.