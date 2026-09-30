# Harness Integration

## Boundary

Orven's product semantics are Harness-neutral.

```text
private neutral modules
        ↓
   @orven/core
        ↓
@orven/plugin-<harness>
        ↓
 Agent Harness
```

The current adapter is `@orven/plugin-dsh`.

A future Codex/Claude/other integration adds a parallel adapter and must not force Harness APIs into Core.

## Enforcement

Neutral packages may not depend on DSH/Cordis or another Harness SDK.

Adapter packages may depend on the target Harness and on `@orven/core`, but not on `@orven/internal-*`.

Distribution CI validates this on packed artifacts and in a clean non-workspace consumer project.
