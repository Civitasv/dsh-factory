# Feature-19 DSH SDLC Vertical Slice

## Objective

Make an installed `@orven/plugin-dsh` useful from an ordinary DeepSeek Harness conversation.

Feature-19 is the first complete model-facing Orven slice:

~~~text
DSH session
   |
   | orven_begin_change
   v
Change + Criteria + Gate
   |
   | orven_status
   v
durable Change Graph status
   |
   | orven_execute
   v
derived Work -> DSH child Agent
   |
   v
Run + raw tool Artifacts + run-scoped Evidence
   |
   v
durable Change Graph
~~~

The slice deliberately stops before autonomous Orven mode and Graph UI. It proves the domain/runtime loop first.

## Product behavior

After installing the Orven Bundle into a DSH Web profile, the model can call:

~~~text
orven_begin_change
orven_status
orven_execute
~~~

The active Change is bound to the calling DSH Session, so ordinary calls do not require the model to copy a `changeId` between tool calls.

A typical interaction is:

~~~text
User: Add cache hit percentage to the UI.

Model:
  -> orven_begin_change(...)
  -> orven_status()
  -> orven_execute()

Orven:
  Change created
  Criteria persisted
  Child DSH Agent executed
  Run persisted
  Raw DSH tool results persisted as Artifacts
  Run-scoped operational Evidence persisted
~~~

Criterion verification is intentionally conservative. Feature-19 does not infer that an acceptance criterion is satisfied from assistant prose or merely from a successful Run.

## Architecture

Feature-19 adds one Harness-neutral application boundary and one DSH model-facing adapter.

~~~text
private domain/events/evidence/work/execution
                 |
                 v
      @orven/internal-application
                 |
                 v
        @orven/core/application
                 |
                 v
            OrvenService
                 |
       +---------+---------+
       |                   |
       v                   v
ctx.orven host API     Orven DSH tools
                           |
                           v
                     DSH Agent/Session
~~~

The application module owns high-level Orven commands. DSH-specific Session, Tool Runtime, Agent observation, and Cordis lifecycle remain in `packages/plugin-dsh`.

This keeps future `plugin-codex`, `plugin-claude`, or another Harness adapter from re-implementing Change creation, status projection, Work derivation, or execution-result recording.

## Public Core boundary

Feature-19 adds:

~~~text
@orven/core/application
~~~

`@orven/core/application` is Harness-neutral. It may depend only on Orven neutral modules.

The public Core root exposes it as the `application` namespace alongside the existing `events`, `evidence`, `work`, and `execution` namespaces.

## Application service

The neutral application module exposes an `OrvenApplication` over a small Event Store port.

~~~ts
interface OrvenApplicationStore {
  readonly graphId: GraphId

  currentRevision(): GraphRevision
  currentSequence(changeId: ChangeId): number
  readAll(): readonly EventEnvelope[]

  append(request: AppendRequest):
    readonly EventEnvelope[]
    | Promise<readonly EventEnvelope[]>
}
~~~

The application service does not own a second mutable graph. Every read projects from the Event Log.

Primary operations:

~~~ts
beginChange(input): Promise<BeginChangeResult>
status(changeId): ChangeStatus
deriveWork(input): WorkItem
recordExecution(input): Promise<RecordExecutionResult>
~~~

## Stable command boundary

Model-facing tools never receive the low-level `append()` Event Store seam.

The direction is:

~~~text
model
  |
  v
high-level command
  |
  v
domain validation
  |
  v
semantic Events
  |
  v
Event Log
~~~

This prevents a model from manufacturing arbitrary Event history.

`ctx.orven.append()` remains an advanced host-integration API for trusted plugins, but it is not registered as a DSH model tool.

## Begin Change

`beginChange` accepts:

~~~ts
interface BeginChangeInput {
  title: string
  kind: ChangeKind
  criteria: readonly {
    statement: string
    severity?: 'required' | 'recommended'
    acceptedEvidenceKinds?: readonly EvidenceKindRef[]
  }[]
  actor: ActorRef
}
~~~

Validation:

- title is non-empty;
- at least one Criterion is required;
- Criterion statements are non-empty;
- duplicate normalized Criterion statements are rejected;
- accepted Evidence kind lists, when provided, are non-empty and structurally valid.

One command appends, in order:

1. `change.created`;
2. one `criterion.created` per Criterion;
3. one `criterion.revision.published` at revision 1 per Criterion;
4. one `gate.created` with kind `acceptance`;
5. `has_criterion` relations from Change to each Criterion;
6. `evaluates` relations from the Gate to each Criterion.

The command is one Change-owned optimistic-concurrency append starting at Change sequence 0.

### Default Criterion evidence requirement

When the caller does not name accepted kinds, each Criterion revision receives one requirement:

~~~text
requiredResult = supports
minimumCount   = 1
reality        = current
~~~

Accepted machine-observation kinds are the built-in non-human kinds:

- `factory/test-execution@1`;
- `factory/reproduction@1`;
- `factory/metric@1`;
- `factory/static-analysis@1`;
- `factory/visual-observation@1`;
- `factory/runtime-observation@1`;
- `factory/deployment-observation@1`.

`factory/human-attestation@1` is never silently inserted as a model default.

## Change status

`status(changeId)` returns a deterministic projection containing:

- Change identity, title, and kind;
- current Graph Revision;
- latest revision of every active Criterion;
- exact-subject Evidence counts by verdict;
- Evidence invalidation count;
- acceptance Gate state, defaulting to `pending` when it has never been evaluated;
- Run counts and latest Run summary.

Feature-19 status deliberately reports observed Evidence facts rather than pretending to know current-Reality applicability when no exact current Reality has been established.

Therefore:

~~~text
Evidence count != Criterion verified
Run succeeded  != Gate satisfied
~~~

Gate satisfaction remains a Policy/Evidence decision.

## Work derivation

`deriveWork` creates a `WorkItem` at the current Graph Revision through the existing neutral Work package.

The default objective tells the worker to implement the Change and gather raw verification observations without inventing Evidence.

The Context request includes the Change, Criteria, Gate neighborhood, previous Runs/outputs, and subject Evidence within bounded deterministic budgets.

The Work item remains a derived execution projection and is not persisted as a ninth Graph node kind.

## Execution recording

The existing Feature-07/15 execution protocol remains authoritative:

~~~text
Work
 -> prepareExecution
 -> DSH Agent
 -> DshOutcomeCollector
 -> post-execution Graph Revision check
 -> ExecutionResult
~~~

Feature-19 adds a neutral `recordExecution` command that durably records only an accepted, non-stale `ExecutionResult`.

Event order:

1. `run.recorded`;
2. `artifact.recorded` for returned Artifacts;
3. `finding.opened` / `decision.recorded` when present;
4. `evidence.recorded` after its source/Reality Artifacts exist;
5. `attempts` relation from Run to Change;
6. `produces` relations from Run to every returned Artifact/Evidence/Finding/Decision.

The append is Change-owned and also compare-and-appends against the Run input Graph Revision.

## Atomic Graph Revision compare-and-append

Feature-07 already rejects a completed worker outcome when the Graph Revision changed while it ran.

Feature-19 closes the remaining race between accepted execution and durable recording by extending `AppendRequest` with:

~~~ts
expectedRevision?: GraphRevision
~~~

Both reference stores compare this expected value atomically at the actual append boundary.

A mismatch throws `GraphRevisionConflictError`.

This option is additive. Existing Change-sequence optimistic concurrency remains unchanged.

`recordExecution` supplies:

~~~text
expectedRevision = result.run.inputGraphRevision
expectedSequence = current Change sequence
~~~

so a Run can never be recorded against a Graph that advanced after acceptance.

## Workspace persistence

The DSH Bundle becomes durable by default.

Default plugin configuration:

~~~yaml
graphId: orven
persistenceDirectory: ./.orven
~~~

The path resolves against the DSH process working directory, which is the launched workspace for the normal Web/base-backed flow.

Therefore:

~~~text
workspace/
  .orven/
    graph.json
    events.jsonl
~~~

is the default Orven Event Log.

`.orven/` is ignored in the Orven repository itself for local development.

An explicit configuration may still override `persistenceDirectory`. A programmatic caller may explicitly construct an in-memory service in tests.

Feature-19 does not implement multiple simultaneous workspace graphs inside one DSH process.

## DSH Session active Change

Conversation state is not a Change Graph node.

The DSH adapter adds a plugin-owned Session event:

~~~ts
'orven/active-change': {
  changeId: string | null
}
~~~

and a host-only Session projection:

~~~text
orvenActiveChange
~~~

The projection folds the last binding event.

Consequences:

- `orven_begin_change` binds the new Change to the calling Session;
- `orven_status` uses that binding by default;
- `orven_execute` uses that binding by default;
- resume reconstructs the binding from durable Session history;
- fork semantics follow DSH Session seed semantics;
- no Session is added to the Orven Change Graph.

A tool call without an owning Agent/Session fails explicitly.

## Model-facing tools

The Bundle adds a second row:

~~~yaml
- id: orven-tools
  name: '@orven/plugin-dsh/tools'
~~~

The tool plugin injects:

~~~text
orven
tools
sessionProjections
~~~

### orven_begin_change

Model input:

~~~text
title
kind
criteria[] { statement, severity? }
~~~

Output contains:

~~~text
changeId
graphRevision
gateId
criteria[] { criterionId, revision, statement, severity }
~~~

On success it appends `orven/active-change` to the calling DSH Session.

### orven_status

No required model input.

It reads the Session's active Change and returns the structured neutral Change status.

It never asks the model to re-supply a Change id.

### orven_execute

Optional input:

~~~text
objective
~~~

It derives Work for the active Change and executes it through `ctx.orven` and the existing DSH Agent adapter.

The tool is foreground work in Feature-19. It forwards the caller's cancellation signal.

The DSH Worker descriptor uses one adapter-owned scheduling capability. It does not pretend that the Orven Work capability list is a mirror of the live DSH tool catalog.

After execution, an accepted result is committed through `recordExecution`, then the tool returns the new structured Change status.

A stale result is returned as stale and is not durably recorded.

## DSH outcome observation

Feature-19 provides a concrete DSH collector for the model-facing execution path.

The collector observes DSH runtime facts while the child Agent runs:

- `tools/result` for normalized tool outcomes;
- `session/event` `turn/end` for the child's terminal turn reason.

It keys observations by the exact child Agent/Session, so parent-session Orven tool activity does not leak into the child Run.

Terminal mapping:

~~~text
turn completed -> WorkerOutcome succeeded
turn aborted   -> WorkerOutcome cancelled
other reason   -> WorkerOutcome failed
missing end    -> WorkerOutcome failed closed
~~~

## Artifact capture

Every normalized child DSH tool result becomes an immutable Artifact:

~~~text
type = dsh/tool-result
~~~

Its local metadata may contain:

- tool name;
- call id;
- immutable normalized arguments;
- success/error state;
- canonical successful value or structured error;
- rendered content.

The Event Log is local workspace data. Feature-19 does not upload these Artifacts.

The Artifact is derived from DSH's normalized Tool Runtime result, not from assistant prose.

## Automatic Evidence capture

For each captured DSH tool-result Artifact, the collector emits one:

~~~text
factory/runtime-observation@1
~~~

Evidence item whose subject is the exact Run and whose source/Reality target is that exact Artifact.

The claim is narrowly scoped to the observed runtime fact:

~~~text
"DSH tool <name> produced a normalized success/error result during Run <id>."
~~~

This is valid operational Evidence about the Run.

It is deliberately NOT attached to acceptance Criteria.

This rule is load-bearing:

~~~text
successful tool call
    !=
criterion satisfied
~~~

Feature-19 therefore gains automatic Evidence without weakening the Evidence trust model.

Future verification collectors may translate JUnit/CI/static-analysis/visual observations into Criterion-bound Evidence.

## Assistant prose trust boundary

The collector never parses assistant text into:

- Artifact truth;
- Evidence;
- Finding;
- Decision;
- Gate evaluation.

Assistant messages remain DSH conversation history only.

A future structured extraction feature must still bind claims to Artifact-backed observations before recording Evidence.

## Service additions

`OrvenService` keeps all existing methods and adds high-level methods delegating to `@orven/core/application`:

~~~ts
beginChange(...)
status(...)
deriveWork(...)
recordExecution(...)
~~~

Existing `append`, `prepareWork`, `executePrepared`, and `executeWork` remain advanced host APIs.

No compatibility alias is added.

## Bundle exports

`@orven/plugin-dsh` adds:

~~~text
@orven/plugin-dsh/tools
~~~

The package continues to ship one DSH Bundle patch.

No third public Orven npm package is introduced.

## Failure behavior

- Invalid Change input fails before append.
- Missing Session active Change fails the model tool.
- A deleted/missing active Change fails status/execute rather than silently creating another Change.
- Stale Work fails before DSH Agent creation.
- A child Agent terminal failure produces a failed Run when freshness still holds.
- Parent cancellation cancels the child and records a cancelled Run only when freshness still holds.
- A stale post-execution result is not recorded.
- A compare-and-append revision conflict records nothing.
- Malformed built-in Evidence rejects the entire execution-record append.
- Persistent Event Log open/replay failure prevents `ctx.orven` publication.

## Security and privacy

Captured tool outputs can contain workspace content or command output.

Feature-19 stores them only in the local workspace `.orven` Event Log by default.

It does not:

- upload Artifacts;
- send Orven Event Log data to another service;
- bypass DSH sandbox/tool permission policy;
- execute shell commands directly from Core.

All code execution continues to belong to DSH.

## Invariants

### ORVSLICE-01 — high-level model boundary

DSH models receive high-level Orven tools, never the raw Event append API.

### ORVSLICE-02 — durable workspace default

The installed Bundle persists Orven state under the launched workspace by default.

### ORVSLICE-03 — Session is not a graph node

Active-Change conversation binding lives in DSH Session history/projection only.

### ORVSLICE-04 — neutral application logic

Change creation, status, Work derivation, and execution-result recording are Harness-neutral.

### ORVSLICE-05 — no prose Evidence

Assistant prose is never automatically promoted to Evidence.

### ORVSLICE-06 — raw observation provenance

Automatically collected Evidence is backed by exact DSH Tool Runtime Artifacts.

### ORVSLICE-07 — no criterion overclaim

Run/tool operational Evidence does not automatically satisfy acceptance Criteria.

### ORVSLICE-08 — atomic freshness recording

A Run record append compares the exact Graph Revision consumed by execution at the storage boundary.

### ORVSLICE-09 — DSH owns execution

Orven does not duplicate DSH model routing, tool execution, Session runtime, or sandbox.

### ORVSLICE-10 — distribution boundary

The public surface remains exactly `@orven/core` and `@orven/plugin-dsh`.

## Acceptance criteria

1. `@orven/core/application` is public and Harness-neutral.
2. A high-level begin command creates one Change, Criteria, Criterion revision 1 records, an acceptance Gate, and the required relations in one Change-owned append.
3. Status deterministically reports the active Change's Criteria, Evidence facts, Gates, and Runs without claiming unestablished Reality applicability.
4. Work is derived at the current Graph Revision and remains non-durable.
5. Both Event Store implementations support optional atomic `expectedRevision` and reject a mismatch without mutation.
6. An accepted ExecutionResult can be durably recorded as Run/output nodes and relations; a stale/revision-conflicted result cannot.
7. The DSH Bundle defaults to `./.orven` persistence.
8. DSH Session history durably binds one active Change through a plugin-owned projection.
9. `orven_begin_change`, `orven_status`, and `orven_execute` register through the real DSH Tool Runtime.
10. `orven_execute` uses the public DSH Agent service and forwards cancellation.
11. Child DSH normalized tool results become Artifacts plus Run-scoped `factory/runtime-observation@1` Evidence.
12. Automatic Evidence is never attached to a Criterion revision.
13. A real Loader composition mounts both `ctx.orven` and the Orven model tools through actual DSH services.
14. Core packed output contains the new application subpath with no private or Harness imports.
15. Exactly two public packages remain.
16. Typecheck, lint, unit tests, Loader composition, script checks, and distribution verification are Green.

## Verification matrix

Neutral unit tests cover:

- begin validation and event ordering;
- status projection;
- Work derivation;
- execution-result commit;
- Graph Revision compare-and-append conflict;
- built-in Evidence validation.

DSH adapter tests cover:

- active-Change Session projection;
- tool registration;
- missing-session/missing-active-Change failure;
- begin/status happy path;
- observation collector isolation and terminal mapping;
- tool-result Artifact/Evidence construction.

Real Loader smoke covers:

~~~text
real Cordis Loader
 -> real DSH AgentRegistry
 -> real DSH Tools service
 -> real Session Projection service
 -> @orven/plugin-dsh
 -> @orven/plugin-dsh/tools
 -> ctx.orven
 -> model-facing Orven tool registration
~~~

Distribution verification imports `@orven/core/application` from a clean external install.

## Non-goals

Feature-19 does not include:

- autonomous Orven mode/preset;
- automatic creation of a Change from every user prompt;
- Graph UI mounting in DSH Web;
- criterion satisfaction inferred from Run success;
- assistant-prose extraction into Evidence;
- a generalized verification-command parser;
- direct shell/process execution by Orven Core;
- GitHub/CI verification ingestion changes;
- multiple simultaneous workspace graphs in one DSH process;
- source HMR/development-link automation;
- another Harness adapter;
- npm publication.
