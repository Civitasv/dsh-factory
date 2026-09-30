# Feature-04 Context Compilation

## Objective

Define the deterministic boundary that converts a pinned Change Graph revision into the minimal sufficient context for one execution objective.

Context is not conversation history and is not an append-only prompt buffer.

```text
Objective
  +
ChangeId
  +
GraphRevision
  |
  v
Context Query
  |
  v
GraphSlice
  |
  v
Deterministic Context Compiler
  |
  v
ContextPack + ContextPackHash
```

The same graph revision, query, objective, capabilities, permissions, and budget must compile to the same logical ContextPack and hash.

## Ownership

Feature-04 owns:

- Context Query;
- GraphSlice;
- inclusion provenance;
- graph-size budgets;
- lazy omitted references;
- deterministic ordering;
- canonical ContextPack hashing.

Feature-04 does not own:

- model prompt formatting;
- model tokenization;
- worker selection;
- execution;
- policy decisions;
- external retrieval from GitHub/CI/DSH;
- graph persistence.

External facts must already exist in the Change Graph before they can enter a ContextPack.

## Source of truth

The Change Graph remains the source of truth.

ContextPack is a projection of one exact `GraphRevision` and never becomes a second mutable state store.

A ContextPack records:

- root Change;
- objective;
- pinned Graph Revision;
- selected graph slice;
- omitted lazy references;
- available capabilities;
- permissions;
- selection budget.

## Context Query

A query declares how graph context may expand from the root Change.

```ts
interface ContextQuery {
  direction: 'outbound' | 'inbound' | 'both'
  relationKinds: RelationKind[]
  maxDepth: number
  includeSubjectEvidence: boolean
}
```

Rules:

- `maxDepth` is a non-negative safe integer;
- relation traversal is limited to explicitly allowed relation kinds;
- traversal is deterministic and relation-id ordered;
- the root Change is always included;
- subject Evidence may be included when it directly names an included node or included Criterion Revision;
- no implicit filesystem, network, session, or provider lookup occurs.

## Graph Slice

A GraphSlice is self-contained for the selected neighborhood.

It contains:

- selected top-level nodes;
- selected active relations whose endpoints are both selected;
- selected Criterion Revisions owned by selected Criterion nodes;
- selected Evidence invalidation records for selected Evidence;
- selected Change dispositions;
- selected Finding lifecycle state;
- selected Gate evaluations;
- per-node provenance;
- omitted node references.

A GraphSlice carries the same `graphId` and `revision` as the source snapshot.

## Inclusion provenance

Every selected node records why it entered context.

Baseline reasons:

- `root`;
- `relation:<kind>`;
- `evidence-subject`.

A node may have multiple reasons. Reasons are unique and deterministically ordered.

Provenance is descriptive, not model reasoning.

## Subject Evidence expansion

When `includeSubjectEvidence` is enabled, the compiler may add Evidence nodes that directly target:

- an already included top-level node;
- a Criterion Revision belonging to an included Criterion node.

This expansion is bounded by the same node budget and does not recursively pull arbitrary Evidence sources as new graph nodes unless traversal relations independently select them.

## Budget

Feature-04 uses graph-selection budgets, not model-token budgets.

```ts
interface ContextSelectionBudget {
  maxNodes
  maxRelations
  maxCriterionRevisions
}
```

Each value is a non-negative safe integer.

The compiler:

1. always reserves capacity for the root Change;
2. selects candidates in deterministic order;
3. stops admitting candidates when a dimension reaches its limit;
4. records skipped top-level node candidates in `omittedNodes`;
5. never silently exceeds a budget.

Token budgets belong to the later model/runtime boundary because tokenization is provider/model specific.

## Deterministic ordering

ContextPack serialization must not depend on:

- Map insertion order;
- Event replay implementation details;
- original snapshot array order;
- traversal scheduling.

Canonical order:

- nodes: `kind:id`;
- relations: `RelationId`;
- Criterion Revisions: `criterionId, revision`;
- invalidations: `EvidenceId`;
- dispositions: `ChangeId`;
- Finding lifecycle: `FindingId`;
- Gate evaluations: `GateId`;
- provenance: node key, then reason;
- omitted nodes: node key;
- capabilities and permissions: lexical.

## Lazy references

When a candidate cannot be included because of budget, its `GraphNodeRef` is emitted in `omittedNodes`.

This allows later execution tooling to request more context explicitly without pretending the omitted data was part of the original pack.

A lazy reference does not carry hidden content.

## Context Pack

```ts
interface ContextPack {
  changeId
  graphId
  graphRevision
  objective

  slice

  availableCapabilities
  permissions
  budget
}
```

The pack contains no wall-clock compilation timestamp because that would make identical inputs hash differently.

## Context Pack hash

Compilation produces:

```ts
interface CompiledContext {
  pack: ContextPack
  hash: string
}
```

The hash is SHA-256 over canonical JSON of the logical pack.

Canonical JSON recursively sorts object keys and preserves already canonicalized array order.

The hash is used by Run records to identify the exact execution context.

## Reproducibility

A Run references:

- `inputGraphRevision`;
- `contextPackHash`.

A future audit can reconstruct the same Graph revision, re-run the same deterministic compilation inputs, and verify the hash.

Reconstruction does not imply that an external model will produce the same output.

## Invariants

### CTX-01 — graph-only input

Context compilation consumes Change Graph facts only.

### CTX-02 — pinned revision

Every ContextPack names exactly one Graph Revision.

### CTX-03 — deterministic compilation

Equivalent logical inputs compile to equivalent packs and identical hashes.

### CTX-04 — root preservation

The requested root Change is always included or compilation fails.

### CTX-05 — explicit expansion

Graph traversal follows only the relation kinds declared by the query.

### CTX-06 — bounded selection

The compiler never exceeds graph-selection budgets.

### CTX-07 — visible omission

Budget-skipped top-level nodes are exposed as lazy references.

### CTX-08 — provenance

Every selected top-level node has at least one inclusion reason.

### CTX-09 — no hidden retrieval

Compilation performs no filesystem, network, model, GitHub, CI, or DSH lookup.

### CTX-10 — no conversational truth

Conversation/session history is not automatically treated as domain context.

## Acceptance criteria

### AC-001 — deterministic neighborhood

The same logical graph with different input array order compiles to the same hash.

### AC-002 — relation filtering

Disallowed relation kinds do not expand the graph neighborhood.

### AC-003 — depth bound

Traversal never exceeds `maxDepth`.

### AC-004 — subject Evidence

Enabled subject-Evidence expansion includes Evidence targeting selected nodes or selected Criterion Revisions.

### AC-005 — budget omission

A node budget records skipped candidates in `omittedNodes` without exceeding the limit.

### AC-006 — revision pinning

The output pack carries the exact source `graphId` and `GraphRevision`.

### AC-007 — canonical hash

Equivalent packs produce identical SHA-256 hashes.

### AC-008 — provenance completeness

Every selected node has deterministic provenance.

### AC-009 — domain independence

The Context package depends only on Factory domain packages and not on DSH/Cordis.

## Implementation scope

Feature-04 includes:

- Context protocol types in `packages/core`;
- `packages/context`;
- deterministic graph-neighborhood compiler;
- subject-Evidence expansion;
- budget enforcement;
- omission tracking;
- canonical JSON hashing;
- tests for ordering, depth, filtering, Evidence expansion, budgets, and hash stability.

## Non-goals

- prompt templates;
- token counting;
- semantic/vector retrieval;
- graph persistence;
- external artifact materialization;
- worker selection;
- execution;
- DSH integration;
- policy/gate decisions.
