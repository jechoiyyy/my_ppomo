SHELL := /bin/bash

.PHONY: help install dev build \
	docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-clean \
	prisma-generate prisma-push seed \
	clean reset

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Local"
	@echo "  install          Install workspace dependencies"
	@echo "  dev              Run backend/frontend in dev mode"
	@echo "  build            Build backend/frontend"
	@echo ""
	@echo "Docker"
	@echo "  docker-build     Build Docker images"
	@echo "  docker-up        Start all containers in background"
	@echo "  docker-down      Stop and remove containers"
	@echo "  docker-restart   Restart all containers"
	@echo "  docker-logs      Follow compose logs"
	@echo "  docker-ps        Show compose status"
	@echo "  docker-clean     Down + remove volumes + prune dangling images"
	@echo ""
	@echo "Backend (Prisma)"
	@echo "  prisma-generate  Generate Prisma client"
	@echo "  prisma-push      Push schema to DB"
	@echo "  seed             Seed admin user"
	@echo ""
	@echo "Cleanup"
	@echo "  clean            Remove local build artifacts"
	@echo "  reset            clean + reinstall dependencies"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-restart:
	docker compose down
	docker compose up -d

docker-logs:
	docker compose logs -f

docker-ps:
	docker compose ps

docker-clean:
	docker compose down -v --remove-orphans
	docker image prune -f

prisma-generate:
	npm run prisma:generate -w backend

prisma-push:
	npm run prisma:push -w backend

seed:
	npm run seed -w backend

clean:
	rm -rf backend/dist frontend/dist backend/.turbo frontend/.turbo

reset: clean
	rm -rf node_modules backend/node_modules frontend/node_modules
	npm install
