# Architecture Overview

## Goal

DSH Factory is a software-development system in which AI workers execute work while intent, policy, evidence, and durable change history remain explicit machine-readable state.

The system is not a chain of ProductAgent -> DevAgent -> QAAgent. Traditional stages are views over a persistent Change Graph.

## Layers

```text
+--------------------------------------------------+
| Harness-neutral Factory                          |
| Change Graph / Context / Evidence / Gates        |
| Policy / Work / Execution / Persistence          |
+--------------------------------------------------+
| Reusable integrations / presentation             |
| GitHub / CI / Release / Observation / Graph UI   |
+--------------------------------------------------+
| Harness adapters                                 |
| plugin-dsh / future plugin-<harness>              |
+--------------------------------------------------+
| Agent Harness                                    |
| Agents / Sessions / Models / Tools / Sandbox     |
+--------------------------------------------------+
```

DeepSeek Harness is the currently supported host through `packages/plugin-dsh`. It is not a dependency of the neutral Factory layers.

## Foundation invariants

1. No durable state transition without evidence or an explicit policy decision.
2. No agent execution without an explicit objective and a task-specific ContextPack.
3. No feedback remains text-only when it can be represented as structured evidence.
4. Change is the durable aggregate; Issue, PR, CI run, Harness session, and deployment are related artifacts/runs.
5. Agent identities are ephemeral execution concerns, not durable domain ownership.
6. Change lifecycle is a graph and may contain feedback cycles.
7. The core domain is independent from any Agent Harness.
8. Harness-specific dependencies belong only in outer adapter packages.

## Dependency direction

Domain/runtime packages point inward. Harness adapters depend on them, never the reverse.

```text
core
 ^  ^  ^  ^
 |  |  |  |
events evidence context work
       \   |   /
        execution
            ^
            |
       plugin-dsh
```

Reusable GitHub/CI/Release/Observation/UI packages also remain Harness-neutral.

## State

A Change does not own a single `status = testing` field. Readable stage labels are projections derived from Gate evaluations, Findings, Runs, and Evidence.

This permits states such as functional verification passed while performance verification is still running and regression verification has failed.
