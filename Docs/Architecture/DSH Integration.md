# DeepSeek Harness Integration

DeepSeek Harness is Orven's first supported Agent Harness.

```text
@orven/core
    ↓
@orven/plugin-dsh
    ↓
ctx.agents / Cordis / DSH
```

DSH owns Agent loops, Sessions, models, tools, skills, sandbox/process mechanics, and Cordis lifecycle.

Orven owns Change/Evidence/Context/Policy/Work/Execution semantics and SDLC integrations.

The adapter publishes the Orven service `ctx.orven` and executes Work through the public `ctx.agents` seam. It does not import the concrete DSH agent-loop implementation.

DSH message source identity is `orven`; deterministic execution Session ids use `orven:<execution-id>`.

The DSH Bundle is installed as:

```bash
dsh plugin --profile web add @orven/plugin-dsh
```

## Service identity

The DSH adapter publishes exactly one Orven-owned Cordis service: `ctx.orven`.

It does not publish a legacy `ctx.factory` alias. Other DSH plugins that integrate with Orven should inject/use the `orven` service key.
