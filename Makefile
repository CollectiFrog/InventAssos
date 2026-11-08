# CI contract: .github/workflows/ci.yml runs lint, typecheck, test and build. Same commands locally.
.PHONY: check lint typecheck test build docs dev db install

check: lint typecheck test build

install:
	npm ci

lint:
	npm run lint

typecheck:
	npm run typecheck

# Needs PostgreSQL: `make db` locally, a service container in CI (TEST_DATABASE_URL).
test:
	npm test

# Remix 3 runs TypeScript source, there is no compile step: check the production graph loads.
build:
	NODE_ENV=production node --import remix/node-tsx --input-type=module -e "await import('./app/router.ts')"

# Local development: database in Docker, app with auto-restart on http://localhost:3000.
db:
	docker compose up -d --wait db

dev: db
	npm run dev

docs:
	cd docs/site && npm ci && npm run build
