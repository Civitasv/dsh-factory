# DSH Factory Current State

## Release surface

Features 01-10 are implemented through GitHub collaboration ingestion.

## Implemented

- Change Graph, Evidence, Context, Policy, Work, Execution, DSH runtime, and durable local Event persistence.
- Immutable content-addressed GitHub Issue/PR/commit Artifacts.
- Replayable normalized GitHub snapshot metadata.
- Explicit Issue-to-Change intent proposal with caller-selected Change kind.
- GitHub mutable state is not used as Factory Gate/Change truth.
- GitHub read transport is isolated behind a port.

## Active limitations

- No GitHub App/webhook transport implementation.
- CI Check Run ingestion belongs to Feature-11.
- No release/production adapters yet.
- No end-user Graph UI.
