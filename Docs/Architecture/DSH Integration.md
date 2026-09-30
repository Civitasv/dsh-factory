# DSH Plugin Integration

## Runtime model

DeepSeek Harness is the harness and runtime host.

DSH Factory is an SDLC plugin that runs inside the same Cordis service graph.

```text
DeepSeek Harness
|
+-- agents / agent-loop
+-- sessions
+-- models
+-- tools / skills
+-- sandbox
+-- host services
|
+-- @dsh-factory/plugin-dsh
      |
      +-- ctx.factory
      +-- Factory domain libraries
```

Factory is not a second harness layered above DSH.

## Public package

The deployable Factory host package is `@dsh-factory/plugin-dsh`.

It is a namespace plugin with named `name`, `inject`, `Config`, and `apply` exports and no default `apply` export.

The plugin declares the public DSH `agents` dependency and publishes one primary Factory service: `ctx.factory`.

## Ownership

DeepSeek Harness owns model invocation/routing, Agent and Agent-loop lifecycle, Session mechanics, tools and skills, sandbox/process capabilities, Cordis lifecycle, and DSH host/client infrastructure.

DSH Factory owns Change Graph semantics, ContextPack construction, Evidence/Findings, Gates/Policy, Work and SDLC execution acceptance, Factory Event Log persistence, GitHub/CI/Release/Observation semantics, and Factory graph presentation.

A DSH Session is execution provenance. It is never the source of truth for Change state.

## Service boundary

Factory consumers inside DSH use `ctx.factory`.

The initial service supports current Graph Revision and Change sequence, deterministic graph projection, semantic Event append, Work preparation against the current snapshot, execution through `ctx.agents`, and prepare-and-execute convenience.

The service does not cache a second graph state.

## Execution

```text
ctx.factory.executeWork()
        |
        v
ctx.agents.create()
        |
        v
Agent.inject(ContextPack)
        |
        v
Agent.followup(Work objective)
        |
        v
DSH model/tools/skills/sandbox
        |
        v
DshOutcomeCollector
        |
        v
Feature-07 freshness acceptance
```

Factory never imports the concrete DSH agent-loop implementation. A production DSH composition normally supplies the AgentFactory through agent-loop. Tests may register a deterministic AgentFactory through the same public AgentRegistry contract.

## Persistence

Without a `persistenceDirectory` plugin configuration, `ctx.factory` owns an `InMemoryEventStore`.

With `persistenceDirectory` configured, plugin activation opens the Feature-09 `JsonlEventStore` before `ctx.factory` is published.

Failure to open/replay the Event Log fails plugin activation rather than publishing a half-ready service.

## Trust boundary

Agent prose and arbitrary Session history are not Evidence.

Typed `WorkerOutcome` enters through the explicit `DshOutcomeCollector` seam. A future standard collector may define a structured output protocol, but it must retain the Evidence rules from Feature-03.

## Composition proof

Feature-15 requires a real Loader/process smoke using a test `cordis.yml`.

The smoke mounts the actual DSH AgentRegistry and actual Factory plugin. Only the AgentFactory/model-driver side is replaced with a deterministic keyless test implementation.

This proves the plugin is loadable and executable inside the DSH service graph without relying only on hand-built adapter mocks.

## Version baseline

Feature-15 targets `@deepseek-ai/cordis` 4.0.4, DSH public packages 0.2.0-rc.2, and the current public Cordis Loader/Include packages used by this repository.

These dependencies remain isolated to `packages/plugin-dsh`.
