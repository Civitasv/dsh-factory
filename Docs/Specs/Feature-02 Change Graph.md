# Feature-02 Change Graph

## Objective

Define the durable fact model for DSH Factory.

The Change Graph answers:

> What does the system currently know about a software Change, how are those facts related, and which historical events produced the current view?

The graph is not a workflow engine and is not a UI data structure. Workflow, Context compilation, Gate evaluation, orchestration, audit, replay, and presentation consume the graph as a shared fact projection.

## Architecture decision

The Change Graph is:

- event-sourced;
- typed;
- directed;
- multi-edge;
- globally cyclic;
- revision-addressable;
- reconstructable from the Event Log.

```text
Commands
   |
   v
Domain validation
   |
   v
Event Log  <---------------- source of truth
   |
   v
Change Graph Projector
   |
   v
Change Graph
   |
   +--> Context Compiler
   +--> Gate / Policy
   +--> Work Discovery
   +--> UI / API
   +--> Audit / Replay
```

The Event Log is the durable source of truth. The Change Graph is the authoritative read projection and must be reproducible for any retained Graph Revision.

## Node model

The graph has exactly eight top-level domain node kinds:

1. `Change`
2. `Criterion`
3. `Artifact`
4. `Evidence`
5. `Finding`
6. `Decision`
7. `Gate`
8. `Run`

The following are deliberately not domain nodes:

- Agent / Worker / Role;
- Conversation / Session;
- ContextPack;
- Stage / Status;
- Event.

Workers are execution resources. ContextPack and stage labels are projections. Events are historical facts that produce the graph.

## Change

`Change` is the durable business center, but it remains small.

A Change owns only identity and intrinsic metadata:

```ts
interface Change {
  id
  kind
  title
  createdAt
  createdBy
}
```

It does not own:

- intent;
- criteria;
- constraints;
- parent/children;
- workflow stage;
- mutable version/status.

Those facts belong to typed graph relations or event-derived projections.

Examples:

```text
CHG-101 --has_intent-----> ART-001
CHG-101 --has_criterion--> CRT-001
CHG-101 --constrained_by-> ART-009
```

This prevents a struct field and a graph edge from becoming competing sources of truth.

## Criterion and revisions

Acceptance Criteria are first-class graph nodes.

A Criterion has a stable identity. Its content is published as immutable revisions:

```text
CRT-001@1
CRT-001@2
CRT-001@3
```

A new revision never mutates an old revision.

Criterion Revision is an addressable immutable fact, but not a ninth top-level graph node kind. It is owned by the stable Criterion node.

Evidence that refers to a Criterion must bind to an exact `CriterionRevisionRef`, not only to `CriterionId`.

Therefore evidence that verified `CRT-001@1` never silently becomes evidence for `CRT-001@2`.

Revision numbers:

- are positive safe integers;
- start at 1;
- increase by exactly one;
- cannot be replaced once published.

## Artifact

An Artifact is a concrete input or output such as:

- intent document;
- requirement source;
- source commit;
- patch;
- build;
- screenshot;
- video;
- log;
- trace;
- benchmark;
- deployment.

Artifact ownership by a Change is expressed through relations, not an embedded `changeId`.

## Evidence

Evidence is an immutable claim about observed reality.

Artifacts and Evidence are distinct:

```text
video.mov        = Artifact
"Pin closes..."  = Evidence claim backed by video.mov
```

Evidence records:

- a claim;
- a result: `supports | contradicts | inconclusive`;
- source Artifacts;
- exact subjects;
- observation time;
- optional producing Run.

An Evidence subject may be:

- any top-level Graph Node;
- an exact Criterion Revision.

Historical Evidence is never rewritten. When the current software/revision changes, old Evidence remains true about the reality it observed; it may simply no longer be applicable to the current Gate evaluation.

## Finding

A Finding records a mismatch between intended and observed reality.

Finding kinds include:

- bug;
- requirement gap;
- performance regression;
- test failure;
- security;
- UX;
- release failure;
- production regression.

The Finding node contains the immutable opening fact. Lifecycle changes are events:

```text
FindingOpened
FindingReproduced
FindingResolved
FindingReopened
FindingInvalidated
```

A requirement gap must not silently expand the current Change. It may result in another Change related through the graph.

## Decision

A Decision records an explicit durable choice. Decisions may be made by a human, an agent under policy, or the system.

Decisions are graph facts and may govern Changes, Gates, or other nodes through relations.

## Gate

A Gate is a stable verification/policy boundary.

Its current state is not embedded in Change. Gate evaluation is event-derived and may be:

- `pending`;
- `satisfied`;
- `failed`;
- `not_required`.

A satisfied or failed Gate requires Evidence under the existing foundation invariant.

Readable lifecycle labels such as "Testing" or "Ready to Release" are projections over Gates, Findings, Runs, and Change disposition.

## Run

A Run is one execution attempt.

A Run must record the Graph Revision it consumed. This makes the execution explainable and reproducible against the world state the worker actually saw.

Run is the durable link to an execution runtime such as DSH. Agent identity is not a durable domain node.

## Relations

Relations are typed, directed, identified facts.

Every Relation has:

- stable `RelationId`;
- source node;
- target node;
- semantic kind;
- creation actor/time.

Relations are never physically deleted. Retirement is represented by `RelationRetired`.

### Structural relations

- `has_intent`
- `has_criterion`
- `constrained_by`
- `decomposes_into`
- `depends_on`
- `supersedes`

### Execution relations

- `attempts`
- `produces`
- `observed_on`

### Verification relations

- `supports`
- `contradicts`
- `evaluates`

### Feedback relations

- `raises`
- `addresses`
- `caused_by`

### Governance relations

- `governs`

The graph is multi-edge: two nodes may have multiple independently identified relations.

## Cycle rules

The global Change Graph is allowed to contain cycles. Feedback loops are expected:

```text
Change -> Run -> Evidence -> Finding -> Fix Change -> Evidence
```

However the following relation subgraphs must remain acyclic:

- `decomposes_into`;
- `depends_on`;
- `supersedes`.

Cycle validation is performed per constrained relation kind, not over the complete heterogeneous graph.

## Change disposition

Workflow stage is derived and never authoritative state.

A Change may, however, receive a durable terminal disposition:

- `completed`;
- `cancelled`;
- `superseded`;
- `rejected`.

The distinction is:

```text
Stage        = derived projection
Disposition  = durable business fact
```

## Event model

Domain history uses semantic events rather than reducing the system to generic `NodeUpdated` events.

The baseline vocabulary includes:

- `change.created`
- `change.closed`
- `criterion.created`
- `criterion.revision.published`
- `artifact.recorded`
- `evidence.recorded`
- `finding.opened`
- `finding.reproduced`
- `finding.resolved`
- `finding.reopened`
- `finding.invalidated`
- `decision.recorded`
- `gate.created`
- `gate.evaluated`
- `run.recorded`
- `relation.created`
- `relation.retired`

Explicit relation events exist because relations themselves are durable identified facts. They do not replace semantic entity events.

## Event envelope

Every event has a graph-wide monotonically increasing offset.

Events owned by one Change additionally have a per-Change sequence.

```ts
interface EventEnvelope<T> {
  eventId
  graphId

  changeId?
  sequence?

  offset

  occurredAt
  actor

  causationId?
  correlationId?

  event
}
```

### Graph offset

`offset` is global for the Event Log.

The graph revision is defined as:

```text
GraphRevision = latest applied event offset
```

It is used for:

- graph reconstruction;
- incremental projection;
- ContextPack reproducibility;
- subscription/checkpointing;
- audit.

### Change sequence

`sequence` is local to one Change stream.

Writes to a Change use optimistic concurrency:

```text
append(changeId, expectedSequence)
```

If another writer has advanced that Change, the append is rejected with a concurrency conflict. The caller must reload/recompile context before retrying.

This prevents concurrent AI workers from committing assumptions based on stale Change state.

## Projection

The projector consumes ordered Event Envelopes and produces a Change Graph Snapshot.

A projection contains at minimum:

- graph id;
- graph revision;
- top-level nodes;
- active relations;
- retired relation ids;
- Criterion revision history;
- Change dispositions;
- Finding lifecycle state;
- latest Gate evaluations.

Projection code must enforce domain invariants while replaying.

A corrupt or impossible event history must fail projection rather than silently produce a best-effort graph.

## Graph reader boundary

Consumers query a semantic reader rather than the persistence backend directly.

The intended read surface includes:

```ts
getNode(ref, revision?)
getChange(id, revision?)
getNeighborhood(root, query)
getCriteria(changeId)
getEvidence(subject)
getOpenFindings(changeId)
getDependencies(changeId)
trace(node)
```

Feature-02 implements the graph snapshot/projection foundation. Storage-specific query optimization is deferred.

Future Context compilation consumes a `GraphSlice`, never arbitrary direct reads from GitHub, CI, DSH sessions, or databases.

External information must first enter Factory as Artifacts, Evidence, Findings, Decisions, Relations, and Events.

## Scope behavior

The graph is also the boundary against autonomous scope creep.

If verification contradicts an existing Criterion, it is feedback within the current Change.

If verification discovers desirable behavior that is not part of current intent/criteria, the system records a requirement-gap Finding and may create a separate Change. It does not silently mutate the current Change.

## Invariants

### CG-01 — event origin

Every durable graph fact originates from an Event.

### CG-02 — stable node identity

Top-level nodes have stable identities.

### CG-03 — immutable history

Historical facts are never overwritten. Changes are represented through new events, revisions, retirement, invalidation, or supersession.

### CG-04 — revision-bound evidence

Evidence referring to a Criterion references an exact immutable Criterion Revision.

### CG-05 — derived stage

Change workflow stage/status is derived and never stored as authoritative Change state.

### CG-06 — global cycles

The heterogeneous graph may contain cycles.

### CG-07 — constrained DAGs

`decomposes_into`, `depends_on`, and `supersedes` each remain acyclic.

### CG-08 — no silent scope expansion

Cross-scope feedback does not silently expand an existing Change.

### CG-09 — run input revision

Every Run records the Graph Revision it consumed.

### CG-10 — optimistic concurrency

Change-owned writes compare an expected sequence against the current Change sequence.

### CG-11 — typed directed relations

Every Relation is identified, typed, and directed.

### CG-12 — projection-only context

ContextPack and UI stage views are projections, never secondary sources of truth.

## Acceptance criteria

### AC-001 — minimal Change

The core `Change` type contains no intent, criteria, constraint, parent/child, stage, status, or mutable version fields.

### AC-002 — Criterion revisions

The projector accepts sequential immutable Criterion revisions and rejects duplicate, skipped, zero, negative, or regressing revisions.

### AC-003 — exact Evidence subjects

Evidence may target an exact Criterion Revision, and projection rejects references to unpublished revisions.

### AC-004 — typed Relation identity

Relations carry stable identity, typed direction, actor, and creation time. Retirement preserves historical identity.

### AC-005 — cycle enforcement

The projector rejects cycles for `decomposes_into`, `depends_on`, and `supersedes`, while allowing legal cycles formed through other relation kinds.

### AC-006 — Event Log ordering

Graph offsets are strictly increasing positive safe integers. Per-Change sequences are strictly increasing when present.

### AC-007 — optimistic concurrency

The reference Event Store rejects a write whose expected Change sequence is stale.

### AC-008 — reproducible revision

A projected Graph Snapshot exposes the event offset it represents as its Graph Revision.

### AC-009 — DSH independence

Change Graph domain and event packages remain independent of Cordis/DSH.

## Implementation scope

Feature-02 includes:

- graph/domain TypeScript contracts;
- Criterion revision model;
- typed Relation model;
- cycle validation;
- semantic Event vocabulary;
- reference in-memory Event Store for ordering/concurrency contracts;
- deterministic Change Graph projector;
- unit tests for the invariants above.

The reference in-memory Event Store is an executable contract, not the production persistence decision.

## Non-goals

- production persistence backend;
- Context Compiler;
- semantic/vector search;
- GraphQL/Cypher API;
- orchestration/scheduler;
- GitHub integration;
- CI ingestion;
- Product/QA UI;
- release automation;
- production observation;
- DSH tool registration.
