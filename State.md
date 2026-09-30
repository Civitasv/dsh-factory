# DSH Factory Current State

## Release surface

Features 01-06 foundations are implemented through capability-based Work.

## Implemented

- Change Graph, Evidence Protocol, Context Compilation, and Gates/Policy.
- Work Demand -> deterministic Work Item materialization.
- Namespaced semantic capabilities instead of persistent human-role agents.
- Exact capability-set Worker eligibility.
- Deterministic eligible Worker ordering.
- Graph-Revision-pinned Work.
- Local Work Plan DAG validation with one revision per plan.
- Work carries Context compilation requests rather than conversation text.
- GitHub Actions CI for typecheck, lint, and tests.

## Architecture baseline

- Global SDLC history may contain cycles.
- One concrete Work Plan is a DAG.
- Work is derived execution state, not a Change Graph node.
- Worker identity is disposable runtime inventory.
- DSH/Cordis remains an execution adapter.

## Active limitations

- Work is not executed yet; retries/cancellation/staleness belong to Feature-07.
- Production persistence is not implemented.
- No GitHub/CI/release/production adapters.
- DSH runtime does not yet execute Factory Work.
- No end-user Graph UI.
