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
| DSH/Cordis integration | `Docs/Architecture/DSH Integration.md` | `packages/runtime-dsh/` |
| Validation | `Docs/Development/Validation.md` | `.github/workflows/ci.yml` |

## Dependency direction

Domain capability packages depend inward on `packages/core`. Outer runtime/integration packages consume them, never the reverse.

## Change routing

- domain schemas -> `packages/core`;
- Evidence validation/applicability/coverage -> `packages/evidence`;
- Context compilation -> `packages/context`;
- Gate assessment/authority policy -> `packages/policy`;
- capability-based Work and local execution plans -> `packages/work`;
- Event vocabulary/projection -> `packages/events`;
- DSH lifecycle -> `packages/runtime-dsh`.
