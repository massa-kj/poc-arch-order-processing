.PHONY: help dev prod build clean logs shell test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Start development environment
	docker compose up --build

prod: ## Start production environment (for PoC comparison)
	docker compose -f docker-compose.prod.yaml up --build -d

build: ## Build development images
	docker compose build

build-prod: ## Build production images
	docker compose -f docker-compose.prod.yaml build

clean: ## Clean up containers and volumes
	docker compose down -v
	docker compose -f docker-compose.prod.yaml down -v 2>/dev/null || true
	docker system prune -f

logs: ## Show logs from all services
	docker compose logs -f

shell: ## Access API container shell
	docker compose exec order-api sh

db-shell: ## Access database shell
	docker compose exec db psql -U postgres -d orders

stop: ## Stop all services
	docker compose stop
	docker compose -f docker-compose.prod.yaml stop 2>/dev/null || true

down: ## Stop and remove containers
	docker compose down
	docker compose -f docker-compose.prod.yaml down 2>/dev/null || true
