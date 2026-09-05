# 배포/롤백 절차 (Deployment & Rollback Runbook)

> 목적: `harness_05`는 "머지까지"만 다룹니다. 머지된 코드가 실제로 사용자에게
> 닿기까지, 그리고 문제가 생겼을 때 되돌리는 절차가 없으면 "코드는 완성됐는데
> 아무도 못 쓰는" 상태로 방치되거나, 장애가 났을 때 즉흥적으로 대응하다가
> 사태를 키우게 됩니다.

---

## §1. 환경 구성 [사람 작성 — 스택 확정 후]

| 환경 | 용도 | 데이터 | 접근 권한 |
|---|---|---|---|
| local/dev | 개발/AI 에이전트 작업 | 마스킹 시드 데이터만 | 개발자 |
| staging | 배포 전 최종 확인 | 마스킹 또는 익명화 데이터 | 개발자+검수자 |
| production | 실사용 | 실제 데이터 | 최소 인원, 별도 인증 |

## §2. 배포 전 체크리스트
- [ ] 대상 브랜치의 AC 전부 pass
- [ ] CI 통과
- [ ] 사람 diff 리뷰 승인 완료
- [ ] A0 인수인계 문서 갱신 완료
- [ ] 롤백 계획(§4)을 배포 담당자가 숙지했는가

## §3. 배포 절차

```mermaid
sequenceDiagram
    participant Dev as 개발(AI+사람)
    participant CI as CI
    participant Stg as Staging
    participant Approver as 배포 승인자
    participant Prod as Production

    Dev->>CI: PR merge (main)
    CI->>CI: 자동 테스트 실행
    CI-->>Dev: 통과 결과 알림
    Dev->>Stg: staging 배포
    Stg-->>Dev: 스모크 테스트 실행
    Dev->>Approver: 배포 승인 요청 (변경사항 요약)
    Approver-->>Dev: 승인 / 반려
    Dev->>Prod: production 배포 (승인된 경우만)
    Prod-->>Dev: 배포 후 헬스체크
    Dev->>Dev: 배포 이력 기록 (§5)
```

- **위험 명령(스키마 변경, 대량 데이터 작업)은 AI 에이전트가 직접 production에
  실행하지 않는다** (`harness_05 §3` 원칙 재확인) — 사람이 별도 세션에서 직접 실행.

## §4. 롤백 절차

```mermaid
flowchart TD
    A[장애/이상 징후 감지] --> B[심각도 판단]
    B -->|Critical: 서비스 중단/데이터 손상 위험| C[즉시 롤백 - 사후 보고]
    B -->|Major: 일부 기능 오류| D[영향범위 확인 후 롤백 여부 결정]
    B -->|Minor: 경미한 버그| E[핫픽스 브랜치로 정상 절차 진행]
    C --> F[이전 안정 버전으로 배포 되돌림]
    D --> F
    F --> G[롤백 완료 확인 - 헬스체크]
    G --> H[A0 §3 편차 섹션에 원인/대응 기록]
    H --> I["재발방지 필요시<br/>harness_06 실패패턴 라이브러리에 등록"]
```

## §5. 배포 이력

| 일시 | 버전/브랜치 | 배포자 | 승인자 | 결과 | 비고 |
|---|---|---|---|---|---|

## §6. 롤백 결정권자
- [ ] 사람 작성: 누가 "즉시 롤백" 여부를 최종 결정하는가 (`harness_11 RACI` 참조)
