# DSH Factory

AI-native software development plugin for DeepSeek Harness.

The project is **change-centric**, **event-sourced**, **graph-based**, and **evidence-driven**. DeepSeek Harness is the harness and runtime host; DSH Factory is an SDLC plugin installed into that Cordis service graph.

## Status

Features 01-15 provide the Factory domain, evidence/context/policy/work/execution stack, DSH plugin service, persistence and integration protocols, and graph-first UI foundation.

## Architecture

```text
DeepSeek Harness / Cordis
  Agents / Agent loop
  Sessions
  Models
  Tools / Skills
  Sandbox
        |
        +-- @dsh-factory/plugin-dsh
              |
              +-- ctx.factory
              +-- Change Graph
              +-- Evidence / Context / Policy
              +-- Work / Execution
              +-- Integrations / Release / Observation
```

See [Code.md](Code.md) for repository navigation and [Docs/Architecture/Overview.md](Docs/Architecture/Overview.md) for architecture boundaries.

## Development

Requires Node.js `^22.19.0 || >=24.0.0` and pnpm 11.

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

CI runs on GitHub Actions. This repository does not use CNB.
