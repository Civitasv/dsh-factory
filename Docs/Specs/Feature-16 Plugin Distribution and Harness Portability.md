# Feature-16 Plugin Distribution and Harness Portability

> **Superseded by Feature-17.** Feature-16 introduced fourteen public Factory packages. Feature-17 preserves the same internal modularity but contracts the public surface to `@orven/core` plus Harness adapters such as `@orven/plugin-dsh`.


## Objective

Make DSH Factory publishable and installable through the ordinary DeepSeek Harness plugin workflow without collapsing the architecture into a DSH-specific monolith.

The design goal is:

> one package for the user to install, multiple harness-neutral packages for the implementation to evolve.

The user-facing DSH installation is:

~~~bash
dsh plugin --profile web add @dsh-factory/plugin-dsh
~~~

The source/runtime architecture remains layered so another Agent Harness can be supported later by adding another outer adapter rather than rewriting Factory.

## Architecture

Factory is split into three distribution tiers.

### Tier 1 — harness-neutral kernel

~~~text
@dsh-factory/core
@dsh-factory/events
@dsh-factory/evidence
@dsh-factory/context
@dsh-factory/policy
@dsh-factory/work
@dsh-factory/execution
@dsh-factory/persistence
~~~

These packages contain Factory domain/runtime semantics and must not depend on DeepSeek Harness or Cordis.

### Tier 2 — reusable integrations and presentation

~~~text
@dsh-factory/integration-github
@dsh-factory/integration-ci
@dsh-factory/release
@dsh-factory/observation
@dsh-factory/graph-ui
~~~

These packages may depend on Tier 1 but remain Agent-Harness neutral.

### Tier 3 — harness adapters

~~~text
@dsh-factory/plugin-dsh
@dsh-factory/plugin-<future-harness>
~~~

Harness adapters translate a host Harness service model into the neutral Factory contracts.

Only a harness adapter may depend on host-specific packages such as @deepseek-ai/* or Cordis.

## Portability model

The neutral layers define the durable product semantics:

~~~text
Change / Criterion / Evidence
        ↓
Context / Policy
        ↓
Work / Execution
        ↓
neutral ports
        ↓
Harness Adapter
~~~

DSH support is therefore:

~~~text
neutral Factory
      ↓
plugin-dsh
      ↓
ctx.agents / Cordis / DSH
~~~

A future Harness integration should be able to implement:

~~~text
neutral Factory
      ↓
plugin-other-harness
      ↓
other Agent Harness
~~~

without changing Change Graph, Evidence, Context, Policy, Work, or Execution semantics.

## Distribution strategy

Factory does not bundle every source layer into one generated JavaScript blob.

Instead, each reusable package is published as an ordinary scoped npm package.

The DSH adapter declares the neutral packages it needs as normal dependencies.

Therefore a user installs one package:

~~~text
@dsh-factory/plugin-dsh
~~~

and npm/pnpm resolves its transitive Factory packages automatically.

Users do not need to install or understand each internal package manually.

This preserves independent package boundaries, package-local tests, dependency direction, future harness reuse, and independent imports for advanced integrators.

## Version policy

Feature-16 establishes the first public package line:

~~~text
0.1.0
~~~

All public @dsh-factory/* packages use one synchronized version for now.

Lockstep versioning is chosen initially because the public contracts are still evolving together.

Workspace Factory dependencies use:

~~~text
workspace:^
~~~

During pnpm pack/publish, workspace references are resolved into registry-compatible semantic ranges.

For the initial 0.1.x line this yields compatibility within the same minor line and excludes 0.2.0.

A future feature may introduce independent package versioning after API boundaries stabilize.

## Public package metadata

Every publishable Factory package declares:

- name;
- version;
- description;
- ESM type;
- main entry;
- type declarations;
- exports;
- MIT license;
- repository metadata;
- Node engine range;
- public publish access.

Baseline:

~~~json
{
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": "^22.19.0 || >=24.0.0"
  }
}
~~~

The repository root remains private and is never published.

## Package contents

Packages ship compiled artifacts, not TypeScript source or tests.

A package tarball may contain package.json, workspace/root LICENSE as included by pnpm, README when present, compiled JavaScript, source maps, declarations, declaration maps, and package-specific runtime assets such as cordis.patch.yml.

It must not contain:

- src/;
- tests/;
- TypeScript test output;
- tsconfig.json;
- .tsbuildinfo;
- local development fixtures.

Package-local .npmignore rules enforce this while keeping the TypeScript build/test topology unchanged.

## DSH bundle package

@dsh-factory/plugin-dsh is both:

1. the DSH/Cordis plugin module;
2. the DSH Bundle users install into a profile.

Its package manifest declares:

~~~json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
~~~

Its package exports include the root module, ./cordis.patch.yml, and ./package.json.

## DSH bundle patch

The shipped patch inserts exactly one Factory host row:

~~~yaml
- insert:
    - id: factory
      name: '@dsh-factory/plugin-dsh'
      config:
        graphId: factory
~~~

The bundle does not duplicate DSH core rows.

It relies on a base-backed DSH profile to provide the public agents service.

Because the Factory plugin declares inject = ['agents'], the row activates only when that required service is available.

## User override model

The shipped bundle chooses conservative defaults:

~~~text
graphId = factory
persistenceDirectory = absent
~~~

This means installation is immediately valid and uses in-memory persistence.

A user may override the row in the profile's later cordis.patch.yml layer:

~~~yaml
- id: factory
  config:
    graphId: my-project
    persistenceDirectory: ./.factory
~~~

DSH's ordinary layer precedence remains authoritative.

Factory adds no separate configuration system.

## Installation paths

### Registry installation

Primary user path:

~~~bash
dsh plugin --profile web add @dsh-factory/plugin-dsh
~~~

or another base-backed profile:

~~~bash
dsh plugin --profile headless add @dsh-factory/plugin-dsh
~~~

DSH detects the package's dsh.bundle declaration and appends it to that profile's dsh.profile.bundles.

### Tarball installation

Prebuilt tarballs are also supported:

~~~bash
dsh plugin --profile web add ./dsh-factory-plugin-dsh-0.1.0.tgz
~~~

No install-time compilation is required.

### Local development

Repository development keeps the existing workspace/Loader path.

A local package directory may be linked into a development profile after the workspace has been built.

### Direct Git installation

Direct Git installation is not a Feature-16 distribution target.

The repository is a multi-package workspace and a Git dependency would require trusted install-time build execution plus workspace-aware package preparation.

Feature-16 intentionally prefers prebuilt npm/tarball artifacts with no prepare lifecycle script.

This avoids asking users to grant arbitrary install-time code execution.

## DSH peer ownership

plugin-dsh keeps DSH/Cordis host packages as peer dependencies.

The running DSH installation supplies the shared runtime instances.

The adapter also keeps matching dev dependencies for local typecheck/tests.

Harness-neutral packages declare no DSH/Cordis dependency, peer dependency, or dev dependency.

## Internal Factory dependencies

Factory package-to-package dependencies use workspace protocol in source:

~~~json
{
  "dependencies": {
    "@dsh-factory/core": "workspace:^"
  }
}
~~~

Packed/published manifests must contain no workspace: specifiers.

The distribution validation checks the actual packed manifests rather than assuming source manifests are publishable.

## Distribution verification

Feature-16 adds an executable distribution verifier.

It:

1. discovers all public packages/*/package.json;
2. checks synchronized version 0.1.0;
3. checks public metadata;
4. verifies harness-neutral packages contain no DSH/Cordis package references;
5. verifies only plugin-dsh owns dsh.bundle;
6. verifies the DSH bundle patch references @dsh-factory/plugin-dsh;
7. runs pnpm pack for every public package;
8. inspects each tarball's packed package.json;
9. rejects any packed workspace: dependency;
10. rejects source, test, tsconfig, or tsbuildinfo files in the tarball;
11. requires plugin-dsh to contain compiled entrypoint and cordis.patch.yml.

The verifier uses packed artifacts because package publication is the contract being tested.

## CI

The GitHub Actions PR gate becomes:

~~~text
install
  ↓
typecheck
  ↓
lint
  ↓
tests
  ↓
build
  ↓
distribution verification / pack
~~~

A change that makes Factory code correct but package artifacts uninstallable is not Green.

## Publish dry run

Feature-16 adds a root command:

~~~bash
pnpm distribution:check
~~~

It builds and verifies every public package.

A separate command:

~~~bash
pnpm publish:dry-run
~~~

runs pnpm recursive publish in dry-run mode and never writes to a registry.

Actual registry publication requires explicit maintainer credentials and is not performed by ordinary CI.

## Future harness adapters

A future harness package follows the same pattern:

~~~text
packages/plugin-new-harness
~~~

It may depend on neutral Factory packages and the new Harness's public API packages.

It must not cause neutral Factory packages to import that Harness.

The portability test is dependency direction, not identical Harness APIs.

## Package naming

The existing @dsh-factory/* scope remains the project/package namespace in Feature-16.

That name is branding, not an architectural dependency on DeepSeek Harness.

Renaming the public scope is a separate migration because it affects registry ownership, import paths, and downstream consumers.

The architecture must nevertheless remain capable of supporting non-DSH adapters beneath the same scope.

## Invariants

### DIST-01 — one user install

A DSH user installs only @dsh-factory/plugin-dsh; transitive Factory packages resolve automatically.

### DIST-02 — layered source

Publishing does not collapse the neutral package boundaries.

### DIST-03 — harness dependency inversion

Only harness-adapter packages depend on Harness-specific runtime packages.

### DIST-04 — ordinary DSH bundle

plugin-dsh uses the standard dsh.bundle.patch profile mechanism.

### DIST-05 — no workspace protocol in artifacts

Packed public manifests contain no workspace: specifiers.

### DIST-06 — no source/test leakage

Published tarballs contain runtime/type artifacts only.

### DIST-07 — prebuilt install

Registry/tarball installation requires no prepare or post-install compilation.

### DIST-08 — shared host peers

DSH/Cordis runtime services remain peers supplied by the DSH host.

### DIST-09 — synchronized initial version

All public Factory packages start at 0.1.0.

### DIST-10 — root remains private

The monorepo root cannot be accidentally published.

### DIST-11 — install config remains overrideable

Factory configuration uses ordinary DSH patch precedence.

### DIST-12 — distribution is CI evidence

Packaged-artifact validation is part of required CI.

## Acceptance criteria

### AC-001 — package metadata

Every Factory package under packages/* is public, versioned 0.1.0, and has consistent package metadata.

### AC-002 — neutral boundary

Distribution validation fails if any neutral package references @deepseek-ai/* or Cordis packages.

### AC-003 — DSH bundle

plugin-dsh declares dsh.bundle.patch and ships a valid cordis.patch.yml.

### AC-004 — one-package install graph

The packed plugin-dsh manifest expresses registry-compatible dependencies on the neutral packages it requires.

### AC-005 — packed workspace rewrite

No packed package manifest contains workspace:.

### AC-006 — clean tarballs

Packed artifacts contain no source/test/config build inputs.

### AC-007 — compiled plugin entry

The plugin-dsh tarball contains dist/index.js, type declarations, and cordis.patch.yml.

### AC-008 — no install build script

No public package requires prepare, install, or postinstall to function from a registry/tarball.

### AC-009 — CI distribution gate

GitHub Actions runs distribution validation after ordinary code validation.

### AC-010 — usage documentation

The plugin README documents registry, tarball, profile override, removal, and verification commands.

## Implementation scope

Feature-16 includes:

- full distribution/portability spec;
- public metadata for all reusable Factory packages;
- synchronized 0.1.0 package version;
- workspace dependency range normalization;
- DSH Bundle metadata;
- shipped cordis.patch.yml;
- plugin-dsh installation README;
- package ignore rules;
- executable package/tarball verifier;
- root distribution scripts;
- CI distribution gate;
- architecture/navigation/state updates.

## Non-goals

- actually publishing packages to npm in this PR;
- npm account/scope ownership configuration;
- automatic semantic-version calculation;
- Changesets/release-note automation;
- direct Git dependency installation;
- adding a second Harness adapter;
- renaming the @dsh-factory package scope;
- mounting Graph UI into DSH Web;
- adding Factory tools/commands to the model-facing DSH tool catalog.
