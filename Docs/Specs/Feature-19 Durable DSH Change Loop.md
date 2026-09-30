# Feature-19 — Durable DSH Change Loop

Status: Implemented
Date: 2026-09-30

## 1. Problem

`@orven/plugin-dsh` can be installed and activated as a DSH Bundle, and it exposes
`ctx.orven`, but an ordinary DSH Agent still has no model-facing Orven workflow.

The current adapter also defaults to an in-memory Event Store unless
`persistenceDirectory` is explicitly configured. A normal Web session therefore
cannot create a durable Change, bind that Change to its Session, collect exact tool
observations, evaluate criterion coverage, or delegate Work through Orven.

The next vertical slice must make Orven useful without turning the Event Log into a
model-writable CRUD surface.

## 2. Goals

This feature establishes one complete DSH-to-Orven loop:

1. A DSH Session can begin an Orven Change with explicit Criteria.
2. The Session durably remembers its active Change.
3. The Change Graph persists by default in the Session workspace under `.orven/`.
4. DSH tool outcomes are captured as immutable Artifact sources while a Change is active.
5. The Agent can attach Artifact-backed Evidence to a Criterion revision.
6. `orven_status` reports criterion coverage against the current workspace reality.
7. `orven_execute` materializes Work, delegates it through the existing DSH execution
   adapter, records the Run, and records the delegated worker's exact tool outcomes as
   Artifacts.
8. No model-facing tool exposes raw Event append.

## 3. Non-goals

- No Graph UI in this feature.
- No automatic semantic claim that an arbitrary tool result proves a Criterion.
- No automatic merge, PR, release, or deployment action.
- No replacement for DSH's normal filesystem/bash/tool policy.
- No second Harness adapter.
- No new durable graph node kind.
- No conversion of assistant prose into Evidence.

## 4. Architecture

```text
DSH Session
   │
   ├─ orven_begin_change ───────────────┐
   ├─ orven_status                     │
   ├─ orven_record_evidence            │
   └─ orven_execute                    │
                                       ▼
                              @orven/plugin-dsh
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
             Session binding                       Workspace runtime
          (DSH session event +                 cwd -> .orven Event Store
          host-side projection)                       │
                    │                                 ▼
                    └──────────────────────►     ctx.orven.forWorkspace()
                                                      │
                                                      ▼
                                                @orven/core
```

The Event Log remains authoritative. Session binding is DSH-owned state and does not
become a ninth Change Graph node.

## 5. Workspace persistence

### 5.1 Default

When a model-facing Orven tool runs from a Session whose header has `cwd`, the plugin
opens:

```text
<cwd>/.orven/
  graph.json
  events.jsonl
```

The same workspace path reuses one process-local `OrvenService` instance.

### 5.2 Explicit persistenceDirectory

Existing `persistenceDirectory` configuration remains supported. When configured, it
is the explicit persistence target and all workspace requests resolve to that service.

### 5.3 Repository noise

The plugin creates `.orven/.gitignore` with `*` for workspace-local persistence.
Workspace-reality fingerprinting also excludes `.orven/**`.

## 6. Session -> active Change

The plugin owns one DSH Session event:

```text
orven/active-change
```

Payload:

```ts
{
  changeId: string | null
  workspace: string | null
}
```

A host-only Session Projection folds the latest whole value. This gives restart-safe
binding without synchronous Session-log scans.

`orven_begin_change` writes the graph facts first and only then appends the Session
binding event, so a Session never points at a Change that failed to persist.

## 7. Model-facing tools

### 7.1 orven_begin_change

Input:
- `title`
- optional `kind`
- `criteria[]`: statement + optional severity

Effects:
- create one Change
- create one Criterion per item
- publish CriterionRevision 1
- create `change -> criterion` relations
- create one Gate and `gate -> criterion` evaluation relations
- bind the calling Session to the Change

Every initial Criterion revision requires one applicable
`factory/runtime-observation@1` Evidence item. This is intentionally a generic first
slice; richer criterion-specific requirement authoring comes later.

### 7.2 orven_status

Read-only with respect to the Change Graph.

Returns:
- active Change identity/title/kind
- graph revision
- Criteria and latest revisions
- requirement coverage states
- required-criterion completion counts
- derived Gate state: `pending | satisfied | failed`
- recently captured DSH tool-result Artifact ids
- current workspace-reality provider

Status evaluates coverage against a newly captured current workspace reality but does
not persist a Gate evaluation merely because it was read.

### 7.3 orven_record_evidence

Input:
- `criterionId`
- `artifactIds[]`
- `claim`
- `result: supports | contradicts | inconclusive`

Rules:
- Criterion must belong to the active Change.
- Each source Artifact must already exist.
- Current workspace reality is captured and recorded as an Artifact if needed.
- Evidence kind is `factory/runtime-observation@1`.
- Evidence subjects the exact latest Criterion revision.
- Evidence sources are the exact referenced Artifact records.
- The model supplies a claim, but Evidence validity comes from Artifact-backed sources;
  assistant prose by itself is never accepted.

### 7.4 orven_execute

Input:
- `objective`

Flow:
1. derive deterministic Work from the current Graph revision;
2. prepare execution through Core;
3. bind the deterministic DSH worker Session id to an execution capture buffer;
4. execute a fresh DSH worker in the same workspace and with the caller as live parent;
5. buffer worker tool results while execution is in-flight so the Graph revision does
   not change before stale-result validation;
6. after acceptance, append Run + captured Artifact nodes + `attempts`/`produces`
   relations in one graph write;
7. return Run id/state/captured Artifact ids.

The tool does not auto-create supporting Evidence. The caller must make the semantic
criterion-to-source assertion through `orven_record_evidence`.

## 8. Exact tool-result capture

The plugin observes DSH `tools/result`.

For an ordinary Session with an active Change:
- every non-`orven_*` result is recorded immediately as a `dsh-tool-result` Artifact.

For an Orven delegated worker:
- results are buffered under its deterministic worker Session id;
- they are appended only after Core accepts the execution result.

Each Artifact metadata records:
- tool name
- tool call id
- canonical arguments
- success canonical value, or normalized failure message

This preserves raw observation facts without promoting them to Evidence.

## 9. Workspace reality

Evidence with `reality: current` needs an exact current target identity.

The first provider is `git-working-tree-v1`:
- HEAD
- unstaged diff
- staged diff
- porcelain status
- `.orven/**` excluded

These bytes are SHA-256 hashed into a deterministic workspace-reality Artifact id.

If Git reality cannot be obtained, the fallback is `path-only-v1`; status reports the
provider so consumers can see the weaker reality model.

## 10. Service surface

Existing `ctx.orven` methods remain intact.

Add:

```ts
ctx.orven.forWorkspace(cwd): Promise<OrvenService>
```

This keeps Feature-18's service identity and low-level API compatibility while giving
the DSH adapter a workspace-local durable runtime.

## 11. DSH dependencies

`@orven/plugin-dsh` additionally consumes:
- `ctx.tools`
- `ctx.sessionProjections`

The Bundle therefore injects:
- agents
- tools
- sessionProjections

Peer/dev dependencies are updated accordingly. `zod` is an ordinary dependency for
the host-only Session Projection state schema.

## 12. Concurrency

Change-owned writes always use optimistic sequence checks. Model-command/capture code
retries only a genuine `ConcurrencyConflictError`; other failures propagate.

Delegated tool results are buffered until execution acceptance specifically to preserve
the stale-work invariant.

## 13. Security / authority

- Orven tools do not bypass DSH sandbox/approval.
- `orven_execute` delegates to an ordinary DSH Agent using the existing Harness.
- No raw `append` model tool exists.
- Evidence source ids must resolve to recorded Artifacts.
- `orven_record_evidence` cannot target a Criterion outside the active Change.
- Existing DSH tool policy remains authoritative for the worker.

## 14. Failure behavior

- Missing Agent owner -> tool fails.
- Missing Session cwd with workspace-default persistence -> tool fails with a concrete
  message.
- No active Change -> status/evidence/execute fail and instruct the model to begin one.
- Stale delegated execution -> no Run/Artifact graph append; returned state is `stale`.
- Tool-result capture failure does not mutate Evidence and is logged by the DSH observer
  containment boundary.
- Corrupt or incompatible `.orven` persistence fails loudly.

## 15. Tests

Required tests:
1. workspace `forWorkspace` service persists and reopens graph state;
2. begin Change produces Change/Criteria/Gate relations and Session binding;
3. status reports missing -> satisfied after Artifact-backed Evidence;
4. evidence rejects an Artifact that does not exist;
5. ordinary DSH tool result is captured for an active Change;
6. delegated execution buffers observations, then records Run and produced Artifacts;
7. delegated execution remains stale-safe;
8. plugin contract injects agents/tools/sessionProjections;
9. existing low-level OrvenService tests remain valid;
10. real DSH Loader composition and distribution verification remain Green.

## 16. Acceptance demo

In DSH Web, from a workspace-backed Session:

```text
User: Add a simple feature to this repository.

Agent -> orven_begin_change(...)
Agent -> orven_status()
Agent -> orven_execute(...)
Agent -> orven_record_evidence(...)
Agent -> orven_status()
```

The final status must be able to report a durable Change, exact criteria, Run(s),
Artifact-backed Evidence coverage, and a derived Gate state. Restarting DSH must retain
the workspace Change Graph and Session active-Change binding.
