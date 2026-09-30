# DSH Factory Agent Collaboration Contract

## Purpose

DSH Factory is an AI-native software-development runtime layered on DeepSeek Harness. Changes must preserve a small domain core, reproducible evidence, and repository structure that agents can navigate without loading the whole tree.

## Working rules

1. **Navigate by intent.** Start at `Code.md`, then the relevant Architecture/Spec document, then source and tests.
2. **TDD for behavior.** Add or update a failing behavior test before changing runtime behavior when the test can be executed.
3. **Change is the center.** Product, Development, QA, Performance, and Release are projections/capabilities, not first-class workflow owners.
4. **No text-only completion claims.** A durable state transition requires structured evidence or an explicit policy decision.
5. **One mutable fact, one owner.** Do not duplicate Change state, Gate state, Run state, or DSH session truth for UI convenience.
6. **Keep the domain independent from DSH.** `packages/core` and `packages/events` must not import Cordis or DSH packages.
7. **DSH is an adapter boundary.** Cordis/DSH-specific code belongs under `packages/runtime-dsh` or future integration packages.
8. **Agents are workers, not domain entities.** Persist Runs, Events, Artifacts, Evidence, Findings, and Decisions; do not model long-lived ProductAgent/DevAgent/QAAgent identities as architecture.
9. **Context is compiled, not accumulated chat.** Future ContextPack generation must select the minimal sufficient graph neighborhood with provenance.
10. **Prefer immutable values and explicit discriminated unions.** Avoid ambient global state and hidden lifecycle ownership.
11. **GitHub is source truth.** CI is GitHub Actions. This repository does not use CNB.
12. **Do not claim Green without execution.** If tests or integration checks cannot run, report them as pending.

## TypeScript baseline

- TypeScript 6, ESM, NodeNext resolution.
- Node.js `^22.19.0 || >=24.0.0`, aligned with the current DSH repository baseline.
- pnpm 11.
- Strict compiler options stay enabled.
- Public domain data is readonly by default.
- DSH/Cordis integration uses the ordinary namespace-plugin shape (`name`, optional `inject`, `apply`).
- Runtime packages may depend inward on domain packages. Domain packages never depend outward on runtime packages.

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

Examples:

```text
feat(core): add change graph relation types
fix(events): reject duplicate change event sequences
docs: adopt semantic feature spec naming
ci: validate pull requests with GitHub Actions
```

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
- architecture/spec docs updated for boundary changes;
- no DSH/Cordis import leaked into `core` or `events`;
- the diff contains only the intended change;
- the commit message follows the semantic convention.
