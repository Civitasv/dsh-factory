# DSH Factory Current State

## Release surface

Repository foundation, Change Graph, and Evidence Protocol foundations are implemented. There is no end-user release yet.

## Implemented

- pnpm TypeScript monorepo.
- Pure Change-centric domain package.
- Eight top-level Change Graph node kinds: Change, Criterion, Artifact, Evidence, Finding, Decision, Gate, Run.
- Stable Criterion identity with immutable sequential revisions.
- Machine-readable Evidence Requirements with all-of requirement composition and any-of accepted kinds.
- Evidence subjects that bind to exact Criterion revisions.
- Versioned semantic Evidence kinds with JSON-compatible payloads.
- Explicit Evidence Reality, typed Artifact-backed sources, and immutable Evidence invalidation projection.
- Independent `packages/evidence` Registry with eight baseline Factory kind validators.
- Conservative exact-Reality Evidence applicability.
- Deterministic Evidence Requirement/Criterion coverage with explicit missing, contradicted, conflicted, and satisfied states.
- Typed, directed, identified Relations with semantic endpoint validation.
- Global cyclic graph with per-relation DAG enforcement for `decomposes_into`, `depends_on`, and `supersedes`.
- Semantic domain Event vocabulary.
- Reference in-memory Event Store with graph offsets, per-Change sequences, duplicate-event protection, and optimistic concurrency.
- Deterministic Change Graph projector with relation retirement, Evidence invalidation, Change disposition, Finding lifecycle, Gate evaluation, and Graph Revision projection.
- DSH/Cordis runtime adapter package exposing the namespace-plugin entry shape.
- GitHub Actions CI for typecheck, lint, and unit tests.

## Architecture baseline

- Change-centric.
- Event-sourced.
- Graph-based domain relations.
- Evidence-driven verification.
- Agent prose alone is not Evidence.
- Evidence is immutable; applicability is derived from Reality.
- Capability workers rather than persistent role agents.
- Change workflow stage is derived; terminal disposition is durable.
- DSH/Cordis is an execution adapter, not the domain owner.

## Active limitations

- Gate/Policy authority and transition rules are not implemented.
- Production Change Graph persistence is not implemented; the current Event Store is an in-memory executable contract.
- No semantic Graph Reader/query service beyond deterministic projection.
- Context Compiler is not implemented.
- No orchestrator, artifact store, GitHub integration, browser/QA adapter, or release integration exists yet.
- `runtime-dsh` is only the integration seam; it does not register Factory tools/services yet.
- No lockfile is committed yet; CI installs with `--no-frozen-lockfile` until the first reviewed lockfile is added.
