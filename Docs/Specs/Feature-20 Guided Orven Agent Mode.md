# Feature-20 — Guided Orven Agent Mode

Status: Implemented
Date: 2026-09-30

## 1. Problem

Feature-19 makes Orven callable from DSH, but the model still has to infer the intended
protocol from four independent tool descriptions. A user should not need to prompt the
agent with "call orven_begin_change, then orven_status..." for Orven to shape the SDLC
loop.

At the same time, copying DSH's `standard` Agent preset into Orven would duplicate a
large, fast-moving Harness-owned composition. That would make Orven responsible for
keeping shell, filesystem, planning, compaction, delegation, Web, permission, and other
DSH rows synchronized with upstream.

## 2. Goals

1. Installing the Orven Bundle makes ordinary DSH coding sessions follow the Orven
   Change loop for non-trivial workspace mutations.
2. DSH remains the owner of Agent presets and ordinary coding capabilities.
3. Orven guidance is visible only in scopes where all required Orven tools are visible.
4. Read-only questions and trivial non-change tasks do not create Changes.
5. Completion claims are grounded in `orven_status` and Artifact-backed Evidence.
6. Delegated Orven workers cannot recursively create/delegate another Orven Change.
7. Deployments can opt out of model guidance while retaining `ctx.orven` and all four
   model-facing tools.

## 3. Non-goals

- No copied/forked DSH `standard` preset.
- No new durable graph node or event kind.
- No automatic semantic promotion of a Run or tool result into Criterion Evidence.
- No forced use of `orven_execute` for every filesystem mutation.
- No Graph UI in this feature.
- No Harness-neutral Core dependency on DSH prompt APIs.
- No second Harness adapter.

## 4. Architecture

```text
DSH preset (owned by DSH)
        │
        ├─ ordinary coding tools
        ├─ Orven global model tools
        └─ system-prompt assembly
                  │
                  ▼
        orven:change-loop section
                  │
       visible only when all Orven
          tools are visible in scope
                  │
                  ▼
        model follows Change loop
```

`@orven/plugin-dsh` injects `ctx.systemPrompt`; no neutral package imports DSH prompt
types.

## 5. Why prompt guidance, not a preset fork

The DSH preset registry intentionally lets each profile own declarative Agent
compositions. Re-declaring the full standard preset in Orven would duplicate upstream
policy and capability choices.

Instead, Orven contributes one external ordered prompt section. DSH continues to own
the selected preset, tool implementations, permission policy, model routing, planning,
compaction, and delegation.

This keeps the dependency direction:

```text
@orven/core
    ↑
@orven/plugin-dsh
    ↑
DSH systemPrompt/tools
```

## 6. Configuration

Add:

```ts
type OrvenOrchestrationMode = 'manual' | 'guided'
```

Plugin config:

```yaml
graphId: orven
orchestration: guided
```

The shipped Orven Bundle explicitly selects `guided`.

`manual` means:
- publish `ctx.orven`;
- register the four Orven model tools;
- record tool-result Artifacts as in Feature-19;
- do not add model orchestration guidance.

## 7. Guided policy

The model-facing section is named:

```text
orven:change-loop
```

and uses external order `8800`, after ordinary tool guidance and before late
deliverable/structured-output/environment sections.

The guidance establishes these rules:

1. For a non-trivial workspace mutation, begin/continue a durable Change before the
   first mutation.
2. Criteria must be observable acceptance statements.
3. Use `orven_status` to inspect current Criteria, Evidence coverage, Gate state, and
   Artifact ids.
4. Prefer `orven_execute` for one concrete implementation/verification objective at a
   time, but direct DSH tools remain valid and still generate Artifacts.
5. `orven_record_evidence` may cite only recorded Artifact ids.
6. Assistant prose, intent, and Run success are never Evidence by themselves.
7. Re-check `orven_status` before reporting completion.
8. If required Criteria remain pending/contradicted/conflicted, report that state rather
   than claiming completion.
9. Read-only questions and trivial non-change tasks should bypass the Change loop.

## 8. Scope awareness

Prompt guidance is dynamic.

For the current Agent scope, it renders only when all four tools resolve:

- `orven_begin_change`
- `orven_status`
- `orven_execute`
- `orven_record_evidence`

If a preset/tool filter hides any required capability, the section renders as an empty
string. This prevents the prompt from instructing an Agent to use unavailable tools.

## 9. Delegated-worker recursion boundary

`orven_execute` creates deterministic DSH worker Session ids:

```text
orven:exec:...
```

Those sessions are execution workers, not coordinators. They receive the prepared
ContextPack and Work objective and must execute them directly.

Feature-20 adds a hard runtime guard:
- `orven_begin_change` rejects delegated Orven workers;
- `orven_execute` rejects delegated Orven workers.

This is defense in depth. The prompt also explains the rule, but correctness does not
depend on model compliance.

`orven_status` and Evidence paths keep their existing Feature-19 authority checks.

## 10. Lifecycle

Normal root Agent:

```text
user mutation request
  → orven_begin_change
  → inspect/status
  → orven_execute and/or direct tools
  → exact tool-result Artifacts
  → orven_record_evidence
  → orven_status
  → report Gate state
```

Delegated worker:

```text
ContextPack + objective
  → ordinary DSH tools
  → captured Artifacts
  → return terminal outcome
```

No recursive Orven coordinator is created.

## 11. HMR behavior

The guidance section is registered through the ordinary Cordis plugin context and the
DSH system-prompt registry. Plugin unload/HMR removes the registration with the plugin
scope, matching DSH's normal lifecycle.

No additional persistent state is introduced by Feature-20.

## 12. Security / trust

- Orven does not bypass DSH permission/sandbox policy.
- Guidance cannot mutate the Event Log directly.
- Raw `ctx.orven.append` remains host-only.
- Evidence still requires recorded Artifact sources.
- Tool visibility is respected per Agent scope.
- Recursive execution is rejected in code, not merely discouraged in prose.

## 13. Tests

Required:

1. plugin contract injects `systemPrompt`;
2. guided mode registers exactly one `orven:change-loop` section;
3. manual mode registers no guidance section;
4. guidance renders when all four tools are visible;
5. guidance renders empty when any required tool is hidden;
6. delegated worker cannot call `orven_begin_change`;
7. real Loader composition still mounts `ctx.orven`;
8. typecheck/lint/unit tests remain Green;
9. clean distribution verification remains Green.

## 14. Acceptance

With the Orven DSH profile running, a user should be able to ask:

```text
Add cache hit percentage to this project.
```

without mentioning Orven.

The model should be given enough policy to naturally produce a trace shaped like:

```text
orven_begin_change
orven_status
orven_execute / ordinary DSH tools
orven_record_evidence
orven_status
```

and should not report the change complete while required Criteria remain uncovered.

Setting:

```yaml
orchestration: manual
```

must restore the Feature-19 behavior: tools remain available, but Orven adds no model
workflow policy.
