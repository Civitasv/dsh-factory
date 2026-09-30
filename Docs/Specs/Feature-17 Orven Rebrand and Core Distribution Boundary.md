# Feature-17 Orven Rebrand & Core Distribution Boundary

## Objective

Rename the product from DSH Factory to **Orven** and establish a durable public distribution model independent of any one Agent Harness.

Public product packages:

~~~text
@orven/core
@orven/plugin-dsh
~~~

Future Harness support adds parallel adapters such as @orven/plugin-codex or @orven/plugin-claude.

The source repository remains highly modular. Public package count is deliberately smaller than internal package count.

## Product identity

The product name is Orven.

The repository owner will rename the GitHub repository separately. All repository-controlled branding, npm scopes, docs, scripts, examples, DSH source labels, and distribution metadata migrate to Orven.

Legacy names remain only where historical specs explicitly document a superseded design.

## Public packages

Only two packages are public today.

### @orven/core

The complete Harness-neutral Orven API/runtime distribution, exposing domain, Change Graph, Events, Evidence, Context, Policy/Gates, Work, Execution, Persistence, GitHub/CI semantic normalization, Release, Observation, and Graph UI.

### @orven/plugin-dsh

The DeepSeek Harness adapter and installable DSH Bundle.

It depends on @orven/core and DSH/Cordis public APIs only. It must not import private Orven implementation packages.

## Internal source architecture

Internal modules remain separate workspace packages:

~~~text
packages/domain
packages/events
packages/evidence
packages/context
packages/policy
packages/work
packages/execution
packages/persistence
packages/integration-github
packages/integration-ci
packages/release
packages/observation
packages/graph-ui
~~~

They are private implementation modules named @orven/internal-<module> and all declare private: true.

## Rename existing low-level core

The current packages/core package is the low-level domain model. It becomes:

~~~text
packages/domain
@orven/internal-domain
~~~

This reserves @orven/core for the complete public neutral distribution.

## New public Core package

A new packages/core owns @orven/core.

Public subpaths:

~~~text
@orven/core
@orven/core/domain
@orven/core/events
@orven/core/evidence
@orven/core/context
@orven/core/policy
@orven/core/work
@orven/core/execution
@orven/core/persistence
@orven/core/integration-github
@orven/core/integration-ci
@orven/core/release
@orven/core/observation
@orven/core/graph-ui
~~~

It is an assembly boundary, not duplicate implementation.

## Public Core build

Private internal packages must not become npm runtime dependencies of @orven/core.

Build pipeline:

~~~text
tsc -b
  ↓
private module outputs
  ↓
tsdown public Core assembly
  ↓
@orven/core/dist
~~~

TypeScript project references validate internal boundaries; tsdown assembles the public artifact.

The packed Core contains no @orven/internal-* runtime import or dependency.

## Harness neutrality

No internal neutral module and no @orven/core artifact may depend on DSH/Cordis or another Agent-Harness SDK.

Harness-specific dependencies are allowed only in plugin-* adapters.

## DSH adapter boundary

packages/plugin-dsh becomes @orven/plugin-dsh.

Its Orven imports are exclusively @orven/core or @orven/core/*.

If DSH needs a neutral capability not exposed by Core, Core must expose it rather than the adapter bypassing the public boundary.

## DSH Bundle

The adapter remains a standard DSH Bundle and ships cordis.patch.yml.

The bundle mounts:

~~~yaml
- insert:
    - id: orven
      name: '@orven/plugin-dsh'
      config:
        graphId: orven
~~~

For compatibility, the Cordis service remains ctx.factory in Feature-17. Renaming it is a separate API decision.

The DSH message-source kind changes from dsh-factory to orven.

Deterministic DSH Session ids change from dsh-factory:<execution-id> to orven:<execution-id>.

## Versioning

Initial public versions:

~~~text
@orven/core        0.1.0
@orven/plugin-dsh  0.1.0
~~~

Internal modules remain private and may stay at 0.0.0.

## Distribution artifacts

Feature-16's fourteen-public-package topology is superseded.

CI validates exactly two public artifacts:

~~~text
orven-core-0.1.0.tgz
orven-plugin-dsh-0.1.0.tgz
~~~

## Clean-install validation

CI creates a temporary project outside the workspace, installs the packed artifacts, and verifies imports for @orven/core, representative Core subpaths, and @orven/plugin-dsh.

No @orven/internal-* package may participate in clean module resolution.

## Packed Core invariants

The Core tarball:

- contains compiled JS/types for every declared subpath;
- contains no source tests or build config;
- contains no @orven/internal-* runtime dependency;
- contains no @dsh-factory/* reference;
- contains no DSH/Cordis dependency/import;
- requires no install-time compilation.

## Packed DSH adapter invariants

The adapter tarball:

- depends on @orven/core;
- contains no @orven/internal-* or @dsh-factory/* reference;
- declares DSH/Cordis peers;
- ships cordis.patch.yml and dsh.bundle.patch metadata;
- requires no install-time compilation.

## DSH Loader acceptance

The real Loader/process smoke remains required with Orven naming and built artifacts.

It proves:

~~~text
real Cordis Loader
  ↓
real DSH AgentRegistry
  ↓
@orven/plugin-dsh
  ↓
ctx.factory
  ↓
@orven/core
  ↓
Work execution
~~~

## Dependency direction

Allowed:

~~~text
internal-domain
      ↑
neutral internal modules
      ↑
@orven/core
      ↑
@orven/plugin-dsh
      ↑
DSH
~~~

Forbidden: internal modules importing plugin-dsh, neutral execution importing DSH, Core importing DSH, or plugin-dsh importing @orven/internal-*.

## CI pipeline

~~~text
install
→ typecheck
→ lint
→ tests
→ internal build
→ Core bundle
→ plugin build
→ pack two public packages
→ artifact inspection
→ clean install/import
→ DSH Loader smoke
~~~

## Invariants

- ORV-01: active project branding is Orven.
- ORV-02: only @orven/core and @orven/plugin-dsh are public.
- ORV-03: internal modularity remains private and independently testable.
- ORV-04: @orven/core is Harness-neutral.
- ORV-05: plugin-dsh consumes public Core only.
- ORV-06: packed public artifacts require no private packages.
- ORV-07: active source/build metadata contains no @dsh-factory/* dependency/import.
- ORV-08: a DSH user installs only @orven/plugin-dsh.
- ORV-09: future Harness support is a parallel adapter.
- ORV-10: public artifacts are proven outside workspace resolution.

## Acceptance criteria

1. Existing packages/core becomes private packages/domain.
2. All internal package identities use @orven/internal-*.
3. New packages/core builds @orven/core with documented subpaths.
4. plugin-dsh becomes @orven/plugin-dsh.
5. plugin-dsh imports Orven functionality only through public Core.
6. Exactly two public manifests remain.
7. Distribution CI validates exactly two tarballs.
8. Clean external install/import succeeds.
9. Core artifact has no Harness-specific/private runtime closure.
10. DSH Loader composition remains Green.
11. Root/package/docs branding migrates to Orven.
12. Required CI is Green before merge.

## Non-goals

- renaming ctx.factory;
- publishing to npm;
- configuring npm @orven scope ownership;
- renaming the GitHub repository through code;
- implementing plugin-codex;
- changing Change Graph/Evidence/Work semantics;
- mounting Graph UI into DSH Web;
- adding model-facing Orven tools.
