# DSH Factory

AI-native software development runtime built on top of DeepSeek Harness.

The project is **change-centric**, **event-sourced**, **graph-based**, and **evidence-driven**. DeepSeek Harness provides the agent execution substrate; DSH Factory owns the software-development domain model, context/evidence protocols, gates, policy, and orchestration.

## Status

Repository foundation only. The domain and execution protocols are being specified before higher-level Product/Development/QA/Release capabilities are implemented.

## Architecture

```text
DSH Factory
  Domain model
  Change graph
  Event log
  Context / Evidence protocols
  Gates / Policy / Orchestration
        |
        v
DeepSeek Harness / Cordis
  Agent loop
  Models
  Tools
  Skills
  Sessions
  Sandboxes
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
