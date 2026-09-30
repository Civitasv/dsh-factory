# DSH Factory Code Map

Use this as the first navigation surface for humans and agents.

| Area | Source of truth | Implementation |
| --- | --- | --- |
| Change Graph | `Docs/Specs/Feature-02 Change Graph.md` | `packages/core/`, `packages/events/` |
| Evidence Protocol | `Docs/Specs/Feature-03 Evidence Protocol.md` | `packages/evidence/` |
| Context Compilation | `Docs/Specs/Feature-04 Context Compilation.md` | `packages/context/` |
| Gates and Policy | `Docs/Specs/Feature-05 Gates and Policy.md` | `packages/policy/` |
| Work and Capabilities | `Docs/Specs/Feature-06 Work and Capabilities.md` | `packages/work/` |
| Execution Protocol | `Docs/Specs/Feature-07 Execution Protocol.md` | `packages/execution/` |
| DSH execution seam | `Docs/Specs/Feature-08 DSH Runtime Integration.md` | `packages/plugin-dsh/` |
| Persistence | `Docs/Specs/Feature-09 Persistence.md` | `packages/persistence/` |
| GitHub Integration | `Docs/Specs/Feature-10 GitHub Integration.md` | `packages/integration-github/` |
| CI/Test Integration | `Docs/Specs/Feature-11 CI and Test Integration.md` | `packages/integration-ci/` |
| Release & Deployment | `Docs/Specs/Feature-12 Release and Deployment.md` | `packages/release/` |
| Production Observation | `Docs/Specs/Feature-13 Production Observation.md` | `packages/observation/` |
| Graph UI | `Docs/Specs/Feature-14 Graph UI.md` | `packages/graph-ui/` |
| DSH Plugin Runtime | `Docs/Specs/Feature-15 DSH Plugin Runtime.md` | `packages/plugin-dsh/` |

## Runtime boundary

`packages/plugin-dsh` is the Factory composition root inside DSH. Internal Factory packages are libraries; they do not create a parallel harness.

DSH owns Agents, Sessions, models, tools, skills, sandbox/process execution, and Cordis lifecycle. Factory owns SDLC domain semantics and exposes them through `ctx.factory`.
