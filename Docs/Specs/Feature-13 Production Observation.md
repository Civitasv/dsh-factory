# Feature-13 Production Observation

## Objective

Bring production/runtime observations back into the Change Graph as immutable Evidence and deterministic regression Findings.

~~~text
Production provider
       |
       v
normalized signal observation
       |
       +--> production/observation Artifact
       +--> runtime-observation Evidence
       |
 deterministic health rule
       |
       +--> supports
       |
       └--> contradicts + production_regression Finding
~~~

Feature-13 establishes the production feedback loop without allowing telemetry to mutate Change scope or status directly.

## Production observation

A normalized observation records:

- provider;
- observation id;
- signal name;
- numeric value;
- unit;
- observation timestamp;
- deployment Artifact;
- exact Reality;
- exact Evidence subjects.

The observation is immutable.

## Artifact representation

Each normalized observation becomes a content-addressed `production/observation` Artifact.

Artifact metadata contains the complete normalized observation including deployment reference.

Repeated ingestion of identical facts is idempotent.

## Runtime Evidence

Each observation produces `factory/runtime-observation@1` Evidence.

Payload:

- signal;
- value.

Reality is supplied explicitly by the caller and normally includes the deployed build/release target.

The production observation Artifact is the Evidence observation source.

## Health Rule

Feature-13 supports deterministic numeric health rules:

~~~text
signal
comparator: lt | lte | gt | gte
threshold
severity
description
~~~

A rule evaluates only an observation with the exact same signal name.

No model/anomaly inference is performed.

## Rule outcome

If a rule passes:

- Evidence result = supports;
- no Finding is proposed.

If a rule fails:

- Evidence result = contradicts;
- one `production_regression` Finding is proposed.

The Finding is deterministic and content-addressed from the rule and observation.

## Finding proposal

The proposed Finding records:

- type: `production_regression`;
- expected rule condition;
- actual observed value/unit;
- configured severity;
- confidence = 1 for deterministic threshold evaluation;
- opening actor/time.

Feature-13 does not append the Finding or create a child Change.

Feature-06/07 orchestration may later turn the Finding into investigation/fix Work.

## Deployment binding

Every production observation names the deployment Artifact it came from.

Feature-13 does not infer “current deployment” from environment state.

This preserves exact provenance and prevents observations from one rollout from being silently applied to another.

## Provider port

A host can implement a provider-neutral observation port for systems such as:

- OpenTelemetry;
- Datadog;
- Prometheus;
- Sentry;
- CloudWatch;
- custom telemetry.

Provider credentials, polling, subscriptions, and alert delivery remain outside this feature.

## No global health status

Factory does not store:

~~~text
Change.health = healthy
~~~

Health remains a projection over production Evidence/Findings at a given Reality and time range.

## Idempotency

Observation Artifact, Evidence, and Finding proposal identities are deterministic from canonical normalized facts.

Duplicate delivery does not create new identities.

## Invariants

- **OBS-01 Immutable observation** — production facts become immutable Artifacts.
- **OBS-02 Deployment provenance** — every observation names one deployment Artifact.
- **OBS-03 Reality bound** — every observation Evidence names exact Reality.
- **OBS-04 Exact subjects** — production Evidence names exact subjects.
- **OBS-05 Deterministic rule** — rules are pure numeric comparisons.
- **OBS-06 Violation produces Finding proposal** — contradiction is paired with production_regression Finding.
- **OBS-07 No silent scope mutation** — Finding does not modify/create Change automatically.
- **OBS-08 No health field** — Change has no authoritative production-health status.
- **OBS-09 Idempotent ingestion** — identical observations map to identical ids.
- **OBS-10 Provider separation** — telemetry transport lives behind a port.

## Acceptance criteria

- matching signal/rule evaluates deterministically;
- wrong signal is rejected;
- passing observation creates supporting runtime Evidence and no Finding;
- failing observation creates contradictory runtime Evidence and deterministic production_regression Finding;
- generated Evidence passes Feature-03 validation;
- changed deployment/Reality/value changes identity;
- repeated identical observation is idempotent;
- no Change disposition/status is produced.

## Implementation scope

Feature-13 includes:

- `packages/observation`;
- normalized numeric production observation;
- content-addressed observation Artifact;
- runtime-observation Evidence;
- deterministic Health Rule evaluation;
- production_regression Finding proposal;
- provider port;
- unit tests.

## Non-goals

- telemetry polling scheduler;
- anomaly detection;
- statistical baselines;
- automatic rollback;
- automatic fix Change creation;
- incident paging;
- production dashboard UI.
