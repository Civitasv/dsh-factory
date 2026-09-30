# DSH Factory Code Map

Use this as the first navigation surface for humans and agents.

| Area | Source of truth | Implementation |
| --- | --- | --- |
| Top-level architecture | `Docs/Architecture/Overview.md` | repository-wide |
| Domain vocabulary | `Docs/Architecture/Domain Model.md` | `packages/core/` |
| Change Graph | `Docs/Specs/Feature-02 Change Graph.md` | `packages/core/`, `packages/events/` |
| Evidence Protocol | `Docs/Specs/Feature-03 Evidence Protocol.md` | `packages/core/`, `packages/evidence/`, `packages/events/` |
| Context Compilation | `Docs/Specs/Feature-04 Context Compilation.md` | `packages/core/`, `packages/context/` |
| Event sourcing boundary | `Docs/Architecture/Overview.md` | `packages/events/` |
| DSH/Cordis integration | `Docs/Architecture/DSH Integration.md` | `packages/runtime-dsh/` |
| Repository foundation | `Docs/Specs/Feature-01 Repository Foundation.md` | `packages/core/`, `packages/events/`, `packages/runtime-dsh/` |
| Validation | `Docs/Development/Validation.md` | `.github/workflows/ci.yml` |

## Dependency direction

```text
                  packages/core
                ^      ^      ^
                |      |      |
          events   evidence   context
                \      |      /
                 integration/runtime
```

Domain capability packages depend inward on `core`. Runtime/integration packages depend on domain capabilities, never the reverse.

## Change routing

- Change / Criterion / Evidence / Finding / Gate / Run / Relation schemas -> `packages/core`.
- Change Graph relation invariants -> `packages/core`.
- Evidence kind validation, applicability and coverage -> `packages/evidence`.
- deterministic GraphSlice/ContextPack compilation -> `packages/context`.
- Event vocabulary, optimistic concurrency and graph projection -> `packages/events`.
- Cordis plugin lifecycle and DSH integration -> `packages/runtime-dsh`.
