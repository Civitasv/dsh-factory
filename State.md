# DSH Factory Current State

## Release surface

Features 01-08 are implemented through the DeepSeek Harness runtime adapter.

## Implemented

- Change Graph, Evidence, Context, Policy, Work, and runtime-neutral Execution Protocol.
- DSH integration uses public `ctx.agents` rather than agent-loop internals.
- Deterministic Execution -> DSH Session identity.
- Canonical Factory ContextPack injection before Work follow-up.
- Owned DSH AgentHandle lifecycle with guaranteed disposal.
- AbortSignal propagation to DSH agent cancellation.
- Explicit DshOutcomeCollector seam for structured Factory output.
- DSH completion still passes Feature-07 Graph freshness acceptance.
- Cordis plugin publishes `ctx.dshFactoryRuntime`.

## Active limitations

- Outcome Collector implementations are application/integration-specific; free-form assistant prose is not trusted Evidence.
- Production persistence is not implemented.
- No GitHub/CI/release/production adapters.
- No end-user Graph UI.
