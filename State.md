# DSH Factory Current State

## Release surface

Features 01-09 are implemented through durable local Event Log persistence.

## Implemented

- Change Graph, Evidence, Context, Policy, Work, Execution, and DSH runtime integration.
- Local filesystem Event Store format v1 with graph identity metadata.
- Atomic logical batch publication through fsynced temp file + rename.
- Optimistic per-Change concurrency survives reopen.
- Duplicate Event identity survives reopen.
- Process-local concurrent append serialization.
- Durable replay through the existing Change Graph projector.
- Corrupt JSON/history fails open rather than being silently repaired.

## Active limitations

- Persistence is a correctness-first local backend, not a multi-process/distributed store.
- No GitHub/CI/release/production adapters yet.
- No end-user Graph UI.
