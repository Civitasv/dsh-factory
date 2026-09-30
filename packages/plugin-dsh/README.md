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
