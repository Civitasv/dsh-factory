# DSH Factory

AI-native software development system with a harness-neutral core and DeepSeek Harness support through an outer plugin adapter.

The project is **change-centric**, **event-sourced**, **graph-based**, and **evidence-driven**.

## Architecture

```text
Harness-neutral Factory
  Change Graph
  Evidence / Context / Policy
  Work / Execution / Persistence
  Integrations / Graph UI
        |
        +-- @dsh-factory/plugin-dsh
        |       |
        |       +-- DeepSeek Harness / Cordis
        |
        +-- future plugin-<agent-harness>
```

DeepSeek Harness is the currently supported Agent Harness, not a dependency of the Factory domain/runtime.

See [Harness Integration](Docs/Architecture/Harness%20Integration.md) and [Code.md](Code.md).

## Install in DeepSeek Harness

After the packages are published to the configured registry:

```bash
dsh plugin --profile web add @dsh-factory/plugin-dsh
```

The DSH Bundle mounts one `factory` row and publishes `ctx.factory`.

Verify the composed profile:

```bash
dsh --profile web --dump-config
```

Override persistence in the profile's `cordis.patch.yml` when needed:

```yaml
- id: factory
  config:
    graphId: my-project
    persistenceDirectory: ./.factory
```

## Development

Requires Node.js `^22.19.0 || >=24.0.0` and pnpm 11.

```bash
pnpm install
pnpm check
pnpm distribution:check
```

To inspect the publish operation without writing to a registry:

```bash
pnpm publish:dry-run
```

CI runs on GitHub Actions. This repository does not use CNB.
