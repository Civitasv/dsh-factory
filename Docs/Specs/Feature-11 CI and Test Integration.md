# Feature-11 CI and Test Integration

## Objective

Normalize CI, test, and static-analysis results into immutable Factory Artifacts and Evidence without allowing external CI status to become Gate truth.

~~~text
CI / test provider
       |
       v
normalized execution snapshot
       |
       +--> immutable ci/run Artifact
       |
       +--> factory/test-execution Evidence
       |
       +--> factory/static-analysis Evidence
       |
       v
Feature-03 Coverage
       |
       v
Feature-05 Gate Policy
~~~

## Boundary

CI systems report observations.

They do not:

- set Change status;
- satisfy a Gate directly;
- complete a Change;
- override contradictory Evidence.

Gate state remains a deterministic Factory policy projection.

## Test run snapshot

A normalized Test Run records:

- provider;
- external run id;
- suite;
- status;
- total/passed/failed/skipped counts;
- exit code;
- URL;
- start/completion times;
- exact Reality target Artifacts;
- environment/configuration Artifacts;
- exact Evidence subjects.

Supported status:

- passed;
- failed;
- cancelled.

## Test Evidence mapping

A Test Run produces:

- one `ci/run` Artifact containing normalized immutable metadata;
- one `factory/test-execution@1` Evidence.

Result mapping:

- passed -> supports;
- failed -> contradicts;
- cancelled -> inconclusive.

The Evidence payload uses the Feature-03 built-in test-execution schema.

The CI run Artifact itself is a `raw_output` Evidence source. Additional raw-output Artifacts may also be attached.

## Static analysis snapshot

A normalized Static Analysis Run records:

- provider;
- external run id;
- tool;
- finding count;
- status;
- URL;
- times;
- Reality;
- exact Evidence subjects.

It produces:

- a `ci/static-analysis-run` Artifact;
- `factory/static-analysis@1` Evidence.

Result mapping:

- completed with zero findings -> supports;
- completed with one or more findings -> contradicts;
- cancelled -> inconclusive.

## Reality

CI Evidence uses explicit Feature-03 Reality:

- target Artifacts are mandatory;
- environment/configuration are explicit arrays;
- no “latest commit” lookup occurs inside the adapter.

A result for commit/build A does not automatically apply to B.

## Idempotency

Artifact and Evidence ids are content-addressed from canonical normalized input.

Repeated ingestion of the same CI snapshot and mapping inputs yields identical identities.

Changed result/count/time/Reality yields a new immutable observation.

## Validation

Test Run validation rejects:

- empty provider/run id/suite;
- invalid status;
- non-integer or negative counts;
- total not equal to passed + failed + skipped;
- non-safe exit code;
- empty Reality targets;
- empty subjects.

Static Analysis validation rejects analogous invalid inputs and negative finding counts.

## Raw outputs

Adapters may include additional immutable Artifacts such as:

- JUnit XML;
- xcresult;
- coverage report;
- linter SARIF;
- raw log/trace.

Feature-11 references these as additional `raw_output` sources but does not parse vendor formats in core.

## Provider port

A host may implement a provider-neutral read port for fetching normalized runs.

GitHub Actions, Xcode Cloud, Jenkins, Buildkite, or another CI system can implement the port without changing Evidence semantics.

## Invariants

- **CI-01 Observation only** — CI does not mutate Gate/Change truth directly.
- **CI-02 Reality-bound** — every CI Evidence has explicit target Reality.
- **CI-03 Exact subjects** — every CI Evidence names exact subjects.
- **CI-04 Immutable run** — normalized run snapshots are immutable Artifacts.
- **CI-05 Content-addressed** — repeated identical observations are idempotent.
- **CI-06 Deterministic mapping** — provider status maps deterministically to Evidence result.
- **CI-07 Count integrity** — test counts must balance.
- **CI-08 No latest lookup** — adapter never resolves implicit current commit/build.
- **CI-09 Raw provenance** — generated Evidence has Artifact-backed sources.
- **CI-10 Policy separation** — external “green” is Evidence, never a Gate override.

## Acceptance criteria

- passed/failed/cancelled Test Runs map to supports/contradicts/inconclusive;
- Static Analysis zero/nonzero findings map correctly;
- generated Evidence passes the Feature-03 built-in Registry;
- identical snapshots produce identical ids;
- changed Reality produces different Evidence identity;
- invalid count totals are rejected;
- generated Reality/source/subjects are complete;
- no policy or Gate package dependency is required.

## Implementation scope

Feature-11 includes:

- `packages/integration-ci`;
- Test Run and Static Analysis normalized schemas;
- content-addressed CI Artifacts;
- built-in Evidence mapping;
- validation;
- provider read-port contract;
- unit tests.

## Non-goals

- running tests itself;
- GitHub Actions REST implementation;
- xcresult parsing;
- coverage thresholds;
- Gate evaluation;
- flaky-test history;
- CI UI.
