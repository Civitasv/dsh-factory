# Orven Architecture Overview

## Goal

Orven is a Harness-neutral AI-native software-development runtime. AI workers execute tasks while intent, policy, evidence, and durable Change history remain explicit machine-readable state.

## Layers

```text
+--------------------------------------------------+
| Private neutral modules                          |
| Domain / Events / Evidence / Context / Policy    |
| Work / Execution / Persistence / Integrations    |
+--------------------------------------------------+
| Public neutral API: @orven/core                  |
+--------------------------------------------------+
| Harness adapters: @orven/plugin-*                |
+--------------------------------------------------+
| Agent Harness: DSH / future hosts                |
+--------------------------------------------------+
```

## Invariants

1. Change is the durable center.
2. No durable transition without Evidence or explicit policy.
3. Context is task-specific and compiled from graph state.
4. Global lifecycle may contain cycles; one execution plan is a DAG.
5. Agent identity is runtime provenance, not domain ownership.
6. Private neutral modules and `@orven/core` are independent of Agent-Harness SDKs.
7. Harness-specific behavior belongs in outer adapter packages.
8. Adapters consume the public Core contract rather than private modules.

## State

Readable lifecycle/stage labels are projections from Gates, Findings, Runs, Evidence, and relations; Change does not own one mutable workflow-stage field.
