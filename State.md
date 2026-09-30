# DSH Factory Current State

## Release surface

Features 01-07 foundations are implemented through the runtime-neutral Execution Protocol.

## Implemented

- Change Graph, Evidence, Context, Policy, and capability-based Work.
- Freshness check before Work preparation.
- ContextPack compilation bound to each prepared execution.
- Explicit prepared/running/terminal lifecycle rules.
- Second Graph Revision freshness check before accepting Worker outcome.
- Stale outcomes cannot produce durable Run proposals.
- Fresh outcomes map to durable Run records.
- Failed-only bounded retry semantics.
- Runtime adapters supply timestamps; protocol reads no global clock.
- Structured output proposal boundary; diagnostics are not Evidence.

## Active limitations

- DSH does not yet implement the execution adapter.
- Domain Event append transaction remains outside Feature-07.
- Production persistence is not implemented.
- No GitHub/CI/release/production adapters.
- No end-user Graph UI.
