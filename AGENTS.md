# DSH Factory Agent Collaboration Contract

## Purpose

DSH Factory is an AI-native SDLC system with a harness-neutral domain/runtime and outer Agent-Harness adapters. DeepSeek Harness is the currently supported host through `packages/plugin-dsh`; it is not allowed to leak into the neutral Factory layers. Changes must preserve a small domain core, reproducible evidence, strict dependency direction, and repository structure that agents can navigate without loading the whole tree.

## Working rules

1. **Navigate by intent.** Start at `Code.md`, then the relevant Architecture/Spec document, then source and tests.
2. **TDD for behavior.** Add or update a failing behavior test before changing runtime behavior when the test can be executed.
3. **Change is the center.** Product, Development, QA, Performance, and Release are projections/capabilities, not first-class workflow owners.
4. **No text-only completion claims.** A durable state transition requires structured evidence or an explicit policy decision.
5. **One mutable fact, one owner.** Do not duplicate Change state, Gate state, Run state, or Harness session truth for UI convenience.
6. **Keep the Factory runtime Harness-neutral.** `core`, `events`, `evidence`, `context`, `policy`, `work`, `execution`, `persistence`, reusable integrations, and Graph UI must not import Harness-specific APIs.
7. **Harness adapters are outer layers.** DeepSeek Harness/Cordis-specific runtime code belongs under `packages/plugin-dsh`. A future Harness gets a parallel adapter instead of changes to the neutral core.
8. **Do not rebuild the Harness.** Factory adapters use public host Agent/session/model/tool/sandbox seams rather than implementing parallel Harness mechanics.
9. **Agents are workers, not domain entities.** Persist Runs, Events, Artifacts, Evidence, Findings, and Decisions; do not model long-lived ProductAgent/DevAgent/QAAgent identities as architecture.
10. **Context is compiled, not accumulated chat.** ContextPack generation selects the minimal sufficient graph neighborhood with provenance.
11. **Prefer immutable values and explicit discriminated unions.** Avoid ambient global state and hidden lifecycle ownership.
12. **GitHub is source truth.** CI is GitHub Actions. This repository does not use CNB.
13. **Do not claim Green without execution.** If tests, packaging, or integration checks cannot run, report them as pending.
14. **Merge Green PRs automatically.** When a PR's required GitHub Actions checks pass, it has no unresolved blocking review threads, its base is mergeable, and the intended scope is complete, squash-merge it without waiting for additional human confirmation. Do not merge on failed/pending CI, merge conflicts, blocking review feedback, or unresolved semantic ambiguity.

## TypeScript baseline

- TypeScript 6, ESM, NodeNext resolution.
- Node.js `^22.19.0 || >=24.0.0`.
- pnpm 11.
- Strict compiler options stay enabled.
- Public domain data is readonly by default.
- Harness adapters may depend inward on neutral Factory packages. Neutral packages never depend outward on adapters.
- DSH/Cordis integration uses the ordinary namespace-plugin shape (`name`, optional `inject`, `Config`, `apply`).

## Distribution baseline

- Public Factory packages use synchronized versioning until the contracts stabilize.
- Users install a Harness adapter package; transitive neutral Factory packages resolve automatically.
- Public packages ship compiled artifacts, not TypeScript source or tests.
- No public package requires install-time build scripts.
- Actual packed artifacts must pass `pnpm distribution:check`.
- Only Harness adapter packages may declare Harness-specific dependencies or bundle metadata.

## Git conventions

Commit messages use semantic Conventional Commits:

```text
<type>(<optional-scope>): <imperative semantic description>
```

Allowed baseline types:

- `feat` — user- or system-visible capability;
- `fix` — behavior defect correction;
- `refactor` — structural change without intended behavior change;
- `test` — test-only change;
- `docs` — documentation-only change;
- `ci` — GitHub Actions or CI policy;
- `build` — build, package, or dependency wiring;
- `chore` — repository maintenance that fits no more specific type.

Use the narrowest meaningful scope when it adds information. Do not use vague subjects such as `update files`, `misc changes`, `changes`, or version-only messages.

## Documentation ownership

- `Docs/Architecture/` — current invariants, ownership, dependency direction, protocol boundaries.
- `Docs/Specs/` — semantic feature contracts named `Feature-XX <Semantic Name>.md`, with acceptance criteria and explicit non-goals.
- `Docs/Development/` — contributor and validation workflow.
- `Code.md` — navigation map from concepts to source.
- `State.md` — compact current snapshot, not a chronological diary.

## Completion checklist

For implementation changes, verify applicable items:

- behavior test added or updated;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm test`;
- `pnpm distribution:check` for publishable package changes;
- architecture/spec docs updated for boundary changes;
- no Harness-specific import leaked into neutral packages;
- the diff contains only the intended change;
- the commit message follows the semantic convention.
