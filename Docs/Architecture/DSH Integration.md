# DSH Integration

## Technology boundary

DeepSeek Harness plugins run in the JavaScript/Node/Cordis ecosystem. The upstream repository authors first-party packages in TypeScript and emits JavaScript. DSH's own package cookbook describes plugin entry points as TypeScript `src/index.ts` files with the namespace-plugin shape.

DSH Factory therefore uses TypeScript for all first-party packages.

This is a source-language choice, not a claim that the runtime can execute TypeScript only. The runtime ultimately loads JavaScript modules; TypeScript is the supported authoring baseline for this repository.

## Upstream baseline

At repository bootstrap, upstream DeepSeek Harness uses:

- DSH `0.2.0-rc.2`;
- pnpm `11.7.0`;
- Node `^22.19.0 || >=24.0.0`;
- TypeScript 6;
- `@deepseek-ai/cordis` `4.0.4`.

These versions are integration inputs, not domain contracts. DSH is still evolving, so its types must remain outside the core domain packages.

## Plugin shape

The initial adapter exposes the conventional Cordis namespace-plugin entry:

```ts
export const name = 'dsh-factory'

export function apply(ctx: Context): void {
  // Register DSH-facing capabilities here.
}
```

Do not default-export `apply` merely for convenience; upstream DSH treats plugin metadata such as `inject` as part of the namespace plugin contract.

## Ownership

DeepSeek Harness owns:

- model invocation;
- tool and skill execution;
- agent/session execution;
- sandbox/process capabilities;
- Cordis plugin lifecycle.

DSH Factory owns:

- Change graph semantics;
- ContextPack construction;
- Evidence and Finding semantics;
- Gates and policy;
- orchestration decisions;
- SDLC-specific persistence and projections.

A DSH Session may be referenced by a Run, but it is not the source of truth for Change state.
