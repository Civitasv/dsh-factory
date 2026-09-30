# Orven

Orven is an AI-native software-development runtime with a Harness-neutral core and thin Agent-Harness adapters.

The system is **change-centric**, **event-sourced**, **graph-based**, and **evidence-driven**.

## Architecture

```text
private internal modules
  domain / events / evidence / context
  policy / work / execution / persistence
  integrations / release / observation / graph-ui
                |
                v
          @orven/core
                |
        +-------+--------+
        |                |
        v                v
@orven/plugin-dsh   future plugin-<harness>
        |                |
        v                v
DeepSeek Harness     another Harness
```

DeepSeek Harness is the first supported Harness, not a dependency of Orven's neutral runtime.

## DSH installation

After publication:

```bash
dsh plugin --profile web add @orven/plugin-dsh
```

The DSH Bundle mounts Orven and exposes the compatibility service `ctx.factory`.

## Development

```bash
pnpm install
pnpm check
pnpm distribution:check
```

The repository owner may rename the GitHub repository separately; package metadata already targets the Orven repository identity.
