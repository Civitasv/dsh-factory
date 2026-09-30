# Domain Model

## First-class concepts

The foundational vocabulary is intentionally small:

- **Change** — durable intent to alter software behavior or structure.
- **Criterion** — a stable acceptance-criterion identity with immutable revisions.
- **Artifact** — a concrete input/output such as an intent source, commit, build, log, screenshot, trace, benchmark, or deployment.
- **Evidence** — an immutable structured claim about observed reality, backed by Artifacts and exact subjects.
- **Finding** — a mismatch between intended and observed reality.
- **Decision** — an explicit durable choice.
- **Gate** — a stable policy/verifiability boundary whose evaluations are event-derived.
- **Run** — one execution attempt by a worker/runtime.
- **Relation** — an identified, typed, directed semantic edge in the Change Graph.
- **ContextPack** — a task-specific projection compiled from a specific Graph Revision.

Agents are intentionally absent from the domain graph. Workers are selected by capability and may disappear after a Run.

The complete Change Graph contract is defined by `Docs/Specs/Feature-02 Change Graph.md`.

## Change

A Change is not a Jira-style mutable status record.

The Change node owns only intrinsic identity and metadata:

- id;
- kind;
- title;
- creation actor/time.

Intent, Criteria, constraints, decomposition, dependencies, and other ownership facts are Relations. Workflow stage is derived from the graph and is not stored on Change.

A terminal Change disposition such as `completed`, `cancelled`, `superseded`, or `rejected` is a durable event-derived business fact.

## Criterion

Criterion is a first-class node with stable identity.

Criterion content is published as immutable, sequential revisions. Evidence must reference the exact Criterion revision it observed or verified. Publishing a new revision never rewrites historical Evidence.

Criterion Revision is addressable domain history but is not a ninth top-level graph node kind.

## Artifact and Evidence

Artifacts and Evidence are separate.

A video is an Artifact. A statement that the video demonstrates a behavior on a particular reality is Evidence.

Evidence records:

- claim;
- `supports | contradicts | inconclusive` result;
- source Artifacts;
- exact subjects;
- observation time.

An exact Evidence subject may refer to a top-level graph node or a specific Criterion revision.

Historical Evidence is not marked false merely because current reality changes. Gate/policy evaluation determines whether that Evidence is applicable to the current revision.

## Finding

Findings cover bugs, requirement gaps, performance regressions, test failures, security findings, UX findings, release failures, and production regressions.

The Finding node is the immutable opening fact. Reproduced/resolved/reopened/invalid states are projected from lifecycle events.

A Finding that reveals behavior outside current intent/Criteria should normally create or relate to another Change rather than silently expand scope.

## Gate

Gate identity is stable. Gate state is an event-derived evaluation, not Change status.

Satisfied or failed evaluations require Evidence. Stage labels such as Development, Testing, or Ready to Release remain presentation projections.

## Run

A Run represents one execution attempt and records the Graph Revision it consumed.

A DSH session may be related to a Run by an integration layer, but DSH session state is not Change Graph truth.

## Relations

Relations are durable identified facts. They are typed, directed, and retired rather than physically deleted.

The baseline semantic vocabulary is:

- structural: `has_intent`, `has_criterion`, `constrained_by`, `decomposes_into`, `depends_on`, `supersedes`;
- execution: `attempts`, `produces`, `observed_on`;
- verification: `supports`, `contradicts`, `evaluates`;
- feedback: `raises`, `addresses`, `caused_by`;
- governance: `governs`.

The heterogeneous graph may contain feedback cycles. The `decomposes_into`, `depends_on`, and `supersedes` relation subgraphs must remain acyclic.

## Events and projection

The Event Log is the source of truth.

Semantic domain events are projected into the current Change Graph. A Graph Revision is the latest applied graph-wide event offset.

Writes owned by a Change use optimistic concurrency against that Change's event sequence.

Production persistence remains a separate future capability; the in-memory Event Store currently acts as the executable contract for ordering and concurrency invariants.
