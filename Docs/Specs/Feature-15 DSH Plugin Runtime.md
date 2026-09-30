# Feature-15 DSH Plugin Runtime

## Objective

Make DSH Factory a first-class DeepSeek Harness plugin that runs inside the DSH/Cordis service graph.

The architectural model is:

~~~text
DeepSeek Harness
│
├── agents / agent loop
├── sessions
├── models
├── tools / skills
├── sandbox
├── host/runtime services
│
└── @dsh-factory/plugin-dsh
      │
      ├── Change Graph
      ├── Evidence
      ├── Context Compilation
      ├── Gates / Policy
      ├── Work
      ├── Execution
      ├── Persistence
      ├── GitHub / CI / Release / Observation
      └── Graph UI
~~~

DSH is the harness. Factory is an SDLC domain/orchestration plugin installed into that harness.

Feature-15 supersedes the public packaging model introduced by Feature-08. Feature-08's public-agent execution semantics remain valid; the public package and service boundary are corrected.

## Architectural correction

The previous public entry was named:

~~~text
@dsh-factory/runtime-dsh
ctx.dshFactoryRuntime
~~~

Feature-15 changes the public boundary to:

~~~text
@dsh-factory/plugin-dsh
ctx.factory
~~~

The plugin is the composition root for Factory inside DSH.

Internal Factory packages remain plain TypeScript libraries. They are not individually registered as Cordis services unless a future consumer requires an independent lifecycle.

## Package topology

~~~text
packages/core
packages/events
packages/evidence
packages/context
packages/policy
packages/work
packages/execution
packages/persistence
packages/integration-github
packages/integration-ci
packages/release
packages/observation
packages/graph-ui
        │
        └───────────────┐
                        ▼
              packages/plugin-dsh
                        │
                        ▼
                     DSH/Cordis
~~~

Only packages/plugin-dsh imports DSH/Cordis runtime APIs.

Feature-15 removes packages/runtime-dsh after migrating its execution adapter and message-source implementation.

## DSH plugin shape

The public package is a normal DSH namespace plugin:

~~~ts
export const name = 'dsh-factory'
export const inject = ['agents']
export const Config = ...

export async function apply(
  ctx: Context,
  config: Config,
): Promise<void>
~~~

It must not default-export apply.

The plugin uses only public DSH services and public Cordis lifecycle APIs.

## Public service

Mounting the plugin publishes:

~~~ts
ctx.factory: FactoryService
~~~

FactoryService is the public API other DSH plugins use to access Factory.

It is the composition surface, not a second domain model.

## FactoryService responsibilities

The initial service owns these operations:

~~~ts
interface FactoryService {
  readonly graphId: GraphId

  currentRevision(): GraphRevision
  currentSequence(changeId: ChangeId): number
  snapshot(): ChangeGraphSnapshot

  append(request: AppendRequest):
    Promise<readonly EventEnvelope[]>

  prepareWork(input: FactoryPrepareWorkInput):
    PreparedExecution

  executePrepared(input: FactoryExecutePreparedInput):
    Promise<ExecutionResult>

  executeWork(input: FactoryExecuteWorkInput):
    Promise<ExecutionResult>
}
~~~

### Graph access

snapshot() is a deterministic projection of the service's Event Store.

currentRevision() and currentSequence() expose concurrency/freshness facts already owned by the Event Store.

The service does not cache a second mutable Change Graph.

### Event append

append() is the durable mutation seam.

It preserves:

- Feature-02 Event ordering;
- per-Change optimistic concurrency;
- immutable domain history;
- Event Store ownership.

Integration packages may construct semantic Domain Events, but they commit through this service when running inside DSH.

### Work preparation

prepareWork() binds:

- one Work Item;
- the current Factory graph snapshot;
- one DSH Worker descriptor;
- one attempt number;
- optional capabilities/permissions.

It delegates to Feature-07 prepareExecution().

A Work item whose Graph Revision no longer matches the Factory Event Store is rejected as stale before DSH Agent creation.

### Execution

executePrepared() drives one already prepared execution through DSH.

executeWork() is the common convenience path:

~~~text
Work
  ↓
snapshot/current revision
  ↓
prepareExecution
  ↓
ctx.agents.create()
  ↓
inject ContextPack
  ↓
followup objective
  ↓
DSH model/tools/skills/sandbox
  ↓
whenIdle
  ↓
DshOutcomeCollector
  ↓
Feature-07 freshness acceptance
~~~

The DSH Agent remains disposable runtime state.

## DSH execution seam

Feature-08's DshExecutionAdapter moves into plugin-dsh as an implementation detail/public advanced API.

It continues to use:

- ctx.agents.create();
- AgentHandle;
- agent.inject();
- agent.followup();
- agent.whenIdle();
- agent.cancel();
- AgentHandle.dispose().

It does not import @deepseek-ai/dsh-agent-loop.

The plugin depends on the public agents service. A DSH composition must provide an Agent factory, ordinarily through DSH's agent-loop composition.

## Outcome trust boundary

DSH Agent history may contain arbitrary model prose and tool output.

Factory requires typed:

- Artifacts;
- Evidence;
- Findings;
- Decisions;
- terminal execution status.

Therefore the plugin retains an explicit DshOutcomeCollector seam.

The service never converts assistant prose directly into trusted Evidence.

A collector may inspect the completed Agent/Session and return Feature-07 WorkerOutcome.

## Event Store port

The service depends on a small internal Event Store contract:

~~~ts
interface FactoryEventStore {
  readonly graphId: GraphId

  currentRevision(): GraphRevision
  currentSequence(changeId: ChangeId): number
  readAll(): readonly EventEnvelope[]

  append(request: AppendRequest):
    readonly EventEnvelope[]
    | Promise<readonly EventEnvelope[]>
}
~~~

Both existing stores satisfy this contract:

- InMemoryEventStore;
- JsonlEventStore.

The plugin owns the store instance for its lifetime.

## Plugin configuration

Feature-15 exposes:

~~~ts
interface Config {
  graphId: string
  persistenceDirectory?: string
}
~~~

Defaults:

~~~text
graphId = "factory"
persistenceDirectory = undefined
~~~

When persistenceDirectory is absent, the plugin uses the in-memory Event Store.

When present, the plugin opens Feature-09 JsonlEventStore before publishing ctx.factory.

A relative persistence path resolves from process.cwd().

The service is not published until persistent Event Log opening and replay validation succeed.

## Cordis lifecycle

apply() may be asynchronous because persistent store opening is asynchronous.

Publication order:

~~~text
resolve config
   ↓
open/construct Event Store
   ↓
construct DSH execution adapter
   ↓
construct FactoryService
   ↓
ctx.provide('factory', service)
~~~

A failed store open must fail the plugin load; no half-initialized ctx.factory is published.

Cordis owns service unpublication when the plugin fiber disposes.

## DSH ownership boundary

DeepSeek Harness owns:

- Agent lifecycle;
- Agent loop;
- Session mechanics;
- model invocation/routing;
- tool execution;
- skills;
- sandbox/process runtime;
- Cordis plugin lifecycle;
- DSH host/UI infrastructure.

Factory owns:

- Change semantics;
- Criterion semantics;
- Evidence trust;
- Findings;
- Context selection;
- Gate/Policy semantics;
- Work discovery/planning;
- SDLC execution acceptance/freshness;
- SDLC Event Log;
- GitHub/CI/Release/Observation semantics;
- Factory graph presentation.

Factory must not duplicate DSH Session or Agent lifecycle state as domain truth.

## Loader composition

Factory is designed to be mounted by the ordinary DSH Loader:

~~~yaml
- id: factory
  name: '@dsh-factory/plugin-dsh'
  config:
    graphId: my-project
    persistenceDirectory: ./.factory
~~~

The plugin requires the DSH agents service through namespace-plugin injection.

## Real composition acceptance

Unit tests of a fake DshAgentPort are insufficient for the public plugin boundary.

Feature-15 adds a real Loader/process smoke test.

The test must boot a real cordis.yml through the actual Cordis Loader and mount:

1. the real @deepseek-ai/dsh-agent service;
2. a test-only AgentFactory registered through the public AgentRegistry.setFactory() seam;
3. the real Factory plugin source/package.

The test-only factory replaces only the execution driver/model side. It does not replace ctx.agents or ctx.factory.

The smoke must prove:

- Loader activation succeeds;
- ctx.factory exists;
- a semantic Change Event can be appended through ctx.factory;
- a Work Item can be executed through ctx.factory.executeWork();
- execution reaches ctx.agents.create();
- Context injection precedes Work followup;
- the typed collector result passes through Feature-07 acceptance;
- Graph Revision is preserved;
- the plugin/service disappears when the Loader process exits/disposes.

This test is keyless and deterministic.

## Installed composition vs execution driver

The plugin itself does not inject or depend on agent-loop.

This preserves DSH's public abstraction:

~~~text
Factory plugin
    ↓
ctx.agents
    ↓
registered AgentFactory
~~~

In production, DSH's agent-loop normally registers that factory.

In the real-composition test, a deterministic test factory is registered instead so CI requires no model key and no network.

## API compatibility

Feature-15 targets:

- @deepseek-ai/cordis 4.0.4;
- DSH public package family 0.2.0-rc.2;
- current Loader/Include public packages.

The package uses exact peer versions for the DSH public seams it imports.

DSH/Cordis dependencies remain isolated to plugin-dsh.

## Migration

### Package

~~~text
@dsh-factory/runtime-dsh
        ↓
@dsh-factory/plugin-dsh
~~~

### Context service

~~~text
ctx.dshFactoryRuntime
        ↓
ctx.factory
~~~

### Docs

Feature-08 remains historical documentation for the DSH execution seam.

Feature-15 becomes the authoritative document for:

- public packaging;
- DSH plugin topology;
- ctx.factory;
- Loader composition;
- service ownership.

## Invariants

### DSHPLUG-01 — Factory is a plugin

The deployable Factory surface is a normal DSH/Cordis namespace plugin.

### DSHPLUG-02 — one public service

Factory publishes one primary host service: ctx.factory.

### DSHPLUG-03 — DSH owns harness mechanics

Factory does not implement a parallel Agent loop, Session runtime, model router, tool runtime, or sandbox.

### DSHPLUG-04 — public Agent seam

Factory executes through ctx.agents, never by importing the concrete DSH agent-loop implementation.

### DSHPLUG-05 — graph remains authoritative

FactoryService.snapshot() is always projected from the Event Store.

### DSHPLUG-06 — freshness before and after execution

Work is checked against current Graph Revision before Agent creation and Feature-07 checks revision again after Agent completion.

### DSHPLUG-07 — no prose Evidence

No assistant text is promoted to Evidence without an explicit collector/protocol.

### DSHPLUG-08 — atomic publication

ctx.factory is not published until Event Store initialization succeeds.

### DSHPLUG-09 — DSH isolation

No DSH/Cordis runtime dependency enters core/events/evidence/context/policy/work/execution.

### DSHPLUG-10 — Loader proven

The public plugin boundary has a real Loader/process composition smoke test.

## Acceptance criteria

### AC-001 — package migration

packages/runtime-dsh is removed and packages/plugin-dsh owns the public DSH plugin.

### AC-002 — service rename

The plugin publishes ctx.factory; ctx.dshFactoryRuntime no longer exists.

### AC-003 — service graph

The service exposes graph revision/snapshot, append, prepare, and execution operations.

### AC-004 — persistence selection

No persistence directory uses InMemoryEventStore; a configured directory uses JsonlEventStore.

### AC-005 — execution through DSH

executeWork() reaches the injected public ctx.agents registry.

### AC-006 — lifecycle correctness

The DSH AgentHandle is disposed on success, failure, cancellation, and stale completion.

### AC-007 — Loader composition

A subprocess boots a test cordis.yml with the real Loader, real DSH AgentRegistry, and Factory plugin and completes one Factory Work execution.

### AC-008 — namespace plugin contract

The package exports named name, inject, Config, and apply, with no default plugin export.

### AC-009 — architecture docs

Repository architecture and agent rules describe Factory as a DSH plugin, not a runtime layered above or outside DSH.

### AC-010 — CI

Typecheck, lint, unit tests, and real Loader smoke all pass under the repository's ordinary GitHub Actions validation.

## Implementation scope

Feature-15 includes:

- full architecture specification;
- runtime-dsh -> plugin-dsh package migration;
- ctx.factory service;
- Event Store port;
- memory/JSONL store selection;
- Work preparation/execution service methods;
- migrated DSH adapter/message source;
- Config schema;
- unit tests;
- real Loader/process composition smoke;
- documentation/navigation updates.

## Non-goals

- publishing to npm;
- model-provider configuration;
- replacing DSH agent-loop;
- generic assistant-prose structured extraction;
- UI slot integration into DSH Web;
- automatic Work discovery scheduling;
- cross-process Factory service RPC;
- distributed Event Store.
