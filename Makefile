PYTHON := backend/.venv/bin/python
UVICORN := backend/.venv/bin/uvicorn

.PHONY: help setup dev frontend backend pipeline db-up db-down reset clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Setup ─────────────────────────────────────────────────────────────

setup: ## First-time setup: install deps, create DB, run pipeline
	./setup.sh setup

install: ## Install all dependencies (Node + Python)
	npm install
	python3 -m venv backend/.venv
	$(PYTHON) -m pip install --quiet -r backend/requirements.txt
	npx prisma generate

# ── Development ───────────────────────────────────────────────────────

dev: ## Start both frontend + backend servers
	./setup.sh dev

frontend: ## Start Next.js frontend only (port 3000)
	npm run dev

backend: ## Start FastAPI backend only (port 8000)
	cd backend && $(UVICORN) main:app --reload --port 8000

# ── Database ──────────────────────────────────────────────────────────

db-up: ## Start PostgreSQL via Docker
	docker compose up db -d

db-down: ## Stop PostgreSQL
	docker compose down

db-push: ## Push Prisma schema to database
	npx prisma db push

db-studio: ## Open Prisma Studio (visual DB browser)
	npx prisma studio

# ── Data Pipeline ─────────────────────────────────────────────────────

pipeline: ## Run full data pipeline (download EIA, load DB, compute LCOE)
	cd backend && $(PYTHON) -m data_pipeline.run_pipeline --skip-solar

pipeline-full: ## Run pipeline including PVGIS solar profiles (slow)
	cd backend && $(PYTHON) -m data_pipeline.run_pipeline

pipeline-solar: ## Fetch PVGIS solar profiles only
	cd backend && $(PYTHON) -m data_pipeline.fetch_pvgis

# ── Maintenance ───────────────────────────────────────────────────────

reset: ## Reset database and re-run pipeline
	./setup.sh reset

clean: ## Remove generated files (node_modules, .venv, .next)
	rm -rf node_modules .next backend/.venv dev.db

lint: ## Run linters
	npm run lint

build: ## Build production bundle
	npm run build
