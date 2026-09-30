# DSH Factory Code Map

Use this as the first navigation surface for humans and agents.

| Area | Source of truth | Implementation |
| --- | --- | --- |
| Top-level architecture | `Docs/Architecture/Overview.md` | repository-wide |
| Domain vocabulary | `Docs/Architecture/Domain Model.md` | `packages/core/` |
| Event sourcing boundary | `Docs/Architecture/Overview.md` | `packages/events/` |
| DSH/Cordis integration | `Docs/Architecture/DSH Integration.md` | `packages/runtime-dsh/` |
| V0.1 foundation contract | `Docs/Specs/V0.1 Foundation.md` | `packages/core/`, `packages/events/`, `packages/runtime-dsh/` |
| Validation | `Docs/Development/Validation.md` | `.github/workflows/ci.yml` |

## Dependency direction

```text
packages/core
    ^
    |
packages/events
    ^
    |
packages/runtime-dsh
```

`core` is pure domain. `events` may depend on `core`. `runtime-dsh` may depend on both. Reverse dependencies are forbidden.

## Change routing

- Change / Evidence / Finding / Gate / Run / ContextPack shape -> `packages/core`.
- Durable event vocabulary and event-stream invariants -> `packages/events`.
- Cordis plugin lifecycle and DSH integration -> `packages/runtime-dsh`.
- Product/Dev/QA stage views -> future presentation packages; do not encode them into core workflow state.
