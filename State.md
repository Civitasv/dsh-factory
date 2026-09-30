# DSH Factory Current State

## Release surface

Features 01-05 foundations are implemented: repository baseline, Change Graph, Evidence Protocol, Context Compilation, and Gates/Policy.

## Implemented

- Change-centric event-sourced domain and deterministic graph projection.
- Reality-bound Evidence validation/applicability/coverage.
- Deterministic ContextPack compilation and hashing.
- Exact Criterion-revision Gate Policies.
- Pure Gate assessment from Evidence Coverage and Finding blockers.
- Explicit authorized `not_required` decisions.
- No direct human/agent override from missing Evidence to satisfied.
- Deterministic Gate Evidence aggregation and assessment reasons.
- GitHub Actions CI for typecheck, lint, and tests.

## Architecture baseline

- Evidence answers what is known.
- Policy answers whether that knowledge is sufficient.
- Human subjective approval enters through Evidence such as human attestation.
- Gate state is derived and does not become Change status.
- DSH/Cordis remains an execution adapter.

## Active limitations

- Work/capability discovery and execution protocol are not implemented.
- Production persistence is not implemented.
- No GitHub/CI/release/production adapters.
- DSH runtime does not yet execute Factory Work.
- No end-user Graph UI.
