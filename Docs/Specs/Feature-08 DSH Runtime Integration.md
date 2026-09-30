# Feature-08 DSH Runtime Integration

> Public packaging note: Feature-15 DSH Plugin Runtime supersedes the `runtime-dsh` package and `ctx.dshFactoryRuntime` service names. The execution lifecycle and public `ctx.agents` seam specified here remain authoritative implementation semantics inside `packages/plugin-dsh`.

## Objective

Implement Feature-07's runtime-neutral Execution Protocol on top of DeepSeek Harness without moving Factory domain ownership into DSH.

The integration uses DSH's public live-agent seam: `ctx.agents.create()`, `AgentHandle`, `agent.inject()`, `agent.followup()`, `agent.whenIdle()`, and `agent.cancel()`. It must not depend on `@deepseek-ai/dsh-agent-loop`.

## Architecture boundary

~~~text
Factory Work / ContextPack / Execution Protocol
                    |
                    v
             runtime-dsh adapter
                    |
                    v
              DSH ctx.agents
                    |
                    v
       Agent / Session / Models / Tools
~~~

DSH owns live execution mechanics. Factory owns Work identity, Graph Revision, ContextPack, Run/domain semantics, and Evidence trust.

## Lifecycle

For one Prepared Execution:

1. derive deterministic Session id from Execution id;
2. create an Agent through `ctx.agents.create()`;
3. inject canonical ContextPack JSON as DSH model-facing snapshot context;
4. follow up with the exact Work objective, waking the agent;
5. await `agent.whenIdle()`;
6. collect a typed Feature-07 WorkerOutcome through a `DshOutcomeCollector`;
7. obtain current Factory Graph Revision;
8. pass the outcome through Feature-07 freshness acceptance;
9. dispose the owned AgentHandle in `finally`.

## Context injection

Factory registers a DSH message-source kind:

~~~text
kind: dsh-factory
form: snapshot
~~~

The injected snapshot has a named `Factory ContextPack` section containing Feature-04 canonical ContextPack JSON.

Context is injected before the waking Work objective.

## Session identity

Session identity is deterministic:

~~~text
dsh-factory:<execution-id>
~~~

Retries use distinct Execution ids and therefore distinct DSH Sessions. Session identity is execution provenance, not Change state.

## Cancellation

The adapter accepts an optional AbortSignal.

- already-aborted input fails before allocating an Agent;
- while live, abort calls `agent.cancel({ kind: 'parent' })`;
- the adapter still drains with `whenIdle()` and disposes the handle;
- cancellation creates no synthetic Evidence.

## Outcome Collector

DSH's Session can contain arbitrary assistant/tool history, while Factory requires typed Artifacts, Evidence, Findings, Decisions, and terminal status.

Feature-08 defines a `DshOutcomeCollector` seam. It receives the idle DSH Agent plus Prepared Execution and returns Feature-07 `WorkerOutcome`.

The adapter never converts arbitrary assistant prose directly into trusted Evidence.

## Freshness

After DSH reaches idle, the adapter obtains the current Factory Graph Revision from an injected resolver and delegates acceptance to Feature-07. A moved revision returns `stale`; DSH completion cannot bypass this check.

## Clock

The adapter receives a clock function and supplies start/end timestamps to Feature-07. Runtime-neutral packages continue to read no global clock.

## Cordis plugin

`runtime-dsh` remains a namespace plugin:

~~~text
name = dsh-factory
inject = ['agents']
~~~

It publishes `ctx.dshFactoryRuntime`. The service owns no Change state.

## Version boundary

Feature-08 targets the current public DSH package family `0.2.0-rc.2` and Cordis `4.0.4`. These dependencies remain entirely in `runtime-dsh`.

## Invariants

- **DSH-01 Public seam only** — no `dsh-agent-loop` dependency.
- **DSH-02 Disposable agent** — every created handle is disposed.
- **DSH-03 Context before objective** — injection precedes waking follow-up.
- **DSH-04 Exact context** — injection uses the exact Prepared ContextPack.
- **DSH-05 No prose Evidence** — arbitrary assistant text is never Evidence.
- **DSH-06 Collector seam** — structured output enters through an explicit collector.
- **DSH-07 Freshness preserved** — Feature-07 second-revision check always runs.
- **DSH-08 Cancellation propagation** — abort reaches the live Agent.
- **DSH-09 Deterministic Session identity** — one Execution id maps to one Session id.
- **DSH-10 Domain independence** — DSH imports stay in `runtime-dsh`.

## Acceptance criteria

- one execution creates, drives, drains, and disposes exactly one AgentHandle;
- fake-agent tests observe context injection before Work follow-up;
- Session id is deterministic;
- collector output flows through Feature-07 acceptance;
- changed Graph Revision yields stale;
- abort calls Agent cancellation and disposal still occurs;
- plugin injects `agents` and exposes `dshFactoryRuntime`;
- package contains no `dsh-agent-loop` dependency.

## Implementation scope

Feature-08 includes the DSH adapter, message-source augmentation, deterministic Session mapping, cancellation propagation, Outcome Collector seam, Cordis service registration, and fake-port tests.

## Non-goals

Generic model structured-output schemas, trusted Evidence extraction from free-form assistant text, persistence, GitHub/CI/release adapters, worker scheduling, and UI.
