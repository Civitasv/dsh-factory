# DSH Factory Current State

## Release surface

Repository foundation, Change Graph, Evidence Protocol, and deterministic Context Compilation are implemented. There is no end-user release yet.

## Implemented

- pnpm TypeScript monorepo.
- Change-centric event-sourced domain and deterministic Change Graph projection.
- Immutable Criterion revisions and machine-readable Evidence Requirements.
- Versioned, Reality-bound Evidence with validation, applicability, invalidation, and conflict-aware coverage.
- Deterministic Context Compiler that pins one Graph Revision.
- Explicit Context Query direction/relation/depth selection.
- Subject-Evidence expansion for selected nodes and Criterion revisions.
- Graph-size budgets with omitted lazy node references.
- Per-node inclusion provenance.
- Canonical ContextPack ordering and SHA-256 hashing.
- GitHub Actions CI for typecheck, lint, and unit tests.

## Architecture baseline

- Change-centric.
- Event-sourced.
- Graph-based domain relations.
- Evidence-driven verification.
- Context is compiled from the graph, not accumulated conversation history.
- ContextPack is a projection, not a second source of truth.
- Capability workers rather than persistent role agents.
- DSH/Cordis is an execution adapter, not the domain owner.

## Active limitations

- Gate/Policy authority and transition rules are not implemented.
- Work/capability discovery and execution protocol are not implemented.
- Production Change Graph persistence is not implemented.
- No semantic/vector retrieval; Context Compilation is deterministic graph selection only.
- No GitHub, CI, browser/QA, release, or production-observation adapter exists yet.
- `runtime-dsh` does not yet execute Factory Work.
