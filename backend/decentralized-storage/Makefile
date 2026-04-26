# ============================================================================
# QSDID Decentralized Storage - Makefile
# Simplify command execution across platforms
# ============================================================================

.PHONY: help setup test run demo docker stop full clean logs

# Default shell
SHELL := /bin/bash
.DEFAULT_GOAL := help

# ============================================================================
# HELP
# ============================================================================

help:
	@echo ""
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║   QSDID Decentralized Storage - Complete Workflow Executor    ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📋 AVAILABLE COMMANDS:"
	@echo ""
	@echo "  make setup              Setup project, install dependencies, start Docker"
	@echo "  make test               Run all tests (unit, integration, PQ, load)"
	@echo "  make run                Start the server"
	@echo "  make demo               Demonstrate workflows (store, retrieve, verify)"
	@echo "  make docker             Start Docker services (IPFS + Redis)"
	@echo "  make stop               Stop Docker services"
	@echo "  make full               Complete workflow (setup + test + docker)"
	@echo "  make logs               View execution logs"
	@echo "  make clean              Clean up containers and logs"
	@echo ""
	@echo "🔧 ADVANCED COMMANDS:"
	@echo ""
	@echo "  make test:unit          Run unit tests only"
	@echo "  make test:integration   Run integration tests only"
	@echo "  make test:pq            Run PQ cryptography tests only"
	@echo "  make test:load          Run load tests only"
	@echo "  make lint               Run linter and fix issues"
	@echo "  make verify-pq          Verify PQ module is ready"
	@echo ""
	@echo "📊 DOCKER COMMANDS:"
	@echo ""
	@echo "  make docker:logs        View Docker services logs"
	@echo "  make docker:ps          Show running containers"
	@echo "  make docker:ipfs-logs   View IPFS logs only"
	@echo "  make docker:redis-logs  View Redis logs only"
	@echo ""
	@echo "🔍 MONITORING & INFO:"
	@echo ""
	@echo "  make ps                 Show running services"
	@echo "  make env                Show environment variables"
	@echo "  make status             Check system status"
	@echo ""

# ============================================================================
# MAIN TARGETS
# ============================================================================

setup:
	@echo "📦 Setting up project..."
	@if command -v pwsh 2>/dev/null; \
		then pwsh -ExecutionPolicy Bypass -File run-all.ps1 -Mode setup; \
		else bash run-all.sh setup; \
	fi

test:
	@echo "🧪 Running all tests..."
	@if command -v pwsh 2>/dev/null; \
		then pwsh -ExecutionPolicy Bypass -File run-all.ps1 -Mode test; \
		else bash run-all.sh test; \
	fi

run:
	@echo "🚀 Starting server..."
	@if command -v pwsh 2>/dev/null; \
		then pwsh -ExecutionPolicy Bypass -File run-all.ps1 -Mode run; \
		else bash run-all.sh run; \
	fi

demo:
	@echo "🎮 Demonstrating workflows..."
	@if command -v pwsh 2>/dev/null; \
		then pwsh -ExecutionPolicy Bypass -File run-all.ps1 -Mode demo; \
		else bash run-all.sh demo; \
	fi

docker:
	@echo "🐳 Starting Docker services..."
	@if command -v pwsh 2>/dev/null; \
		then pwsh -ExecutionPolicy Bypass -File run-all.ps1 -Mode docker; \
		else bash run-all.sh docker; \
	fi

stop:
	@echo "🛑 Stopping services..."
	@if command -v pwsh 2>/dev/null; \
		then pwsh -ExecutionPolicy Bypass -File run-all.ps1 -Mode stop; \
		else bash run-all.sh stop; \
	fi

full:
	@echo "⚡ Running complete workflow..."
	@if command -v pwsh 2>/dev/null; \
		then pwsh -ExecutionPolicy Bypass -File run-all.ps1 -Mode full; \
		else bash run-all.sh full; \
	fi

# ============================================================================
# TEST TARGETS
# ============================================================================

test\:unit:
	@echo "🧪 Running unit tests..."
	npm run test:unit

test\:integration:
	@echo "🧪 Running integration tests..."
	npm run test:integration

test\:pq:
	@echo "🧪 Running PQ tests..."
	npm run test:pq

test\:load:
	@echo "🧪 Running load tests..."
	npm run test:load

# ============================================================================
# DEVELOPMENT TARGETS
# ============================================================================

lint:
	@echo "📝 Running linter..."
	npm run lint

verify-pq:
	@echo "✓ Verifying PQ module..."
	npm run verify-pq

dev:
	@echo "👨‍💻 Starting development server..."
	npm run dev

# ============================================================================
# DOCKER TARGETS
# ============================================================================

docker\:logs:
	@echo "📋 Docker services logs..."
	docker-compose logs -f

docker\:ps:
	@echo "📦 Running containers..."
	docker-compose ps

docker\:ipfs-logs:
	@echo "📋 IPFS logs..."
	docker-compose logs -f ipfs

docker\:redis-logs:
	@echo "📋 Redis logs..."
	docker-compose logs -f redis

# ============================================================================
# MONITORING & INFO
# ============================================================================

ps:
	@echo "📊 Running services:"
	@docker-compose ps 2>/dev/null || echo "No Docker services running"
	@lsof -i :3000 2>/dev/null || echo "No service on port 3000"
	@lsof -i :5001 2>/dev/null || echo "No IPFS on port 5001"
	@lsof -i :6379 2>/dev/null || echo "No Redis on port 6379"

env:
	@echo "🔧 Environment variables:"
	@cat .env 2>/dev/null || echo "No .env file found"

status:
	@echo "🔍 System status:"
	@echo "Node version: $$(node --version)"
	@echo "npm version: $$(npm --version)"
	@echo "Docker: $$(docker --version 2>/dev/null || echo 'Not installed')"
	@echo "Docker Compose: $$(docker-compose --version 2>/dev/null || echo 'Not installed')"

# ============================================================================
# LOGGING & CLEANUP
# ============================================================================

logs:
	@echo "📋 Recent execution logs:"
	@tail -50 $$(ls -t logs/execution_*.log 2>/dev/null | head -1 || echo /dev/null)

clean:
	@echo "🧹 Cleaning up..."
	@docker-compose down -v 2>/dev/null || true
	@rm -rf logs/* node_modules package-lock.json
	@echo "✓ Cleanup complete"

clean-soft:
	@echo "🧹 Soft cleanup (keep dependencies)..."
	@docker-compose down 2>/dev/null || true
	@rm -rf logs/*
	@echo "✓ Soft cleanup complete"

# ============================================================================
# QUICK REFERENCE
# ============================================================================

.SILENT: help status
