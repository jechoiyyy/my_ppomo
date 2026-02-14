# Pomodoro Sync Planner - 요구사항/기술 명세서

## 1) 문서 목적
- 구현 이전 합의 문서
- 기능 요구사항, 데이터 모델, API, 배포 방식(Docker) 정의

## 2) 시스템 개요
- 단일 사용자 중심 웹 앱
- 다중 PC 접속 가능
- 중앙 서버 + DB를 통해 데이터 동기화
- 실시간 동시편집/충돌해결 고도화는 범위 외

## 3) 기능 요구사항 (Functional Requirements)

## FR-1 인증
- 이메일/비밀번호 기반 로그인
- MVP에서는 계정 1개(관리자 성격)만 운영
- 회원가입 API는 제공하지 않음
- 로그인 세션은 JWT(access token + refresh token) 사용
- 운영 시작 시 초기 관리자 계정은 서버 시드 또는 환경변수로 생성

## FR-2 할 일 관리
- 할 일 생성/조회/수정/삭제
- 필드:
  - 제목(필수), 설명(선택), 우선순위(낮음/보통/높음)
  - 상태(todo/in_progress/done)
  - 계획일(plannedDate): 오늘/내일 분류의 기준
  - 예상 포모도로 수(estimatePomodoros)
  - 실제 완료 포모도로 수(completedPomodoros)
- 리스트 필터:
  - 전체, 오늘, 내일, 완료

## FR-3 포모도로 타이머
- 세션 타입:
  - focus, short_break, long_break
- 기본값:
  - focus 25분, short break 5분, long break 15분
- 동작:
  - 시작/일시정지/재개/중지
  - focus 완료 시 세션 기록 저장
  - 특정 task와 연결하여 completedPomodoros 증가

## FR-4 일정 뷰 (오늘/내일)
- plannedDate 기준으로 Today/Tomorrow 탭 구성
- 드래그 앤 드롭은 MVP 제외, 버튼/메뉴로 날짜 이동

## FR-5 통계
- 일간:
  - 완료된 focus 세션 수
  - 총 집중 시간(분)
  - 완료한 할 일 수
- 주간:
  - 날짜별 집중 시간 집계

## FR-6 동기화
- 모든 데이터는 서버 DB에 저장
- 페이지 로드 시 최신 상태 조회
- 생성/수정/삭제 후 해당 목록 재조회
- 실시간 동기화(WebSocket) 없음
- 동기화 충돌 감지 시 경고 문구 표시 후 최신 서버 상태로 갱신
  - 기본 문구: `다른 PC에서 변경됨. 최신 데이터로 갱신합니다.`

## FR-7 진행 중 세션 복구 정책
- 앱 재접속/새로고침 시 서버에 `in_progress` 세션이 남아 있으면 자동 복구하지 않음
- 남아 있는 `in_progress` 세션은 시스템 취소(`cancelled_by=recovery`) 처리
- 클라이언트 타이머 상태는 `short_break` 초기 상태로 리셋

## 4) 비기능 요구사항 (Non-Functional Requirements)

## NFR-1 성능
- 일반 조회 API 응답: 500ms 이내(로컬 환경 기준)
- 대시보드 초기 렌더 2초 이내 목표

## NFR-2 신뢰성
- 타이머 완료 이벤트는 서버 저장 성공 시 UI 반영
- 예외 발생 시 재시도 및 사용자 오류 표시

## NFR-3 보안
- 비밀번호 해시 저장(bcrypt)
- 인증 없는 API 접근 차단
- CORS/CSRF 기본 대응
- refresh token 저장소(DB) 사용 및 로그아웃 시 토큰 폐기

## NFR-4 운영성
- `docker compose up -d`로 실행 가능
- `.env` 기반 설정
- DB 볼륨 영속화

## NFR-5 확장성
- 향후 다중 사용자/실시간 기능 추가 가능한 계층 구조 유지

## 5) 데이터 모델 (초안)

## 5.1 User
- id (uuid, pk)
- email (unique)
- passwordHash
- timezone (IANA 문자열, 예: `Asia/Seoul`, 사용자 설정값 사용)
- createdAt, updatedAt

## 5.2 Task
- id (uuid, pk)
- userId (fk -> User)
- title (varchar 200)
- description (text, nullable)
- priority (`low|medium|high`)
- status (`todo|in_progress|done`)
- plannedDate (date, nullable)
- estimatePomodoros (int, default 1)
- completedPomodoros (int, default 0)
- createdAt, updatedAt, completedAt(nullable)

## 5.3 PomodoroSession
- id (uuid, pk)
- userId (fk -> User)
- taskId (fk -> Task, nullable)
- sessionType (`focus|short_break|long_break`)
- durationSec (int)
- startedAt (timestamp)
- endedAt (timestamp, nullable)
- completed (boolean, default false)
- status (`in_progress|completed|cancelled`)
- cancelledBy (`user|recovery|system`, nullable)
- createdAt

## 5.4 UserSetting
- id (uuid, pk)
- userId (unique fk -> User)
- focusMin (int, default 25)
- shortBreakMin (int, default 5)
- longBreakMin (int, default 15)
- longBreakInterval (int, default 4)
- autoStartBreak (boolean, default false)
- autoStartFocus (boolean, default false)
- soundEnabled (boolean, default true)
- updatedAt

## 6) API 명세 (REST, v1)
- 표준:
  - 날짜/시간: ISO-8601 UTC (`2026-02-13T09:00:00Z`)
  - 에러 응답: RFC 7807 (`application/problem+json`)
  - 성공/실패 HTTP status code 준수(200/201/204/400/401/403/404/409/422/500)
  - 리스트 응답: `items`, `page`, `pageSize`, `total`

## 6.1 Auth
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## 6.2 Tasks
- `GET /api/v1/tasks?filter=today|tomorrow|all|completed`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `PATCH /api/v1/tasks/:id`
- `DELETE /api/v1/tasks/:id`

## 6.3 Sessions
- `POST /api/v1/sessions/start`
- `POST /api/v1/sessions/:id/complete`
- `POST /api/v1/sessions/:id/cancel`
- `POST /api/v1/sessions/recovery/reset`
- `GET /api/v1/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD`

## 6.4 Stats
- `GET /api/v1/stats/daily?date=YYYY-MM-DD`
- `GET /api/v1/stats/weekly?start=YYYY-MM-DD`

## 6.5 Settings
- `GET /api/v1/settings`
- `PATCH /api/v1/settings`

## 7) 주요 비즈니스 규칙
- focus 세션이 `complete`일 때만 통계 반영
- 세션이 taskId와 연결되어 있으면 `Task.completedPomodoros += 1`
- `Task.status = done` 전환 시 `completedAt` 기록
- plannedDate가 오늘/내일이면 각 탭에 노출
- 이미 `completed/cancelled` 상태 세션은 재완료 불가 (`409 Conflict`)
- `durationSec`, `estimatePomodoros`, `completedPomodoros`는 음수 불가
- 세션 완료 시 서버가 `startedAt/endedAt` 기준 duration 유효성 검증

## 8) 화면 명세 (초안)

## 8.1 Dashboard
- 오늘 진행률 카드
- 현재 타이머 위젯
- 오늘 할 일 상위 N개

## 8.2 Tasks Page
- 필터 탭: All / Today / Tomorrow / Completed
- 리스트 + 빠른 수정(상태, 우선순위, 날짜)

## 8.3 Timer Page
- 큰 타이머 표시
- 연결된 현재 작업 표시/변경
- 세션 제어 버튼

## 8.4 Insights Page
- 일간/주간 차트
- 누적 집중 시간, 완료 task 수

## 9) Docker 배포 명세

## 9.1 서비스 구성
- `frontend`: React 앱 (Nginx 서빙 또는 Vite preview)
- `backend`: Node.js API 서버
- `db`: PostgreSQL

## 9.2 네트워크/포트 (예시)
- frontend: `http://localhost:4242`
- backend: `http://localhost:8080`
- db: `5432` (외부 노출은 선택)

## 9.3 볼륨
- postgres data volume 영속화 필수

## 9.4 환경변수 (예시)
- backend:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `CORS_ORIGIN`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
- frontend:
  - `VITE_API_BASE_URL`

## 9.5 운영 디테일
- 서비스 healthcheck 정의
  - frontend: 정적 응답 확인
  - backend: `/healthz`
  - db: `pg_isready`
- backend는 db healthcheck 통과 후 기동
- 마이그레이션 실행 순서:
  1. db 기동
  2. migration 적용
  3. admin 계정 시드
  4. backend 기동
- 백업/복구:
  - 백업: `pg_dump` 기반 일 단위 백업
  - 복구: `psql` restore 가이드 문서 제공

## 10) 테스트 전략
- 프론트:
  - 컴포넌트 단위 테스트 (Timer, TaskItem)
  - 핵심 사용자 흐름 E2E(할 일 생성 -> 타이머 완료)
- 백엔드:
  - 서비스 단위 테스트(세션 완료 시 통계 반영)
  - API 통합 테스트(tasks/sessions/stats)
- 필수 합격 기준:
  - 로그인/토큰 갱신/로그아웃 흐름 모두 통과
  - 타이머 완료 시 세션 기록 + task completedPomodoros 증가 검증
  - 다중 PC 시나리오에서 stale 경고 후 최신 데이터 반영 검증
  - recovery reset 호출 시 `in_progress -> cancelled(recovery)` 전환 검증

## 11) 리스크 및 대응
- 로컬 타이머 정확도 이슈(브라우저 백그라운드 탭 제한)
  - 대응: 종료 시점 timestamp 기반으로 서버에서 보정
- 다중 PC 순차 사용 중 마지막 저장 덮어쓰기
  - 대응: MVP는 last write wins, 추후 버전 필드 도입
- 단일 사용자 인증 관리 단순화에 따른 보안 약점
  - 대응: 초기 배포 대상 제한, 이후 다중 사용자 전환 시 강화

## 12) 구현 순서 제안
1. 모노레포 초기화(frontend/backend/shared)
2. Auth + User + Settings
3. Task CRUD + Today/Tomorrow 필터
4. Timer + Session 저장
5. Stats 집계 API + 화면
6. Docker Compose + 운영 문서

## 13) DB 제약조건/인덱스 (필수)
- 제약조건:
  - `tasks.estimate_pomodoros >= 0`
  - `tasks.completed_pomodoros >= 0`
  - `sessions.duration_sec > 0`
  - enum 필드는 정의된 값만 허용
- 인덱스:
  - `tasks(user_id, planned_date, status)`
  - `tasks(user_id, updated_at desc)`
  - `pomodoro_sessions(user_id, started_at desc)`
  - `pomodoro_sessions(task_id, started_at desc)`
