# Feature-12 Release and Deployment

## Objective

Define how a verified Change becomes a release candidate and how external deployment results return to Factory as immutable Artifacts and Evidence.

~~~text
Satisfied Release Gate
        +
 pinned Graph Revision
        |
        v
Prepared Release
        |
        v
Deployment Port
        |
        v
Deployment Receipt
        |
        +--> deployment Artifact
        +--> deployment-observation Evidence
~~~

## Release preparation

A release candidate is derived execution state, not a new Change Graph node.

Preparation requires:

- Change id;
- current Graph Revision;
- Release Gate assessment;
- Graph Revision at which that Gate was assessed;
- non-empty target Artifacts;
- explicit environment/configuration Artifacts;
- actor/time.

The Release Gate must be `satisfied`.

`pending`, `failed`, and `not_required` are not sufficient for the final release gate.

## Revision safety

The Gate assessment revision must equal the release Graph Revision.

A release cannot be prepared from a Gate assessment computed against older graph state.

The resulting Release Plan remains pinned to that Graph Revision.

## Release Plan

A Release Plan contains:

- deterministic Release id;
- Change id;
- Graph Revision;
- Release Gate id;
- exact Gate Evidence references;
- target Artifacts;
- environment/configuration;
- creation actor/time.

Release identity is content-addressed from the canonical logical plan.

Equivalent logical release inputs produce the same Release id.

## Release Artifact

Preparation also creates an immutable `release/candidate` Artifact.

Its metadata contains the complete normalized Release Plan.

This Artifact can later participate in Context/Evidence without creating a Release node kind.

## Deployment Port

Feature-12 defines a provider-neutral action port:

~~~text
deploy(plan, signal?) -> DeploymentReceipt
~~~

A host implementation may target:

- GitHub Releases;
- App Store / TestFlight;
- Kubernetes;
- internal deployment systems;
- package registries;
- another release service.

Factory does not embed provider SDK semantics in core.

## Deployment Receipt

A normalized receipt contains:

- provider;
- deployment id;
- state: succeeded | failed | cancelled;
- URL;
- observed/deployed timestamp;
- optional provider metadata.

The receipt is an observation of what the deployment provider reports.

## Deployment Artifact and Evidence

A receipt becomes:

- immutable `deployment/record` Artifact;
- `factory/deployment-observation@1` Evidence.

Evidence subjects include:

- the Change;
- the Release Gate.

Reality uses:

- release target Artifacts as targets;
- Release environment/configuration.

Result mapping:

- succeeded -> supports;
- failed -> contradicts;
- cancelled -> inconclusive.

The deployment Artifact is an `observation` Evidence source.

## Completion boundary

Successful deployment does not automatically emit `change.closed`.

Change completion is a separate domain/policy decision that may additionally depend on rollout/production observations.

## Failure boundary

Failed deployment creates contradictory deployment Evidence.

Feature-12 does not automatically create a Finding; later orchestration may decide whether a Finding/rollback Work item is appropriate.

## Idempotency

Release Plan, Release Artifact, Deployment Artifact, and Deployment Evidence identities are deterministic from normalized immutable facts.

Repeated ingestion of the same provider receipt is idempotent.

## Invariants

- **REL-01 Satisfied gate required** — final release preparation requires `satisfied`.
- **REL-02 Revision match** — Gate assessment revision equals Release Graph Revision.
- **REL-03 Explicit targets** — Release has at least one target Artifact.
- **REL-04 Content-addressed release** — equivalent plans share identity.
- **REL-05 Provider separation** — deployment mechanism is behind a port.
- **REL-06 Observation return** — provider result returns as Artifact + Evidence.
- **REL-07 Reality bound** — deployment Evidence uses exact release targets/environment/config.
- **REL-08 No completion shortcut** — successful deployment does not close Change.
- **REL-09 No synthetic failure Finding** — deployment failure remains Evidence until policy/orchestration acts.
- **REL-10 Domain independence** — provider SDKs remain outside core.

## Acceptance criteria

- non-satisfied Release Gate is rejected;
- stale Gate revision is rejected;
- equivalent release inputs produce identical Release ids;
- target/config/environment ordering does not affect identity;
- successful/failed/cancelled receipt maps to supports/contradicts/inconclusive;
- generated deployment Evidence passes Feature-03 validation;
- repeated identical receipts produce identical Artifact/Evidence ids;
- deployment does not create Change disposition.

## Implementation scope

Feature-12 includes:

- `packages/release`;
- Release Plan and Prepared Release;
- deterministic Release identity;
- release candidate Artifact;
- provider-neutral Deployment Port;
- normalized Deployment Receipt;
- deployment Artifact/Evidence conversion;
- unit tests.

## Non-goals

- rollout strategy;
- canary percentage control;
- rollback orchestration;
- App Store/GitHub/Kubernetes concrete clients;
- Change completion;
- production health observation (Feature-13);
- release UI.
