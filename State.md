# DSH Factory Current State

## Release surface

Repository foundation is initialized. There is no end-user release yet.

## Implemented

- pnpm TypeScript monorepo.
- Pure domain package for Change-centric contracts.
- Event package with append-only stream sequence validation.
- DSH/Cordis runtime adapter package exposing the namespace-plugin entry shape.
- GitHub Actions CI for typecheck, lint, and unit tests.
- Agent-oriented documentation structure derived from the useful navigation patterns in Rove/Joi, without CNB coupling.

## Architecture baseline

- Change-centric.
- Event-sourced.
- Graph-based domain relations.
- Evidence-driven gates.
- Capability workers rather than persistent role agents.
- DSH/Cordis is an execution adapter, not the domain owner.

## Active limitations

- Change Graph persistence is not implemented.
- Context Compiler is not implemented.
- Evidence verification is limited to the core invariant helper.
- No orchestrator, policy engine, artifact store, GitHub integration, or release integration exists yet.
- `runtime-dsh` is only the integration seam; it does not register Factory tools/services yet.
- No lockfile is committed yet; CI installs with `--no-frozen-lockfile` until the first reviewed lockfile is added.
