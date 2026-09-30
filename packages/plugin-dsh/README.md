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

The bundle mounts Orven into the DSH Cordis graph, publishes the Orven service `ctx.orven`, and registers the model-facing tools:

~~~text
orven_begin_change
orven_status
orven_execute
~~~

By default the Event Log is durable under the launched workspace:

~~~text
./.orven/graph.json
./.orven/events.jsonl
~~~

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
