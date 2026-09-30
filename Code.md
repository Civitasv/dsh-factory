# DSH Factory Code Map

Use this as the first navigation surface for humans and agents.

| Area | Source of truth | Implementation |
| --- | --- | --- |
| Top-level architecture | `Docs/Architecture/Overview.md` | repository-wide |
| Domain vocabulary | `Docs/Architecture/Domain Model.md` | `packages/core/` |
| Change Graph | `Docs/Specs/Feature-02 Change Graph.md` | `packages/core/`, `packages/events/` |
| Evidence Protocol | `Docs/Specs/Feature-03 Evidence Protocol.md` | `packages/evidence/` |
| Context Compilation | `Docs/Specs/Feature-04 Context Compilation.md` | `packages/context/` |
| Gates and Policy | `Docs/Specs/Feature-05 Gates and Policy.md` | `packages/policy/` |
| Work and Capabilities | `Docs/Specs/Feature-06 Work and Capabilities.md` | `packages/work/` |
| Execution Protocol | `Docs/Specs/Feature-07 Execution Protocol.md` | `packages/execution/` |
| DSH/Cordis integration | `Docs/Architecture/DSH Integration.md` | `packages/runtime-dsh/` |
| Validation | `Docs/Development/Validation.md` | `.github/workflows/ci.yml` |

## Change routing

- domain schemas -> `packages/core`;
- Evidence -> `packages/evidence`;
- Context -> `packages/context`;
- Gates/Policy -> `packages/policy`;
- Work/capabilities -> `packages/work`;
- runtime-neutral execution transaction -> `packages/execution`;
- Event Log/projection -> `packages/events`;
- DSH lifecycle -> `packages/runtime-dsh`.
