# Pomodoro Sync Planner

React + TypeScript + Node.js + PostgreSQL 기반 포모도로/할일 앱입니다.

## Quick Start (Docker)

1. `docker compose build`
2. `docker compose up -d`
3. Frontend: `http://localhost:5173`
4. Backend health: `http://localhost:8080/healthz`

초기 관리자 계정은 `backend/.env.example` 값을 사용합니다.

## Local Development

1. PostgreSQL 실행
2. `cp backend/.env.example backend/.env`
3. 루트에서 `npm install`
4. `npm run dev`
