# @dsh-factory/plugin-dsh

DeepSeek Harness adapter and installable DSH Bundle for DSH Factory.

## Install

Install the bundle into any base-backed DSH profile:

~~~bash
dsh plugin --profile web add @dsh-factory/plugin-dsh
~~~

or:

~~~bash
dsh plugin --profile headless add @dsh-factory/plugin-dsh
~~~

The bundle inserts one Cordis row named `factory` and publishes `ctx.factory`.

Verify the composed profile before booting:

~~~bash
dsh --profile web --dump-config
~~~

Then boot normally:

~~~bash
dsh web
~~~

## Persistence

The shipped bundle uses:

~~~yaml
graphId: factory
~~~

with in-memory persistence.

Override the Factory row in the profile's later `cordis.patch.yml` layer to enable durable JSONL storage:

~~~yaml
- id: factory
  config:
    graphId: my-project
    persistenceDirectory: ./.factory
~~~

DSH's ordinary patch precedence applies.

## Tarball install

A prebuilt tarball can be installed without running package build scripts:

~~~bash
dsh plugin --profile web add ./dsh-factory-plugin-dsh-0.1.0.tgz
~~~

## Remove

~~~bash
dsh plugin --profile web remove @dsh-factory/plugin-dsh
~~~

## Architecture

This package is only the DeepSeek Harness adapter. Change Graph, Evidence, Context, Policy, Work, Execution, and persistence live in harness-neutral `@dsh-factory/*` packages so another Agent Harness can be supported with a parallel adapter.
