# Feature-05 Gates and Policy

## Objective

Define the deterministic policy boundary that converts Evidence Coverage, Finding state, and explicit authority decisions into Gate assessments.

Evidence answers:

> What do we know about the current Reality?

Policy answers:

> Is that knowledge sufficient to advance through this Gate?

The two responsibilities remain separate.

## Architecture

```text
Criterion Revisions
      +
Evidence Coverage
      +
Finding Lifecycle
      +
Policy Definition
      +
Optional Authority Decision
      |
      v
Gate Policy Evaluator
      |
      v
Gate Assessment
      |
      v
gate.evaluated event
```

The evaluator is pure and performs no model or network I/O.

## Gate identity

A Gate remains a stable graph node owned by Feature-02.

Feature-05 does not add mutable Gate status to Change.

Current Gate state is derived from:

- exact Criterion coverage;
- configured Finding blockers;
- explicit `not_required` authorization;
- policy definition.

## Gate Policy

```ts
interface GatePolicy {
  id
  gateKind

  criteria:
    CriterionRevisionRef[]

  blockFindingSeverities:
    Severity[]

  notRequiredAuthorities:
    ActorKind[]
}
```

A policy references exact Criterion Revisions. Publishing a new Criterion Revision does not silently retarget an existing policy.

## Criterion semantics

All Criterion references listed by a Gate Policy are required.

For each referenced Criterion:

- every Evidence Requirement must be `satisfied` for that Criterion to be complete;
- `missing` coverage keeps the Gate `pending`;
- `contradicted` coverage makes the Gate `failed`;
- `conflicted` coverage makes the Gate `failed`.

Gate Policy never resolves Evidence conflicts by voting.

## Finding blockers

A Gate Policy may block on open Findings by severity.

A Finding blocks only when:

- it belongs to the evaluated Change through the caller-provided graph projection;
- its lifecycle is `open` or `reproduced`;
- its severity appears in `blockFindingSeverities`.

Finding blockers keep the Gate `pending`.

They do not automatically make the Gate `failed`, because a Finding may have no direct Evidence suitable for the existing Feature-01 rule that failed Gate evaluations carry Evidence.

## Evidence for Gate evaluation

When a Gate is `satisfied`, the assessment carries the union of supporting Evidence that satisfied its required Criterion coverage.

When a Gate is `failed`, the assessment carries the union of contradicting Evidence, plus supporting Evidence participating in any conflicted coverage.

Evidence references are unique and deterministically ordered.

A pending or not-required Gate may carry no Evidence.

## Not-required authorization

A Gate can become `not_required` only through an explicit authorization:

```ts
interface NotRequiredAuthorization {
  gateId
  actor
  reason
  decisionId?
}
```

The actor kind must appear in the Gate Policy's `notRequiredAuthorities`.

A `not_required` authorization bypasses ordinary Criterion coverage because its semantic meaning is that the Gate does not apply to this Change.

It does not rewrite or invalidate existing Evidence.

## Authority rules

Feature-05 does not allow a human, agent, or system actor to directly force a Gate to `satisfied`.

Subjective approval is represented by required Evidence such as:

```text
factory/human-attestation@1
```

This preserves the invariant:

> satisfied means required Evidence exists.

Authority is used only for explicit policy decisions such as `not_required`.

## Gate Assessment

```ts
interface GateAssessment {
  gateId
  gateKind

  state:
    | 'pending'
    | 'satisfied'
    | 'failed'
    | 'not_required'

  evidence
  reasons
  criterionCoverage
  blockingFindings
}
```

Reasons are machine-readable codes, not prose-only diagnostics.

Baseline reasons:

- `criterion_missing`;
- `criterion_contradicted`;
- `criterion_conflicted`;
- `finding_blocker`;
- `not_required_authorized`;
- `requirements_satisfied`.

## Policy profile

A Policy Profile groups Gate Policies for one project/runtime policy context.

```ts
interface PolicyProfile {
  id
  gates: GatePolicy[]
}
```

Gate kinds must be unique within a profile.

The profile is configuration/domain policy; it is not a Change Graph node.

## Determinism

Gate evaluation depends only on explicit inputs.

Equivalent logical inputs produce equivalent assessments regardless of array order.

The evaluator:

- sorts Criterion references;
- sorts Evidence references;
- sorts Finding references;
- sorts reason codes.

## Invariants

### POL-01 — no manual satisfied override

No authority actor can force `satisfied` without required Evidence Coverage.

### POL-02 — exact Criterion revisions

Gate Policy references exact Criterion Revisions.

### POL-03 — conflict fails

Contradicted or conflicted required Criterion coverage makes the Gate fail.

### POL-04 — missing stays pending

Missing required coverage keeps the Gate pending.

### POL-05 — finding blockers stay pending

Configured open/reproduced Finding blockers prevent satisfaction without fabricating failed Evidence.

### POL-06 — explicit not-required

`not_required` requires explicit authorization from an allowed actor kind.

### POL-07 — deterministic evidence union

Gate Evidence references are unique and deterministically ordered.

### POL-08 — policy is not workflow stage

Gate assessment does not write a Change stage/status.

### POL-09 — pure evaluation

Gate Policy evaluation performs no external I/O.

### POL-10 — human judgment is Evidence

Subjective approval required for satisfaction enters through Evidence, not policy override.

## Acceptance criteria

### AC-001 — satisfied

All required Criterion Coverage satisfied and no blocking Findings yields `satisfied`.

### AC-002 — pending

Any missing required Criterion or configured blocking Finding yields `pending`.

### AC-003 — failed

Any contradicted or conflicted required Criterion yields `failed`.

### AC-004 — evidence aggregation

Satisfied/failed assessment exposes the deterministic relevant Evidence union.

### AC-005 — not-required authority

Unauthorized `not_required` authorization is rejected; authorized input yields `not_required`.

### AC-006 — profile validation

A Policy Profile rejects duplicate gate kinds, duplicate Criterion references, and invalid severity/authority configuration.

### AC-007 — order independence

Equivalent policy inputs in different array orders yield equivalent assessments.

### AC-008 — event compatibility

A terminal assessment can be converted into the existing `GateEvaluationInput` without weakening the Evidence-backed Gate invariant.

## Implementation scope

Feature-05 includes:

- `packages/policy`;
- Gate Policy/Profile types;
- deterministic profile validation;
- Gate evaluator;
- Finding blocker evaluation;
- not-required authorization;
- Gate Assessment -> GateEvaluationInput conversion;
- tests for satisfied/pending/failed/conflicted/not-required behavior.

## Non-goals

- workflow scheduling;
- worker selection;
- risk scoring;
- release-specific rollout policy;
- persistence backend;
- UI;
- DSH integration;
- automated human approval requests.
