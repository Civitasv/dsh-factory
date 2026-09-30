# Orven Current State

## Public surface

Orven now has two intended public packages:

- `@orven/core` — complete Harness-neutral API/runtime;
- `@orven/plugin-dsh` — DeepSeek Harness adapter and DSH Bundle.

All fine-grained implementation modules are private `@orven/internal-*` workspace packages.

## Implemented

- Change Graph, Evidence, Context, Policy/Gates, Work, Execution, Persistence.
- GitHub/CI semantic normalization, Release, Observation, Graph UI.
- Public Core assembly with subpath exports.
- DSH adapter consuming public Core rather than private modules.
- Real DSH Loader/AgentRegistry process smoke.
- Two-artifact distribution verification and clean external consumer install.
- Orven product/package branding.
- Durable workspace-local DSH Change Graph persistence under `.orven/`.
- DSH Session → active Change binding through a durable Session event/projection.
- Model-facing `orven_begin_change`, `orven_status`, `orven_execute`, and `orven_record_evidence`.
- Exact DSH tool-result Artifact capture and Artifact-backed Evidence attachment.
- Workspace-reality fingerprinting and derived Criterion coverage/Gate readiness.
- Guided DSH orchestration policy integrated through `ctx.systemPrompt`, with a manual opt-out.
- Recursive Orven orchestration blocked inside delegated Orven workers.
- DSH Web Orven panel with Session-scoped Change Graph, revision-aware refresh, coverage/Gate summary, and read-only graph inspection.

## Architecture baseline

- Orven is the product; DSH is one Harness adapter.
- Harness-specific dependencies cannot enter private neutral modules or `@orven/core`.
- Event Log / Change Graph is authoritative regardless of Harness.
- `ctx.orven` is the sole DSH/Cordis service identity; no `ctx.factory` alias is published.
- Assistant prose is never promoted directly to Evidence.

## Remaining work

- npm `@orven` scope ownership/credentials are external setup.
- Packages are not yet actually published.
- Low-level `ctx.orven.executeWork()` still accepts a caller-provided Outcome Collector; the model-facing DSH loop has a concrete terminal-turn collector.
- No second Harness adapter exists yet.
