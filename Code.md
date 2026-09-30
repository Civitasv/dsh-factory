# DSH Factory Code Map

Use this as the first navigation surface for humans and agents.

| Area | Source of truth | Implementation |
| --- | --- | --- |
| Architecture | `Docs/Architecture/Overview.md` | repository-wide |
| Harness boundary | `Docs/Architecture/Harness Integration.md` | neutral packages + harness adapters |
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
| Distribution / portability | `Docs/Specs/Feature-16 Plugin Distribution and Harness Portability.md` | package manifests, `scripts/verify-distribution.mjs` |

## Dependency boundary

Harness-neutral packages never import Harness-specific APIs.

`packages/plugin-dsh` is the current outer adapter. A future Harness should receive a parallel adapter package rather than modifications to the neutral core.
