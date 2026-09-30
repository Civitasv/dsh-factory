# Harness Integration

## Principle

DSH Factory is not architecturally bound to one Agent Harness.

The product semantics live in harness-neutral packages. A Harness adapter is an outer integration layer that maps a host's execution services onto Factory Work/Execution contracts.

```text
Factory domain/runtime
  core
  events
  evidence
  context
  policy
  work
  execution
  persistence
        |
        v
Harness adapter
        |
        v
Agent Harness
```

## Current adapter

The currently implemented adapter is:

```text
@dsh-factory/plugin-dsh
```

It maps Factory execution onto DeepSeek Harness through public Cordis/DSH seams such as `ctx.agents`.

DeepSeek Harness owns Agent/session/model/tool/skill/sandbox mechanics. Factory owns SDLC semantics.

## Future adapters

A future adapter such as:

```text
@dsh-factory/plugin-other-harness
```

may depend on the neutral packages and the target Harness APIs.

It must not require the neutral packages to import that Harness.

## Dependency rule

Harness-specific imports are allowed only in harness-adapter packages.

Harness-neutral packages must not depend on:

- `@deepseek-ai/*`;
- Cordis;
- any future Harness-specific SDK.

This dependency rule is enforced by Feature-16 distribution verification.

## Distribution

Factory source remains modular.

Users install only the adapter appropriate to their Harness. Its ordinary npm dependencies pull the neutral Factory packages transitively.

For DeepSeek Harness:

```bash
dsh plugin --profile web add @dsh-factory/plugin-dsh
```

This gives one-package UX without turning the implementation into a DSH-specific monolith.
