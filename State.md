# DSH Factory Current State

## Release surface

Features 01-16 are implemented through publish-ready layered packages and the DeepSeek Harness adapter.

## Implemented

- Harness-neutral Change Graph, Evidence, Context, Policy, Work, Execution, persistence, integrations, and Graph UI packages.
- DeepSeek Harness support is isolated in `@dsh-factory/plugin-dsh`.
- All reusable packages are publishable public npm packages at synchronized version `0.1.0`.
- Internal Factory dependencies use workspace semantic ranges that pnpm rewrites during pack/publish.
- `plugin-dsh` is a standard DSH Bundle with `dsh.bundle.patch` and a shipped `cordis.patch.yml`.
- DSH users install one adapter package; neutral Factory packages resolve transitively.
- Public packages ship compiled JavaScript/types and exclude source/tests/build configuration.
- Public packages require no install-time `prepare`/`install`/`postinstall` build.
- CI builds and packs every public package, checks packed manifests for leaked `workspace:` protocols, and verifies tarball hygiene.
- Real DSH Loader/process integration remains covered by Feature-15.

## Architecture baseline

- Agent Harnesses are outer adapters, not dependencies of Factory domain semantics.
- DSH is the currently supported host through `packages/plugin-dsh`.
- A future Agent Harness can add `plugin-<harness>` while reusing the neutral packages.
- Source layering is preserved in distribution; user installation remains one-package UX.
- Event Log / Change Graph remains authoritative regardless of Harness.

## Active limitations

- Packages are publish-ready but this repository has not actually published them to an npm registry.
- Registry scope ownership/credentials are external maintainer setup.
- The standard production Outcome Collector remains caller-provided.
- Graph UI is not yet mounted into the DSH Web slot system.
