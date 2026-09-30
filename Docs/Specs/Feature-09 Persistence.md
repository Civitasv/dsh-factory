# Feature-09 Persistence

## Objective

Persist the Factory Event Log durably while preserving the event-sourced Change Graph contract.

Feature-09 provides a local filesystem reference backend. It is intended to be a real durable baseline, not a distributed database abstraction.

~~~text
Domain append request
        |
        v
Persistent Event Store
        |
 atomic batch publication
        |
        v
events.jsonl
        |
        v
deterministic replay
        |
        v
Change Graph Snapshot
~~~

## Storage layout

One Factory graph directory contains:

~~~text
<graph-root>/
  graph.json
  events.jsonl
~~~

`graph.json` contains:

- format version;
- Graph id.

`events.jsonl` contains one serialized `EventEnvelope` per line in Graph-offset order.

## Source of truth

The Event Log remains the source of truth.

Graph projections, ContextPacks, Gate assessments, Work, and runtime Sessions are derived or external projections and are not persisted here as authoritative state.

## Open

Opening a store:

1. creates the directory if absent;
2. creates `graph.json` when absent;
3. verifies existing metadata format/version and Graph id;
4. reads `events.jsonl` when present;
5. parses every complete non-empty line;
6. runs existing Event Log consistency validation;
7. rebuilds event-id and per-Change sequence indexes.

Corrupt JSON or inconsistent event history fails open.

The store never silently repairs semantic corruption.

## Append contract

Append uses the existing Feature-02 `AppendRequest` semantics:

- at least one event;
- Change-owned writes require `expectedSequence`;
- expected sequence must equal current Change sequence;
- Event ids are globally unique;
- Graph offsets are assigned monotonically;
- per-Change sequences advance monotonically.

## Atomic batch publication

A logical append batch is all-or-nothing.

The reference backend:

1. validates the complete proposed batch in memory;
2. serializes the complete resulting Event Log to a sibling temporary file;
3. fsyncs the temporary file;
4. atomically renames it over `events.jsonl`;
5. only then publishes the new in-memory state.

This favors correctness over append throughput for the reference implementation.

A process crash before rename leaves the previous complete Event Log authoritative.

## Serialization

Event Envelopes are JSON-compatible at runtime.

Brand types serialize as their underlying strings/numbers.

The backend does not invent alternative persistence schemas for domain Events.

Unknown future semantic Event types are a format/version evolution concern, not silently ignored input.

## Replay

The store exposes deterministic replay through the existing `projectChangeGraph` projector.

Replay performs no external I/O beyond reading persisted Event data.

Evidence verification, DSH execution, GitHub reads, CI calls, and other external work are never repeated by replay.

## Concurrency

The reference backend owns writes through one process-local store instance.

Concurrent `append()` calls on the same instance are serialized.

Optimistic concurrency still uses per-Change `expectedSequence`.

Feature-09 does not claim safe multi-process writers or distributed locking. A later backend may implement the same logical contract with database transactions.

## Reopen durability

After a successful append and store reopen:

- Graph Revision is preserved;
- Event offsets are preserved;
- per-Change sequences are preserved;
- duplicate Event ids remain rejected;
- projection is logically equivalent.

## Read API

The baseline backend exposes:

- `readAll()`;
- `currentRevision()`;
- `currentSequence(changeId)`;
- `append(request)`;
- `project()`.

Returned event arrays are immutable snapshots from the caller's perspective.

## Format versioning

`graph.json` has a numeric `formatVersion`.

Feature-09 defines format version 1.

An unsupported format version fails open. Migrations must be explicit future features.

## Invariants

- **PERSIST-01 Event source of truth** — only Event Log data is authoritative.
- **PERSIST-02 Graph identity** — a directory is bound to exactly one Graph id.
- **PERSIST-03 Atomic batch** — partial logical batches are never published.
- **PERSIST-04 Durable concurrency** — optimistic Change sequences survive reopen.
- **PERSIST-05 Unique Events** — Event ids remain unique across process restarts.
- **PERSIST-06 Deterministic replay** — persisted events project through the existing projector.
- **PERSIST-07 Fail on corruption** — malformed/inconsistent history is not silently repaired.
- **PERSIST-08 Explicit format** — persistence format version is recorded and checked.
- **PERSIST-09 Serialized local writes** — one store instance serializes concurrent appends.
- **PERSIST-10 Honest boundary** — no multi-process/distributed-safety claim.

## Acceptance criteria

- empty directory opens and initializes metadata;
- mismatched Graph id fails open;
- successful append survives reopen;
- stale expected Change sequence fails after reopen;
- duplicate Event id fails after reopen;
- a multi-event batch appears completely after successful append;
- concurrent appends through one instance are serialized;
- malformed JSONL fails open;
- replay returns the same Graph Revision and domain facts as in-memory projection.

## Implementation scope

Feature-09 includes:

- `packages/persistence`;
- format-v1 metadata;
- local atomic JSONL Event Store;
- process-local append serialization;
- optimistic concurrency;
- deterministic projection helper;
- temporary-directory integration tests.

## Non-goals

- SQLite/Postgres/Neo4j;
- distributed locks;
- multi-process concurrent writers;
- remote object storage;
- event compaction;
- migration tooling;
- graph query indexes;
- persistence UI.
