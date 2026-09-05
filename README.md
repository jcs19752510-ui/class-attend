# class-attend — 학원관리 프로그램

`HARNESS_BASIC`(범용 거버넌스 하네스)을 템플릿으로 생성된 실제 구현
프로젝트입니다. `harness/` 아래 20종 문서는 하네스 원본 그대로의 절차/규칙
이고, `docs/`, `src/`, `tests/`는 이 프로젝트의 실제 TRD·코드·테스트로
채워 나갑니다.

## 현재 상태

- 요구사항 미확정 — Phase A(프로젝트 착수) 진행 전 단계
- 기준 브랜치 미확정 (원격에 `main`/`PROD`/`PROD_SCH` 존재, 하나로 정리 예정)
- `docs/`, `src/`, `tests/`는 아직 빈 골격(`.gitkeep`)

## 무엇부터 읽어야 하나

| 목적 | 문서 |
|---|---|
| 이 프로젝트의 지침/원칙 (Claude Code 세션 시작 시 항상 먼저 읽음) | [`CLAUDE.md`](CLAUDE.md) |
| 하네스 5분 요약(전체 지도) | [`harness/harness_00_definition.md`](harness/harness_00_definition.md) |
| SOP 및 타협 불가 8원칙 | [`harness/harness_00_overview.md`](harness/harness_00_overview.md) |
| 문서 20종 전체 목록 | `harness/harness_00_definition.md` §3 |
| 진행 현황(인수인계) | `docs/handoff/` *(작성 전)* |

## 작업 절차 요약

1. **Phase A (착수, 1회)**: 요구사항 정의 → 데이터모델 ADR → 전역 기술 컨벤션 →
   마스터 TRD → 릴리스 우선순위 (`harness_00_definition.md` §4)
2. **Phase B (단위별 반복)**: 단위 TRD/AC 확정 → 작업지시서 작성 → 프롬프트
   생성·AI 실행 → AC 통과 확인 + 사람 리뷰 → `feature/{단위코드}` 브랜치
   머지 → 인수인계 문서 갱신
3. **Phase C (마감)**: 통합 E2E 테스트 → 배포 → 모니터링 → 회고

## Git 워크플로우

- 기준 브랜치는 하나로 확정해 `CLAUDE.md`에 명시 (진행 예정)
- 기준 브랜치에는 직접 커밋하지 않음
- 작업 단위마다 `feature/{단위코드}` 브랜치 생성, 커밋 메시지 `[{단위코드}] {요약}`
- AC 통과 + diff 리뷰 완료 후에만 머지

## 라이선스

[MIT](LICENSE)