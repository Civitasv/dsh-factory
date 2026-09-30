# Feature-07 Execution Protocol

## Objective

Define the transaction boundary that turns one fresh Work Item into one auditable execution attempt.

~~~text
Work Item
   |
freshness check
   |
Context compile
   |
Prepared Execution
   |
Worker starts
   |
Worker Outcome
   |
freshness check
   |
Accepted Result / Stale Result
   |
Run + output proposal
~~~

Feature-07 is runtime-neutral. DSH implements this protocol in Feature-08.

## Freshness

Work is pinned to a Graph Revision.

Execution performs two freshness checks:

1. before Context compilation / start;
2. before accepting the Worker outcome.

If current Graph Revision differs from Work's revision at either boundary, the execution is stale.

A stale execution does not silently commit output based on old assumptions.

## Preparation

Preparation requires:

- Work Item;
- selected Worker descriptor;
- current Change Graph Snapshot;
- available capabilities/permissions for Context compilation.

Preparation validates:

- Work revision equals current Graph revision;
- Worker satisfies every required capability;
- snapshot root Change exists;
- ContextPack compiles successfully.

Output conceptually contains executionId, attempt, Work, Worker, compiled Context, and state prepared.

Execution identity is deterministic from Work id plus positive attempt number.

## Lifecycle

Transient lifecycle states:

- prepared
- running
- succeeded
- failed
- cancelled
- stale

Allowed transitions:

~~~text
prepared -> running
prepared -> cancelled

running -> succeeded
running -> failed
running -> cancelled
running -> stale
~~~

No terminal state can transition again.

Lifecycle state is execution runtime state, not Change workflow state.

## Worker outcome

A Worker returns structured output with:

- status: succeeded, failed, or cancelled;
- proposed Artifacts;
- proposed Evidence;
- proposed Findings;
- proposed Decisions;
- optional diagnostics.

Diagnostics is explanatory text and is not Evidence.

Evidence in the outcome still must pass Feature-03 validation before a future event append.

Feature-07 does not treat Worker success prose as proof.

## Result acceptance

Before an outcome is accepted, current Graph Revision is compared with the prepared execution revision.

If the graph moved:

~~~text
prepared revision != current revision
              |
              v
             stale
~~~

The outcome may be retained as diagnostic runtime output but is not accepted as a durable domain proposal.

If fresh, the protocol produces an Accepted Execution Result containing:

- final lifecycle state;
- proposed Artifacts;
- proposed Evidence;
- proposed Findings;
- proposed Decisions;
- a Run record.

## Run mapping

Accepted terminal execution maps to the existing durable Run domain type.

The Run records:

- Work objective;
- ContextPack hash;
- Work Graph Revision;
- runtime identifier;
- succeeded, failed, or cancelled;
- caller-supplied start/end timestamps.

The Run does not duplicate Worker role identity into Change Graph semantics.

## Attempts and retry policy

Attempt numbers start at 1 and are positive safe integers.

Retry policy contains maxAttempts.

Only a failed execution is retryable.

Cancelled and stale executions require a new scheduling decision.

A stale Work Item must be rediscovered/materialized from current graph facts instead of retried against its old revision.

## Cancellation

Cancellation is explicit.

Cancellation before Worker start:

~~~text
prepared -> cancelled
~~~

Cancellation while running:

~~~text
running -> cancelled
~~~

Cancellation never fabricates success/failure Evidence.

## Execution timestamps

Feature-07 never reads a global clock.

Runtime adapters supply startedAt and finishedAt.

This keeps core protocol tests deterministic.

## Output proposal boundary

Feature-07 does not append Events itself.

Accepted output is a proposal that a later orchestrator/persistence transaction can validate and append atomically.

This keeps execution mechanism separate from domain commit.

## Invariants

### EXEC-01 — fresh start

Stale Work cannot be prepared.

### EXEC-02 — fresh commit

A Worker outcome cannot be accepted after Graph Revision changes.

### EXEC-03 — exact Context

Prepared execution records the exact compiled ContextPack/hash.

### EXEC-04 — capability enforcement

Preparation rejects an ineligible Worker.

### EXEC-05 — legal lifecycle

Only declared lifecycle transitions are accepted.

### EXEC-06 — terminal immutability

Terminal execution state cannot transition again.

### EXEC-07 — no prose proof

Diagnostics text is not Evidence.

### EXEC-08 — structured outputs

Durable proposals are typed Artifacts/Evidence/Findings/Decisions.

### EXEC-09 — retry failed only

Only failed attempts may use the retry path.

### EXEC-10 — stale means rediscover

Stale Work is not retried at its old Graph Revision.

### EXEC-11 — runtime-neutral

Execution Protocol has no Cordis/DSH dependency.

## Acceptance criteria

### AC-001 — start staleness

Preparation rejects Work whose Graph Revision differs from the Snapshot.

### AC-002 — commit staleness

Outcome acceptance returns stale when current Graph Revision differs.

### AC-003 — worker eligibility

Preparation rejects a Worker missing any required capability.

### AC-004 — context binding

Prepared execution exposes ContextPack hash and pinned Graph Revision.

### AC-005 — lifecycle validation

Illegal lifecycle transitions are rejected.

### AC-006 — Run generation

Fresh terminal outcome produces a Run with correct context hash, revision, runtime, status, and timestamps.

### AC-007 — retry semantics

Retry is allowed only when prior state is failed and attempt count is below policy maximum.

### AC-008 — no external I/O

The protocol performs no model/network/runtime I/O itself.

## Implementation scope

Feature-07 includes:

- packages/execution;
- preparation/freshness validation;
- deterministic Execution id;
- lifecycle state machine;
- Worker Outcome / Accepted Result contracts;
- Run mapping;
- retry policy helper;
- tests for staleness, capability rejection, lifecycle, Run mapping, and retry semantics.

## Non-goals

- DSH agent creation;
- model invocation;
- sandbox creation;
- Event Store append transaction;
- distributed queues;
- persistent execution scheduler;
- GitHub/CI/release integration;
- UI.
