# CI contract: .github/workflows/ci.yml runs these targets. Replace each placeholder with the
# project's real command (e.g. `npm run lint`). Placeholders warn instead of failing silently.
.PHONY: check lint typecheck test build docs

check: lint typecheck test build

lint:
	@echo "::warning::lint not configured, edit the Makefile"

typecheck:
	@echo "::warning::typecheck not configured, edit the Makefile"

test:
	@echo "::warning::tests not configured, edit the Makefile"

build:
	@echo "::warning::build not configured, edit the Makefile"

docs:
	cd docs/site && npm ci && npm run build
