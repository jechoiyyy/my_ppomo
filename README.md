# Pomodoro Sync Planner

React + TypeScript + Node.js + PostgreSQL 기반 포모도로/할일 앱입니다.

## Makefile

주요 실행/정리 명령:

- `make help`: 전체 명령 보기
- `make install`: 의존성 설치
- `make dev`: 로컬 개발 실행
- `make build`: 빌드
- `make docker-up`: 도커 실행
- `make docker-down`: 도커 중지
- `make docker-logs`: 로그 확인
- `make docker-clean`: 컨테이너/볼륨 정리
- `make reset`: 의존성 재설치 포함 초기화

## Quick Start (Docker)

1. `make docker-build`
2. `make docker-up`
3. Frontend: `http://localhost:4242`
4. Backend health: `http://localhost:8080/healthz`

초기 관리자 계정은 `backend/.env.example` 값을 사용합니다.

## Local Development

1. PostgreSQL 실행
2. `cp backend/.env.example backend/.env`
3. `make install`
4. `make dev`
