# Feature-06 Work and Capabilities

## Objective

Define how DSH Factory represents executable work without reintroducing persistent human-role agents.

A Work item is a derived execution projection pinned to one Graph Revision.

```text
Change Graph / Gate / Finding facts
              |
              v
          Work Demand
              |
              v
           Work Item
              |
              v
     Capability Matching
              |
              v
      Disposable Worker
```

Work is not a Change Graph node and is not a second source of domain truth.

## Capability model

A Capability is a stable namespaced semantic identifier.

Examples:

- `code.read`
- `code.implement`
- `bug.reproduce`
- `test.execute`
- `ui.observe`
- `performance.measure`
- `release.prepare`
- `release.deploy`

Capabilities describe what can be done, not who traditionally does it.

There is no architectural `DeveloperAgent`, `QAAgent`, or `ReleaseAgent`.

## Work item

```ts
interface WorkItem {
  id
  changeId
  graphRevision

  objective
  requiredCapabilities

  priority
  source

  context
}
```

The Work id is deterministically derived from the logical work specification.

Equivalent logical Work specifications produce the same Work id.

## Work source

A Work item records why it exists without making the source another workflow owner.

Baseline sources:

- Change;
- Gate;
- Finding;
- Criterion Revision.

The source is a reference to existing domain facts.

## Graph Revision pinning

Every Work item records the Graph Revision from which it was derived.

Execution of Work against a later graph revision is a stale-work condition handled by Feature-07.

## Required capabilities

`requiredCapabilities` is a non-empty unique set.

A Worker is eligible only when its declared capability set is a superset of Work requirements.

Capability matching is exact and deterministic. There is no fuzzy capability inference in Feature-06.

## Worker descriptor

```ts
interface WorkerDescriptor {
  id
  capabilities
  maxParallel
}
```

Worker descriptors are runtime inventory, not Change Graph nodes.

Worker identity does not own domain state.

## Worker selection

Feature-06 returns all eligible Workers in deterministic id order.

It does not choose a “best” Worker based on model quality, cost, or latency.

Those scheduling concerns belong to later orchestration/runtime policy.

## Work Demand

A Work Demand is an unmaterialized request discovered from domain state.

```ts
interface WorkDemand {
  changeId
  graphRevision
  objective
  requiredCapabilities
  priority
  source
  context
}
```

Materialization:

- validates the demand;
- canonicalizes capabilities;
- produces deterministic Work identity.

## Local Work Plan

Global SDLC history may contain cycles, but one concrete execution plan is a DAG.

```ts
interface WorkPlan {
  graphRevision
  items
  dependencies
}
```

Dependency edges are:

```text
work A depends_on work B
```

The plan rejects:

- missing Work references;
- self-dependencies;
- duplicate dependency edges;
- dependency cycles;
- mixed Graph Revisions.

## Priority

Baseline priorities:

- `critical`
- `high`
- `normal`
- `low`

Priority is scheduling metadata only and does not change domain truth.

## Context request

Work does not embed a mutable ContextPack.

It embeds the deterministic Context Query + selection budget needed to compile one when execution begins.

This is important because Feature-07 must re-check graph freshness before compiling/executing.

## Invariants

### WORK-01 — derived Work

Work is derived from graph facts and is not a Change Graph node.

### WORK-02 — revision pinned

Every Work item names exactly one Graph Revision.

### WORK-03 — capability based

Workers match Work through capabilities, never human-role labels.

### WORK-04 — exact matching

Worker eligibility requires every required capability.

### WORK-05 — deterministic identity

Equivalent Work Demands produce the same Work id.

### WORK-06 — local DAG

A Work Plan must remain acyclic.

### WORK-07 — one revision per plan

Every Work item in a plan uses the plan's Graph Revision.

### WORK-08 — no hidden context

Work carries a Context compilation request, not accumulated conversation text.

### WORK-09 — deterministic matching

Eligible Worker order is stable.

## Acceptance criteria

### AC-001 — canonical Work

Capability order and duplicates do not affect Work identity.

### AC-002 — validation

Empty objective, empty capabilities, invalid priority, or invalid Context selection are rejected.

### AC-003 — worker matching

A Worker missing one required capability is ineligible.

### AC-004 — deterministic workers

Eligible Workers are returned in stable id order.

### AC-005 — DAG validation

Dependency cycles, self-edges, missing references, and duplicate edges are rejected.

### AC-006 — revision consistency

A Work Plan rejects items from another Graph Revision.

### AC-007 — domain independence

Work/Capability packages remain independent of DSH/Cordis.

## Implementation scope

Feature-06 includes:

- `packages/work`;
- Capability and Worker descriptor types;
- Work Demand / Work Item;
- deterministic Work id generation;
- demand validation;
- exact capability matching;
- Work Plan DAG validation;
- tests for canonical identity, matching, and DAG invariants.

## Non-goals

- selecting a model;
- executing a Worker;
- retries/cancellation;
- queue persistence;
- distributed scheduling;
- worker scoring;
- DSH integration;
- UI.
