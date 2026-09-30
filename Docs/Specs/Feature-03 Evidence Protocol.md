# Feature-03 Evidence Protocol

## Objective

Define the trust, applicability, validation, and coverage model for Evidence in DSH Factory.

Feature-02 defines where Evidence lives in the Change Graph. Feature-03 defines what makes Evidence valid enough to participate in automated software-development decisions.

The protocol replaces statements such as:

> "The agent tested it and it works."

with structured facts that identify:

- what is being claimed;
- which exact subject is being evaluated;
- which software Reality was observed;
- which Artifacts support the observation;
- which Evidence kind/schema produced the payload;
- whether the Evidence is currently applicable;
- whether the Evidence structurally covers a Criterion's machine-readable requirements.

Evidence does not decide Gate policy. Gate sufficiency and authority belong to later policy features.

## Architecture decision

Evidence is an immutable observation with six semantic dimensions:

```text
Evidence
├── Kind
├── Claim
├── Verdict
├── Subject
├── Reality
├── Observation Sources
└── Payload
```

Evidence is validated on the command side before `evidence.recorded` is appended.

Replay never performs external verification I/O.

```text
External observation
      |
      v
Evidence Kind validator
      |
      v
Evidence command validation
      |
      v
evidence.recorded
      |
      v
Event Log
      |
      v
Deterministic graph replay
```

## Evidence schema

The core schema is:

```ts
interface Evidence {
  id

  kind
  kindVersion

  claim

  result:
    | 'supports'
    | 'contradicts'
    | 'inconclusive'

  subjects
  reality
  sources

  observedAt

  payload
}
```

Evidence deliberately does not contain:

- `changeId`;
- `runId`;
- producer identity;
- mutable status;
- `stale`;
- generic numeric confidence.

Those concerns already belong to graph relations, event provenance, or derived evaluation.

## Subject and Reality

Subject and Reality are separate concepts.

Example:

```text
Claim:
  "Pin closes before Editor becomes key window"

Subject:
  CRT-021@3

Reality:
  build 1028
  commit abc123
  macOS 26.0
  configuration release
```

The Subject identifies what is being evaluated.

The Reality identifies the concrete software/environment/configuration against which the observation was made.

## Evidence subjects

An Evidence subject may target:

- a top-level Change Graph node;
- an exact immutable Criterion Revision.

Criterion Evidence must bind to an exact `CriterionRevisionRef`.

A new Criterion revision never inherits old Evidence automatically.

## Evidence Reality

Reality is expressed entirely through Artifact references and does not introduce another top-level graph node kind.

```ts
interface EvidenceReality {
  targets: ArtifactRef[]
  environment: ArtifactRef[]
  configuration: ArtifactRef[]
}
```

Typical targets:

- source commit;
- build;
- deployment.

Typical environment Artifacts:

- operating-system snapshot;
- device;
- browser/runtime image;
- service environment.

Typical configuration Artifacts:

- feature flags;
- build configuration;
- test configuration;
- release configuration.

`targets` must contain at least one Artifact. Environment and configuration may be empty when they are intentionally not bound.

## Evidence sources

Evidence sources identify the raw materials behind an observation.

```ts
interface EvidenceSource {
  artifact: ArtifactRef

  role:
    | 'observation'
    | 'procedure'
    | 'raw_output'
    | 'attachment'
}
```

Examples:

- screenshot/video -> `observation`;
- Playwright script -> `procedure`;
- JUnit XML/log/trace -> `raw_output`;
- supporting diagnostics -> `attachment`.

Evidence must have at least one source.

Agent prose alone is not an Evidence source.

## Evidence kinds

Evidence kinds use stable semantic namespaced identifiers and versioned payload schemas.

```text
factory/test-execution@1
factory/reproduction@1
factory/metric@1
factory/static-analysis@1
factory/visual-observation@1
factory/runtime-observation@1
factory/deployment-observation@1
factory/human-attestation@1
```

Adapters should prefer converting vendor-specific observations into Factory semantic kinds rather than making downstream policy depend on vendor schemas.

Example:

```text
GitHub Check Run
       |
       v
GitHub adapter
       |
       v
factory/test-execution@1
```

## Versioned payload

`kind + kindVersion` selects the payload validator.

The core package stores payload as JSON-compatible data and does not grow a discriminated union for every future Evidence kind.

A separate Evidence Registry owns kind-specific validation.

## Evidence Registry

```ts
interface EvidenceKindDefinition<T> {
  kind
  version
  validatePayload(payload): T
}
```

The Registry:

- rejects duplicate `kind@version` registration;
- resolves validators by exact version;
- rejects unknown Evidence kinds on command-side validation;
- remains independent from DSH/Cordis.

The Registry is not needed during Event Log replay. A recorded event already represents a previously validated command-side observation.

## Built-in Evidence kinds

Feature-03 defines baseline validators for:

### `factory/test-execution@1`

Payload contains deterministic execution summary:

- suite;
- total;
- passed;
- failed;
- skipped;
- exit code.

### `factory/reproduction@1`

Payload records:

- procedure description;
- whether the issue reproduced.

### `factory/metric@1`

Payload records:

- metric name;
- unit;
- numeric samples.

### `factory/static-analysis@1`

Payload records:

- tool;
- finding count.

### `factory/visual-observation@1`

Payload records a non-empty observation description.

### `factory/runtime-observation@1`

Payload records a signal name and JSON-compatible value.

### `factory/deployment-observation@1`

Payload records deployment identity and deployment state.

### `factory/human-attestation@1`

Payload records the attested statement. Human identity remains event/provenance data rather than duplicated payload ownership.

These schemas are deliberately small. Vendor adapters may retain richer raw output as source Artifacts.

## Evidence invalidation

Evidence is immutable after recording.

If Evidence itself is later discovered to be unreliable, the system emits:

```text
evidence.invalidated
```

with an immutable invalidation record.

Reasons include:

- `corrupt_source`;
- `wrong_target`;
- `invalid_procedure`;
- `incorrect_observation`;
- `revoked_attestation`;
- `duplicate`;
- `other`.

Invalidation is not the same as later contradictory Evidence.

Example:

```text
build A -> PASS
build B -> FAIL
```

Both Evidence records may remain valid.

Invalidation means the Evidence itself should no longer be trusted.

## Applicability

Evidence never carries a mutable `stale` flag.

Applicability is derived from:

```text
Evidence + Current Reality + Invalidation state
```

The baseline states are:

- `applicable`;
- `not_applicable`;
- `unknown`;
- `invalid`.

V1 uses a conservative exact-Reality rule:

1. invalidated Evidence -> `invalid`;
2. no current Reality -> `unknown`;
3. exact target/environment/configuration Artifact sets -> `applicable`;
4. otherwise -> `not_applicable`.

Artifact-set comparison is order-independent and identity-based.

No semantic compatibility inference is performed by Feature-03.

For example, Evidence from macOS 26.0 does not automatically apply to macOS 26.1 unless a future Policy explicitly allows that equivalence.

## Evidence Requirements

Criterion Revision no longer stores `verificationMode`.

Verification needs are expressed entirely as machine-readable Evidence Requirements.

```ts
interface EvidenceRequirement {
  id

  acceptedKinds:
    EvidenceKindRef[]

  requiredResult:
    'supports'

  minimumCount: number

  reality: 'current'

  description?
}
```

### Composition rule

Feature-03 intentionally avoids recursive boolean requirement trees.

The composition model is:

```text
CriterionRevision.evidenceRequirements[] = ALL OF

EvidenceRequirement.acceptedKinds[]       = ANY OF
```

Example:

```text
Criterion
  requires ALL OF:
    ER-1:
      ANY OF:
        factory/test-execution@1
    ER-2:
      ANY OF:
        factory/visual-observation@1
        factory/human-attestation@1
```

This is sufficient for the initial SDLC verification model without introducing a general boolean expression language.

## Requirement matching

An Evidence record can satisfy a requirement only when:

- it targets the exact Criterion Revision;
- its `kind@version` is in `acceptedKinds`;
- it is `applicable` to current Reality;
- its result equals `requiredResult`;
- it is not invalidated.

Inconclusive Evidence never satisfies a requirement.

Contradicting Evidence never disappears merely because supporting Evidence also exists.

## Evidence Coverage

Feature-03 provides deterministic coverage evaluation for one requirement.

Coverage states are:

- `satisfied`;
- `missing`;
- `contradicted`;
- `conflicted`.

Definitions:

- enough supporting Evidence and no contradiction -> `satisfied`;
- insufficient supporting Evidence and no contradiction -> `missing`;
- insufficient supporting Evidence with contradiction -> `contradicted`;
- enough supporting Evidence and at least one contradiction -> `conflicted`.

Evidence is never majority-voted.

```text
2 PASS + 1 FAIL
```

does not become PASS.

It becomes `conflicted`.

Feature-03 only reports coverage. Gate/Policy decides what to do next.

## Criterion Coverage

Criterion coverage returns every Evidence Requirement's coverage result.

The Criterion is structurally complete only when every requirement is `satisfied`.

`conflicted`, `contradicted`, and `missing` remain explicit and are not collapsed into a Gate verdict.

## Validation layers

Evidence processing has three separate layers.

### Layer 1 — graph structural validation

During deterministic projection:

- subjects exist;
- Criterion revisions exist;
- source Artifacts exist;
- Reality Artifacts exist;
- invalidation targets/basis Evidence exist.

This layer is replay-safe.

### Layer 2 — Evidence Kind validation

On the command side:

- kind/version is registered;
- payload matches the exact schema;
- protocol-level invariants hold.

This layer may reject a proposed Evidence command before Event append.

### Layer 3 — Policy sufficiency

Later Gate/Policy logic decides whether the available Evidence is authoritative enough for a transition.

Feature-03 does not implement this layer.

## Replay rule

Event replay must never:

- execute tests;
- call Playwright;
- invoke a model;
- contact GitHub;
- query deployment systems;
- run performance tests;
- revalidate vendor data externally.

Replay uses only deterministic data already present in Events and Artifacts.

## Human attestation

Human judgment is represented explicitly through `factory/human-attestation@1`.

It is not disguised as automated Evidence.

Policy may later require this kind for Product acceptance or irreversible operations.

## Agent output rule

Agent prose is not Evidence.

An Agent may propose Evidence, but recorded Evidence must reference at least one Artifact source produced or captured by an observable mechanism.

This is the trust boundary between an AI worker's statement and a Factory fact.

## Graph relations

Feature-03 continues to use Feature-02 graph relations.

Examples:

```text
RUN-10 --produces-----> EV-20

EV-20 --supports------> CRT-3
EV-21 --contradicts---> CRT-3

EV-21 --raises--------> FIND-8
```

Evidence does not duplicate producing `runId`; the graph Relation remains the source of truth.

## Invariants

### EV-01 — immutable Evidence

Recorded Evidence is never mutated.

### EV-02 — exact subjects

Evidence always names at least one exact subject.

### EV-03 — revision-bound Criterion Evidence

Criterion Evidence binds to an exact immutable Criterion Revision.

### EV-04 — explicit Reality

Evidence records at least one target Artifact and explicit Reality dimensions.

### EV-05 — derived applicability

Applicability is derived from Evidence, current Reality, and invalidation state.

### EV-06 — applicability is not validity

Not-applicable Evidence remains valid historical Evidence.

### EV-07 — contradictions coexist

Contradictory Evidence never overwrites prior Evidence.

### EV-08 — no prose-only Evidence

Agent prose alone cannot become Evidence. Recorded Evidence has Artifact-backed sources.

### EV-09 — versioned kinds

Evidence kind payload schemas are addressed by exact `kind@version`.

### EV-10 — deterministic replay

Replay performs no external Evidence verification I/O.

### EV-11 — no generic confidence

Evidence has no generic numeric confidence field.

### EV-12 — machine-readable requirements

Evidence Requirements are the source of truth for Criterion verification needs; `verificationMode` is removed.

## Acceptance criteria

### AC-001 — Reality-bound Evidence

Core Evidence records exact subjects, Reality, typed sources, kind/version, result, and JSON-compatible payload.

### AC-002 — no verificationMode

`CriterionRevision.verificationMode` is removed and verification requirements are expressed through `EvidenceRequirement`.

### AC-003 — requirement composition

Criterion requirements use all-of semantics; each requirement's accepted kinds use any-of semantics.

### AC-004 — registry validation

The Evidence Registry rejects duplicate registrations, unknown kinds, and invalid payloads.

### AC-005 — built-in validators

The eight baseline Factory Evidence kinds have deterministic V1 payload validators.

### AC-006 — source-backed Evidence

Command-side validation rejects Evidence with no subjects, no Reality targets, or no Artifact sources.

### AC-007 — deterministic applicability

Exact Reality yields `applicable`; different Reality yields `not_applicable`; missing current Reality yields `unknown`; invalidated Evidence yields `invalid`.

### AC-008 — invalidation projection

`evidence.invalidated` is replayed as durable projection state without mutating the Evidence node.

### AC-009 — coverage conflict

Coverage reports simultaneous supporting and contradicting Evidence as `conflicted`, never by majority vote.

### AC-010 — replay independence

Event replay does not require the Evidence Registry or external integrations.

## Implementation scope

Feature-03 includes:

- upgraded core Evidence and Evidence Requirement schemas;
- removal of `verificationMode`;
- versioned Evidence kind references;
- Evidence Reality and typed sources;
- Evidence invalidation events/projection;
- `packages/evidence`;
- Evidence Registry;
- eight built-in V1 kind validators;
- command-side protocol validation;
- exact Reality applicability resolver;
- requirement and Criterion coverage resolvers;
- unit tests for all invariants above.

## Non-goals

- Gate/Policy authority decisions;
- worker scheduling;
- automatic generation of Evidence;
- GitHub/CI adapter;
- Playwright/browser adapter;
- benchmark runner;
- DSH tools;
- production persistence;
- semantic Reality compatibility;
- recursive boolean requirement expressions;
- Evidence ranking/scoring.
