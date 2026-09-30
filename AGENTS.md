# Orven Agent Collaboration Contract

## Purpose

Orven is a Harness-neutral AI-native SDLC runtime with outer Agent-Harness adapters. DeepSeek Harness is currently supported through `packages/plugin-dsh`; Harness-specific APIs must not leak into the neutral runtime.

## Working rules

1. Start at `Code.md`, then the relevant Architecture/Spec, then source/tests.
2. Change is the durable center; Product/Dev/QA/Release are projections and capabilities.
3. No durable transition without structured Evidence or an explicit policy decision.
4. Context is compiled from graph state, never accumulated chat history.
5. Agents are disposable workers, not durable domain owners.
6. Internal modules stay Harness-neutral.
7. `@orven/core` is the only public neutral API boundary.
8. Harness adapters may consume `@orven/core` only; they may not import `@orven/internal-*`.
9. Supporting another Harness means adding `plugin-<harness>`, not host-specific branches in Core.
10. DSH/Cordis-specific code belongs only in `packages/plugin-dsh`.
11. Public artifacts must pass clean external install validation.
12. CI is GitHub Actions; this repository does not use CNB.
13. Do not claim Green without executing the applicable code, integration, and distribution checks.
14. When required checks are Green, no blocking review/thread exists, the branch is mergeable, and scope is complete, squash-merge automatically.

## Package model

Private workspace modules use `@orven/internal-*` and `private: true`.

Public packages today are only:

```text
@orven/core
@orven/plugin-dsh
```

Public versions begin at `0.1.0`.

## TypeScript baseline

- TypeScript 6, ESM, NodeNext.
- Node `^22.19.0 || >=24.0.0`.
- pnpm 11.
- `tsc -b` validates internal project boundaries.
- tsdown assembles the public Core artifact.

## Completion checklist

- behavior tests updated;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm test`;
- `pnpm distribution:check` for public-boundary changes;
- no Harness-specific dependency in neutral modules/Core;
- no adapter import of `@orven/internal-*`;
- docs/specs updated;
- semantic Conventional Commit message.
