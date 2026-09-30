# DSH Factory Current State

## Release surface

Features 01-11 are implemented through CI/test Evidence ingestion.

## Implemented

- Change Graph through durable persistence and GitHub collaboration ingestion.
- Provider-neutral CI Test Run and Static Analysis snapshots.
- Content-addressed CI run Artifacts.
- Reality-bound `factory/test-execution@1` and `factory/static-analysis@1` Evidence generation.
- Deterministic passed/failed/cancelled mapping to supports/contradicts/inconclusive.
- Feature-03 Registry validation remains the Evidence schema authority.
- External CI status does not directly mutate Gates.

## Active limitations

- CI providers still need host-specific REST/webhook implementations.
- Release/deployment model is next.
- Production observation and Graph UI are not implemented.
