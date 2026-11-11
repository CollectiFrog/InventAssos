# InventAssos

Equipment inventory for volunteer associations doing scenography, sound, lighting and events:
each collectif keeps its inventory with its members — what it owns, where it is, who holds it.
Sharing with other collectifs comes later, once owners can choose who sees what.

*Inventaire de matériel pour les associations : chaque collectif gère son matériel avec ses
membres. Le partage entre collectifs viendra ensuite, quand chacun pourra choisir à qui il montre
son matériel.*

**Documentation:** [user guide](https://collectifrog.github.io/InventAssos/) ·
[developer docs](https://collectifrog.github.io/InventAssos/dev/)

**Status:** pre-release (V0.x). Roadmap: [`docs/dev/product/roadmap.md`](docs/dev/product/roadmap.md).

## Quick start

Requires Node.js ≥ 24.3 and Docker.

```sh
npm ci
cp .env.example .env
make dev     # PostgreSQL in Docker, then the app on http://localhost:3000
make check   # lint, typecheck, test, build
```

Details: [`docs/dev/contribute/setup.md`](docs/dev/contribute/setup.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents start with [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
