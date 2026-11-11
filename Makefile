# CI contract: .github/workflows/ci.yml runs lint, typecheck, test and build. Same commands locally.
.PHONY: check lint typecheck test build a11y docs dev db install deps

check: lint typecheck test build

install:
	npm ci

# npm ci only when package-lock.json changed since the last install: the app container runs it at start.
deps: node_modules/.installed

node_modules/.installed: package-lock.json
	npm ci
	touch $@

lint:
	npm run lint

typecheck:
	npm run typecheck

# Needs PostgreSQL: `make db` locally, a service container in CI (TEST_DATABASE_URL).
test:
	npm test

# Accessibility of the key pages in Chromium, with axe-core (ADR 0024). Needs PostgreSQL like
# `make test`; the browser is downloaded on first run.
a11y:
	npx playwright install chromium
	npm run test:a11y

# Remix 3 runs TypeScript source, there is no compile step: check the production graph loads.
build:
	NODE_ENV=production node --import remix/node-tsx --input-type=module -e "await import('./app/router.ts')"

# Local development: database and Mailpit in Docker, app with auto-restart on http://localhost:3000.
# In the app container (compose.yaml, Dev Container), Compose already runs them next to it.
db:
ifdef IN_APP_CONTAINER
	@echo "db and mail are Compose services next to this container."
else
	docker compose up -d --wait db mail
endif

# DEV_POLL (set by compose.yaml) polls for changes: file events from the host do not reach a container.
dev: db
ifdef DEV_POLL
	npm run dev:poll
else
	npm run dev
endif

docs:
	cd docs/site && npm ci && npm run build
