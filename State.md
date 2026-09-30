# DSH Factory Current State

## Release surface

Features 01-15 are implemented through the DSH plugin runtime and graph-first browser explorer.

## Implemented

- Change-centric event-sourced SDLC domain through production feedback ingestion.
- Evidence-driven verification, deterministic Context compilation, Policy/Gates, capability-based Work, and runtime-neutral execution.
- Factory is mounted inside DeepSeek Harness as the `@dsh-factory/plugin-dsh` namespace plugin.
- The public DSH service is `ctx.factory`.
- `ctx.factory` owns Event Store projection/append plus Work preparation and execution through the public `ctx.agents` seam.
- In-memory Event Store is the default; configured plugin persistence uses the JSONL Event Store.
- DSH Agent execution retains deterministic Session identity, Context-before-objective ordering, cancellation propagation, freshness checks, and owned handle disposal.
- A real Cordis Loader/process smoke mounts the real DSH AgentRegistry, a deterministic test AgentFactory, and the Factory plugin, then completes one Factory Work execution.
- Atomic local Event Log persistence and deterministic replay.
- GitHub and CI/Test normalization into immutable Factory Artifacts/Evidence.
- Release/deployment and production observation protocols.
- Framework-free graph-first UI projection.

## Architecture baseline

- DSH is the harness/runtime host; Factory is an SDLC plugin inside DSH.
- Internal Factory packages are libraries behind one plugin composition root.
- DSH owns Agent loop, Session, model, tool, skill, and sandbox mechanics.
- Factory owns Change/Evidence/Context/Policy/Work/SDLC execution semantics and related integrations.
- The Change Graph/Event Log remains authoritative; DSH Sessions are execution provenance, not Change state.
- Arbitrary assistant prose is never trusted Evidence.

## Active limitations

- The standard production Outcome Collector protocol is still caller-provided; arbitrary DSH Session history is not automatically promoted into typed Factory output.
- The plugin is not yet published as an npm package.
- Live GitHub/CI/telemetry transports still require host-specific clients.
- Graph UI is not yet mounted into the DSH Web slot system.
