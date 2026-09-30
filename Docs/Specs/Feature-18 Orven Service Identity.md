# Feature-18 Orven Service Identity

## Objective

Complete the Orven product rebrand at the DSH/Cordis service boundary.

The public service changes from:

~~~text
ctx.factory
~~~

to:

~~~text
ctx.orven
~~~

No compatibility alias is retained because Orven has not yet shipped a stable public release with third-party consumers.

## Contract

The DSH plugin augments Cordis with:

~~~ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    orven: OrvenService
  }
}
~~~

Activation publishes:

~~~ts
ctx.provide('orven', service)
~~~

Other DSH plugins should inject/use the service key `orven`.

## Loader contract

Real Loader acceptance resolves:

~~~text
ctx.get('orven')
~~~

and must fail if the service is absent.

The existing OrvenService API is unchanged:

- graphId;
- currentRevision();
- currentSequence();
- snapshot();
- append();
- prepareWork();
- executePrepared();
- executeWork().

Only the host service identity changes.

## Invariants

- ORVSVC-01: `ctx.orven` is the sole Orven service identity.
- ORVSVC-02: `ctx.factory` is not published or type-augmented.
- ORVSVC-03: the DSH Bundle row remains `id: orven`.
- ORVSVC-04: Orven domain/runtime behavior is unchanged.
- ORVSVC-05: real Loader composition proves `ctx.orven`.
- ORVSVC-06: packed distribution remains clean and installable.

## Acceptance criteria

1. Cordis Context augmentation exposes `orven: OrvenService`.
2. Plugin activation calls `ctx.provide('orven', service)`.
3. Unit tests assert the `orven` provider key.
4. Loader smoke resolves `ctx.get('orven')`.
5. Active README/architecture/state docs use `ctx.orven`.
6. No active implementation publishes `ctx.factory`.
7. Typecheck, lint, tests, Loader smoke, and distribution verification are Green.

## Non-goals

- changing OrvenService methods;
- changing the DSH Bundle id;
- changing graphId semantics;
- publishing packages to npm;
- adding another Harness adapter.
