# @orven/plugin-dsh

DeepSeek Harness adapter and installable DSH Bundle for Orven.

## Install

~~~bash
dsh plugin --profile web add @orven/plugin-dsh
~~~

or:

~~~bash
dsh plugin --profile headless add @orven/plugin-dsh
~~~

The bundle mounts Orven into the DSH Cordis graph, publishes `ctx.orven`, and defaults to guided orchestration through the DSH system prompt. It registers four model-facing tools:

- `orven_begin_change` — create a durable Change with acceptance Criteria;
- `orven_status` — inspect current coverage and derived Gate state;
- `orven_execute` — delegate Work through a fresh DSH worker and capture exact tool-result Artifacts;
- `orven_record_evidence` — attach an explicit Artifact-backed Evidence claim to a Criterion.

For a workspace-backed DSH Session, graph persistence defaults to `<cwd>/.orven/`.
The plugin writes `.orven/.gitignore` so the runtime log stays local by default.

## DSH Web Change Graph

When the bundle is loaded in a Web-backed profile, the same package contributes a
browser client. DSH Web gets a first-class **Orven** sidebar entry and a read-only
main panel for the selected Session's active Change.

The panel shows the active Change title/kind, graph revision, required Evidence
coverage, derived Gate state, and the neutral Orven graph explorer. The graph is
scoped to the active Change's connected component; selecting nodes reveals their
domain facts and typed incoming/outgoing relations.

The browser never chooses a workspace or Change id. It supplies only the selected
DSH Session id to the authenticated Host route, and the Host resolves the Session's
durable Orven binding. Refresh uses graph revision ETags and polls only while the
Orven panel is selected and the page is visible. A failed refresh keeps the last
good graph visible and marks it stale.

### Local acceptance

From an Orven checkout on the Feature branch:

~~~powershell
.\scripts\orven-local.ps1 install
.\scripts\orven-local.ps1 run
~~~

Create or select a DSH Session for a workspace, ask the agent to begin a non-trivial
Orven Change, then open **Orven** in the left sidebar. To rebuild the installed
package after changing the checkout:

~~~powershell
.\scripts\orven-local.ps1 update
~~~

The local helper remains manual by design; it does not watch Git or source changes.

Guided mode tells agents to create explicit Criteria before non-trivial workspace
mutation, ground completion in Artifact-backed Evidence, and re-check the Gate before
claiming completion. Read-only/trivial work is left alone. To expose the tools without
adding orchestration guidance:

~~~yaml
- id: orven
  config:
    graphId: orven
    orchestration: manual
~~~

Delegated Orven workers are hard-blocked from recursively starting another Change or
calling `orven_execute`; they execute the assigned Work directly.

Override persistence in the profile's later `cordis.patch.yml` layer:

~~~yaml
- id: orven
  config:
    graphId: my-project
    persistenceDirectory: ./.orven
~~~

## Architecture

This package is only the DSH adapter. The Harness-neutral product API is `@orven/core`. Future Harness integrations should be parallel `@orven/plugin-*` packages rather than changes to Core.

## Cordis service

Other DSH/Cordis plugins should depend on and consume `ctx.orven`. No `ctx.factory` compatibility alias is published.
