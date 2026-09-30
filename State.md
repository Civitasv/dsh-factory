# DSH Factory Current State

## Release surface

Features 01-14 foundations are implemented through the graph-first browser explorer.

## Implemented

- Change-centric event-sourced SDLC domain through production feedback ingestion.
- Evidence-driven verification, deterministic Context compilation, Policy/Gates, capability-based Work, and runtime-neutral execution.
- DSH public-agent runtime adapter.
- Atomic local Event Log persistence and deterministic replay.
- GitHub and CI/Test normalization into immutable Factory Artifacts/Evidence.
- Release/deployment and production observation protocols.
- Framework-free Graph UI View Model with deterministic cycle-safe layered layout.
- Real directed/multi-edge SVG topology, not sequential transcript rendering.
- Node selection with full incoming/outgoing relations and raw domain detail.
- Keyboard-selectable graph nodes.
- Local pan/zoom/fit viewport controls.
- Caller-provided node actions without workflow logic leaking into the renderer.
- Graph id and Graph Revision visibility.

## Architecture baseline

- The UI is projection only and owns no durable Factory state.
- Every rendered edge corresponds to an active Change Graph Relation.
- Global cycles remain visible and layout-safe.
- Selection and viewport state are local presentation concerns.

## Active limitations

- No production hosting application or design-system integration.
- Graph mutation and orchestration actions remain external to the renderer.
- No persisted UI viewport/selection state.
- Telemetry/GitHub/CI transports still require host-specific live clients.
