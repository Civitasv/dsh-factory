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

The DSH Bundle mounts Orven, exposes `ctx.orven`, and registers the model-facing Change loop:

```text
orven_begin_change
orven_status
orven_execute
orven_record_evidence
```

Workspace-backed sessions persist their Change Graph under `<cwd>/.orven/` by default.
The DSH Bundle defaults to guided orchestration: for non-trivial workspace mutations the
agent is instructed to establish Criteria, execute/observe work, attach Artifact-backed
Evidence, and re-check the Gate before reporting completion.

## Development

```bash
pnpm install
pnpm check
pnpm distribution:check
```

For local DSH testing, the helper scripts create a dedicated `orven` profile from
DSH's built-in `web` template on first install. They package the current working
tree and never fetch, reset, or switch Git branches.

```bash
./scripts/orven-local.sh install
./scripts/orven-local.sh run
```

```powershell
.\scripts\orven-local.ps1 install
.\scripts\orven-local.ps1 run
```

Use `ORVEN_DSH_PROFILE` or `ORVEN_DSH_TEMPLATE` to override the defaults.

The repository owner may rename the GitHub repository separately; package metadata already targets the Orven repository identity.
