.PHONY: setup dev test db\:reset db\:reset\:test db\:seed

setup:
	@echo "Installing backend dependencies..."
	cd packages/backend && npm install
	@echo "Installing frontend dependencies..."
	cd packages/frontend && npm install
	@echo "Starting PostgreSQL (dev + test)..."
	docker compose -f docker/docker-compose.yml up -d

dev:
	@echo "Starting backend on http://localhost:3000 and frontend on http://localhost:5173..."
	@trap 'kill 0' INT TERM EXIT; \
	cd packages/backend && npm run dev & \
	cd packages/frontend && npm run dev & \
	wait

test:
	@echo "Ensuring test database is running..."
	docker compose -f docker/docker-compose.yml up -d postgres-test
	@echo "Running frontend Vitest suite..."
	cd packages/frontend && npm run test
	@echo "Running backend Jest suite..."
	cd packages/backend && npm run test

db\:reset:
	@echo "Resetting dev PostgreSQL volume and recreating the container..."
	docker compose -f docker/docker-compose.yml down -v
	docker compose -f docker/docker-compose.yml up -d

db\:reset\:test:
	@echo "Resetting test PostgreSQL container..."
	docker compose -f docker/docker-compose.yml stop postgres-test
	docker compose -f docker/docker-compose.yml rm -f postgres-test
	docker volume rm docker_postgres_test_data 2>/dev/null || true
	docker compose -f docker/docker-compose.yml up -d postgres-test

db\:seed:
	@echo "Applying init.sql to dev PostgreSQL..."
	docker exec -i arqiat1-postgres psql -U postgres -d app < database/init.sql
