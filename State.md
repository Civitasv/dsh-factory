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

## Architecture baseline

- Orven is the product; DSH is one Harness adapter.
- Harness-specific dependencies cannot enter private neutral modules or `@orven/core`.
- Event Log / Change Graph is authoritative regardless of Harness.
- `ctx.orven` is the sole DSH/Cordis service identity; no `ctx.factory` alias is published.
- Assistant prose is never promoted directly to Evidence.

## Remaining work

- npm `@orven` scope ownership/credentials are external setup.
- Packages are not yet actually published.
- Standard production Outcome Collector remains caller-provided.
- Graph UI is not yet mounted into DSH Web.
- No second Harness adapter exists yet.
