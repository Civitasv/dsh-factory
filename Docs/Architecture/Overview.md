# Architecture Overview

## Goal

DSH Factory is a software-development runtime in which AI workers execute work while intent, policy, evidence, and durable change history remain explicit machine-readable state.

The system is not a chain of ProductAgent -> DevAgent -> QAAgent. Traditional stages are views over a persistent Change graph.

## Layers

```text
+--------------------------------------------------+
| DSH Factory                                      |
| Change Graph / Context / Evidence / Gates        |
| Policy / Orchestration / Verification            |
+--------------------------------------------------+
| DSH adapter                                      |
| Cordis plugin lifecycle / DSH sessions & tools   |
+--------------------------------------------------+
| DeepSeek Harness                                 |
| Agent loop / model / tool / skill / sandbox      |
+--------------------------------------------------+
```

## Foundation invariants

1. No durable state transition without evidence or an explicit policy decision.
2. No agent execution without an explicit objective and a task-specific ContextPack.
3. No feedback remains text-only when it can be represented as structured evidence.
4. Change is the durable aggregate; Issue, PR, CI run, DSH session, and deployment are related artifacts/runs.
5. Agent identities are ephemeral execution concerns, not durable domain ownership.
6. Change lifecycle is a graph and may contain feedback cycles.
7. The core domain is independent from DeepSeek Harness and Cordis.

## Dependency direction

Domain packages are inward. Integration packages depend on them, never the reverse.

```text
core <- events <- runtime-dsh
```

Future packages such as context, evidence verification, policy, orchestration, GitHub, CI, release, and observation must preserve that direction.

## State

A Change does not own a single `status = testing` field. Readable stage labels are projections derived from Gate evaluations, Findings, Runs, and Evidence.

This permits states such as functional verification passed while performance verification is still running and regression verification has failed.
