.PHONY: help dev build clean logs shell test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Start development environment
	docker compose up --build

build: ## Build development images
	docker compose build

clean: ## Clean up containers and volumes
	docker compose down -v
	docker system prune -f

logs: ## Show logs from all services
	docker compose logs -f

shell: ## Access API container shell
	docker compose exec order-api sh

db-shell: ## Access database shell
	docker compose exec db psql -U postgres -d orders

stop: ## Stop all services
	docker compose stop

down: ## Stop and remove containers
	docker compose down
