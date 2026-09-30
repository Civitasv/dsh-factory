# Orven Code Map

| Area | Contract | Implementation |
| --- | --- | --- |
| Public neutral API | Feature-17 | `packages/core/` → `@orven/core` |
| Domain model | Feature-02 | `packages/domain/` |
| Event sourcing | Feature-02 | `packages/events/` |
| Evidence | Feature-03 | `packages/evidence/` |
| Context compilation | Feature-04 | `packages/context/` |
| Gates / Policy | Feature-05 | `packages/policy/` |
| Work | Feature-06 | `packages/work/` |
| Execution | Feature-07 | `packages/execution/` |
| Persistence | Feature-09 | `packages/persistence/` |
| GitHub / CI | Features 10–11 | `packages/integration-*/` |
| Release / Observation | Features 12–13 | `packages/release/`, `packages/observation/` |
| Graph UI | Feature-14 | `packages/graph-ui/` |
| DSH adapter / Change loop | Features 15,17,19–20 | `packages/plugin-dsh/` |
| Distribution | Feature-17 | `scripts/verify-distribution.mjs` |

## Dependency direction

```text
@orven/internal-domain
        ↑
private neutral modules
        ↑
   @orven/core
        ↑
@orven/plugin-dsh
        ↑
       DSH
```

A future Harness gets a parallel `@orven/plugin-*` package.
