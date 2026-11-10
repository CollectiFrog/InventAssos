# InventAssos

Shared equipment inventory for volunteer associations doing scenography, sound, lighting and
events: each collectif lists its gear, the others find it and contact the owner.

*Inventaire de matériel partagé entre associations : chaque collectif référence son matériel, les
autres le trouvent et contactent le propriétaire.*

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
