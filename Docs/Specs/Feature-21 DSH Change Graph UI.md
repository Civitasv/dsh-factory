# Feature-21 — DSH Change Graph UI

Status: Implemented  
Date: 2026-09-30

## 1. Problem

Feature-19 makes Orven durable and model-facing inside DeepSeek Harness. Feature-20
adds guided orchestration so an ordinary coding request can naturally enter the Orven
Change loop.

The product is still effectively invisible to the human operator.

Today a user can install `@orven/plugin-dsh`, see that the Bundle is active, and
observe Orven tool calls in the conversation, but there is no dedicated Web surface for
the authoritative Change Graph. The user cannot directly inspect:

- the active Change;
- its Criteria and current revisions;
- Runs and produced Artifacts;
- Artifact-backed Evidence;
- Gate state and coverage;
- the exact relations that make those facts a graph rather than sequential text.

Orven already owns a Harness-neutral graph projection and an interactive SVG explorer
under `@orven/core/graph-ui`. The missing work is a DSH Web integration layer that
moves the current Session's durable graph into the browser and mounts that projection
as a first-class panel.

The UI must remain a projection over authoritative Orven state. It must not become a
second source of truth or a browser-side Event Log editor.

## 2. Goals

1. Add a first-class **Orven** entry to the DSH Web sidebar.
2. Open a full-size main panel that displays the active Session's Orven Change Graph.
3. Use the existing `@orven/core/graph-ui` view model/explorer rather than defining a
   DSH-specific graph model.
4. Bind the displayed graph to the currently selected DSH Session and its active
   Orven Change.
5. Show Change / Criterion / Artifact / Evidence / Finding / Decision / Gate / Run
   nodes and their typed relations.
6. Let the user pan, zoom, fit, select nodes, and inspect exact domain facts and
   incoming/outgoing relations.
7. Surface a compact Change summary: title, graph revision, required Criterion
   coverage, and derived Gate state.
8. Refresh while Orven is changing without requiring a page reload.
9. Keep the browser surface read-only in this feature.
10. Keep the public distribution surface at exactly:
    - `@orven/core`
    - `@orven/plugin-dsh`
11. Preserve Harness neutrality of `@orven/core` and all private neutral modules.
12. Keep DSH-specific Web transport, slots, Client manifests, and UI code inside
    `packages/plugin-dsh`.

## 3. Non-goals

- No browser-side raw Event append.
- No browser-side creation/editing/deletion of Changes, Criteria, Evidence, Gates, or
  Runs.
- No drag-to-edit relation graph.
- No visual workflow editor.
- No "approve/merge/release" buttons in this feature.
- No second durable graph or UI-only persisted graph state.
- No copied/forked DSH Web shell or sidebar implementation.
- No new public npm package such as `@orven/ui` or `@orven/plugin-dsh-ui`.
- No requirement for DSH-internal build-time Typert generation.
- No dependency from `@orven/core` on DSH Client packages.
- No second Harness adapter.
- No replacement of the existing model-facing Orven tools.

## 4. Product experience

### 4.1 Sidebar

When the Orven Bundle is active, DSH Web gains one root-scoped sidebar panel entry:

```text
Orven
```

It uses DSH's existing global-panel mechanism:

```text
sidebar.panellist
       │
       └── id: orven
                │
                ▼
          main keyed slot
          key: orven
```

Selecting it must not change the selected DSH Session.

The panel reads the Session currently retained by the main Conversation view. If there
is no selected Session, it shows a no-session empty state.

### 4.2 Main panel

The default layout is:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Orven                                                                      │
│ Change title · feature                 revision 18        Gate: satisfied   │
│ 3 / 3 required criteria covered                             [Refresh] [Fit] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                      interactive Change Graph                              │
│                                                                            │
│   Change ─────► Criterion ─────► Evidence ─────► Artifact                  │
│      │                ▲                                                    │
│      └────► Gate ─────┘               Run ─────► Artifact                  │
│                                                                            │
├──────────────────────────────────────────────┬─────────────────────────────┤
│ graph canvas                                 │ selected node details       │
│                                              │ domain facts                │
│                                              │ incoming / outgoing         │
└──────────────────────────────────────────────┴─────────────────────────────┘
```

The panel should feel native to DSH Web rather than like a separately embedded app.

### 4.3 Empty states

The panel distinguishes these states:

1. **No Session selected**
   - "Select a Session to inspect its Orven Change."

2. **Session has no workspace cwd**
   - "This Session has no workspace, so Orven has no workspace-local graph."

3. **Session has no active Orven Change**
   - "No active Orven Change for this Session."
   - The panel may explain that non-trivial guided coding work will create one.
   - It does not create one itself.

4. **Active Change exists but graph is empty/corrupt**
   - This is a Host error state, not a friendly empty graph.
   - The browser displays the returned diagnostic.

5. **Host disconnected**
   - Retain the last good graph, visually mark it stale, and offer Retry.
   - Do not clear valid data merely because one refresh fails.

## 5. Architecture

```text
DSH Web browser
     │
     │ authenticated GET /api/orven/graph?sessionId=...
     ▼
@orven/plugin-dsh Client half
     │
     │ browser-safe wire DTO
     ▼
DSH Connection exact Fetch route
     │
     ▼
@orven/plugin-dsh Host half
     │
     ├── ctx.sessions.get(sessionId)
     ├── readOrvenSessionBinding(...)
     ├── ctx.orven.forWorkspace(cwd)
     ├── OrvenService.snapshot()
     └── derived status summary
             │
             ▼
      @orven/core graph state
             │
             ▼
 @orven/core/graph-ui projection
             │
             ▼
       DSH main panel
```

The authoritative direction remains:

```text
Event Log
  ↓
Change Graph snapshot
  ↓
wire projection
  ↓
browser view model
  ↓
rendering
```

No browser state flows backward into the Event Log in Feature-21.

## 6. Distribution and package shape

The implementation stays in the existing public DSH package:

```text
packages/plugin-dsh/
├── src/
│   ├── ... existing Host code
│   ├── graph-route.ts
│   ├── graph-wire.ts
│   └── client/
│       ├── index.ts
│       ├── controller.ts
│       ├── OrvenPanel.tsx
│       ├── OrvenPanel.module.css
│       └── locales.ts
├── cordis.patch.yml
├── package.json
└── tsdown.config.ts
```

The package exports:

```json
{
  ".": "... Host entry ...",
  "./client": "... browser entry ...",
  "./cordis.patch.yml": "...",
  "./package.json": "..."
}
```

Its manifest adds a DSH Client declaration:

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-ui-session",
        "@deepseek-ai/dsh-client-ui-sidebar",
        "@deepseek-ai/dsh-client-locale"
      ]
    }
  }
}
```

The exact injected package list is implementation-owned and must contain only the DSH
Client services actually used.

The browser bundle must not import Node-only Orven modules. Browser-safe graph types and
rendering code consumed by the Client must be present in the packed
`@orven/plugin-dsh` artifact or bundled into its `client.js`.

The clean external distribution verifier must continue to prove that installing only
the two public Orven packages is sufficient.

## 7. Reuse of the existing Graph UI

Feature-14 already supplies:

- `buildGraphViewModel(snapshot, options)`
- `graphNodeDetails(model, ref)`
- deterministic node layout
- typed edge rendering
- pan
- zoom
- fit
- node selection
- node detail projection
- snapshot replacement through `updateSnapshot`

Feature-21 does not duplicate those semantics.

The DSH Client adapter owns:

- where the graph is mounted;
- how the current Session is selected;
- how snapshots arrive from the Host;
- DSH visual integration;
- empty/error/loading states;
- summary chrome;
- lifecycle/disposal.

The neutral Graph UI continues to own:

- graph projection;
- layout coordinates;
- typed relation edges;
- selection mechanics;
- graph-domain detail extraction.

If the current DOM-based `mountGraphExplorer` can be embedded cleanly, use it directly.
If DSH slot composition requires a React wrapper, the wrapper must remain thin and treat
the neutral explorer as an imperative child controller.

## 8. Host transport

### 8.1 Why an exact Connection Fetch route

An out-of-tree Orven plugin cannot rely on changing DSH's generated Typert Remote
assembly. DSH already exposes an extension-safe Host communication seam:

```text
ctx.connection.fetch.register(...)
```

Feature-21 uses it.

Benefits:

- same browser authentication as the rest of DSH Web;
- same Host/Origin trust fence;
- no new Web server;
- no second authentication scheme;
- no private route outside Connection;
- external Bundle remains installable independently.

### 8.2 Route

Register exactly:

```text
GET /api/orven/graph
```

Query:

```text
sessionId=<DSH Session id>
```

No workspace path or Change id is accepted from the browser as authority.

The Host derives both from the Session.

### 8.3 Session authority

Host flow:

1. validate `sessionId`;
2. resolve `ctx.sessions.get(sessionId)`;
3. read the durable `orvenActiveChange` Session Projection;
4. read workspace from the binding, falling back to the Session header cwd only when
   consistent with Feature-19 semantics;
5. resolve `ctx.orven.forWorkspace(workspace)`;
6. verify the bound Change exists in that Graph;
7. return its graph projection.

The browser cannot ask for an arbitrary filesystem path.

### 8.4 Read-only contract

Methods:

```text
GET
HEAD
```

only.

Any mutation method returns 404/405 through the Connection route contract.

## 9. Wire contract

Define an explicit browser-safe versioned response rather than returning arbitrary
class instances.

### 9.1 Success with active Change

Conceptual shape:

```ts
interface OrvenGraphResponseV1 {
  readonly schema: 'orven.graph.v1'
  readonly sessionId: string
  readonly workspace: string
  readonly activeChangeId: string
  readonly graphId: string
  readonly graphRevision: number
  readonly change: {
    readonly id: string
    readonly title: string
    readonly kind: string
  }
  readonly coverage: {
    readonly requiredComplete: number
    readonly requiredTotal: number
  }
  readonly gateState: 'pending' | 'satisfied' | 'failed'
  readonly snapshot: ChangeGraphSnapshot
}
```

The snapshot is lossless JSON data from the Orven projection.

### 9.2 Session with no active Change

Return HTTP 200 with:

```ts
{
  schema: 'orven.graph.v1'
  sessionId
  workspace?: string
  activeChangeId: null
  graphId?: string
  graphRevision?: number
  change: null
  coverage: null
  gateState: null
  snapshot: null
}
```

"No active Change" is product state, not an HTTP error.

### 9.3 Errors

Use explicit HTTP status classes:

- `400`: malformed/missing Session id;
- `404`: Session does not exist;
- `409`: Session binding points to a Change absent from the resolved workspace graph;
- `500`: persistence/projection failure.

Body:

```ts
{
  schema: 'orven.graph.error.v1'
  code: string
  message: string
}
```

Do not serialize raw Error stacks to the browser.

## 10. Revision-aware refresh

Feature-21 should feel live without creating a new streaming protocol.

### 10.1 ETag

A successful active-Change response includes:

```text
ETag: "<graphId>:<graphRevision>:<activeChangeId>"
```

The Client sends `If-None-Match` on later reads.

If unchanged, return:

```text
304 Not Modified
```

with no JSON body.

### 10.2 Polling policy

Polling is allowed only while all of these are true:

- the Orven panel is selected;
- a Session is selected;
- the browser document is visible;
- the Client plugin is mounted.

Default interval:

```text
1500 ms
```

The controller refreshes immediately when:

- the panel is opened;
- selected Session changes;
- the page reconnects;
- the user presses Refresh.

Polling stops immediately when:

- the panel closes;
- the Session changes away;
- the Client plugin disposes;
- the page becomes hidden.

This bounds background work while giving near-live feedback during tool execution.

A future feature may replace polling with a streamed graph-revision event, but Feature-21
does not invent a second event channel.

## 11. Client model

The browser plugin owns one page-lifetime controller.

State:

```ts
type OrvenGraphClientState =
  | { phase: 'idle' }
  | { phase: 'loading'; prior?: LoadedGraph }
  | { phase: 'ready'; value: LoadedGraph }
  | { phase: 'empty'; reason: EmptyReason }
  | { phase: 'stale'; value: LoadedGraph; error: string }
  | { phase: 'error'; error: string }
```

The controller owns:

- selected Session id;
- current request generation;
- aborting superseded requests;
- ETag;
- polling timer;
- last good result;
- refresh command;
- document visibility;
- disposal.

Late responses from a previous Session must never replace the currently selected
Session's graph.

The React component receives the state as an observable hook through the DSH slot
registration's `inject.hooks` surface rather than creating duplicate transport state.

## 12. DSH UI composition

### 12.1 Sidebar registration

The Client plugin waits for:

```text
sidebar.panellist
```

and registers:

```text
id: orven
label: Orven
```

with a semantically appropriate existing DSH icon.

No new icon glyph is introduced unless DSH exposes no suitable existing graph/workflow
icon.

### 12.2 Main panel registration

Register a root-scoped keyed entry in:

```text
main
```

with the same key:

```text
orven
```

The panel uses DSH's existing frame clearances and global-panel conventions.

### 12.3 Navigation

Clicking the Orven sidebar entry calls the existing layout panel-selection path.

Returning to Conversation keeps:

- current Session;
- current conversation draft;
- Orven panel controller state.

The Orven panel must not own Session navigation.

## 13. Visual semantics

Node kinds remain visually distinguishable.

Minimum semantic grouping:

- Change — primary root;
- Criterion — acceptance condition;
- Artifact — raw observation/product;
- Evidence — interpreted claim over sources;
- Run — execution attempt;
- Gate — readiness/policy;
- Finding — issue/observation;
- Decision — explicit choice.

The UI must not imply that every edge is equivalent.

Each edge displays its actual `RelationKind`.

The selected node highlights:

- the node;
- all incident edges;
- source/target neighbors may receive a subtle secondary emphasis.

No relation is inferred from screen proximity.

## 14. Detail inspector

Selecting a node shows:

1. node kind;
2. canonical id;
3. human label;
4. exact domain JSON facts;
5. incoming relation list:
   - relation kind
   - source ref
   - relation id
6. outgoing relation list:
   - relation kind
   - target ref
   - relation id.

Criterion detail additionally shows its latest visible revision label already projected
by the neutral graph UI.

Gate detail shows its latest evaluation when present.

The first version does not render specialized editors.

## 15. Change summary header

The Host returns the same derived coverage semantics used by `orven_status`.

The panel header displays:

```text
<Change title> · <kind>
revision <n>
required: <complete>/<total>
Gate: pending | satisfied | failed
```

The browser must not independently recompute Evidence applicability or Gate readiness.

Coverage/policy truth remains Host-side.

## 16. Current Change scope

The graph canvas roots at the Session's active Change id:

```ts
buildGraphViewModel(snapshot, {
  rootChangeId: activeChangeId,
})
```

The underlying snapshot may contain multiple historical Changes for that workspace.

Feature-21 initially displays the complete workspace snapshot but lays out the active
Change component first.

If unrelated historical components create too much noise, the implementation may
filter to the connected component of the active Change before building the view,
provided:

- the filter is deterministic;
- it does not invent edges;
- a "workspace graph" mode is deferred rather than silently mixing behavior.

The default acceptance target is **active Change connected component** because the user
opened Orven from one Session.

## 17. Browser security

- The route is registered through `ctx.connection`.
- It inherits DSH's browser-session authentication.
- It inherits Host/Origin trust checks.
- The browser never supplies an arbitrary workspace path.
- The Host resolves the Session id to authoritative workspace/binding state.
- The route is read-only.
- Raw persistence file paths are not returned unless already represented as ordinary
  domain metadata intended for display.
- Host errors are normalized before crossing the wire.

## 18. Lifecycle and HMR

### 18.1 Host

All route registration belongs to the Orven plugin Context effect lifetime.

Disabling/unloading the Bundle removes the Fetch route.

### 18.2 Client

All slots, timers, listeners, and DOM controllers belong to the Client plugin Context.

Disposal must:

- abort in-flight fetches;
- stop polling;
- release document listeners;
- destroy the graph explorer;
- remove slot registrations.

### 18.3 Client HMR

The packed package's `dsh.client` manifest allows DSH Client Modules to replace the
browser plugin on rebuild.

HMR may recreate view-local pan/zoom state.

It must not mutate Orven graph state.

## 19. Build changes

`@orven/plugin-dsh` currently builds only its Host TypeScript output.

Feature-21 adds:

- Host build as today;
- browser client typecheck;
- browser `client.js` bundle;
- browser CSS bundled with the Client output;
- `./client` export;
- `dsh.client` manifest;
- files whitelist for Client artifacts.

The final packed tarball must contain:

```text
dist/host...
dist/client...
client.js
client.js.map        optional per current build policy
cordis.patch.yml
README.md
package.json
```

The exact output directory names may follow the local tsdown layout, but the installed
manifest must resolve `./client` correctly.

No source-only browser import may escape the packed artifact.

## 20. Dependency boundary

DSH Web/client dependencies belong only to `@orven/plugin-dsh`.

Likely peer/dev dependencies include the exact DSH packages behind:

- Client slots;
- layout;
- sidebar;
- Session client state;
- locale;
- renderer;
- Connection Host service.

Do not add any of these to `@orven/core`.

`@orven/plugin-dsh` continues importing neutral runtime capabilities only through
`@orven/core`, never `@orven/internal-*`.

## 21. Accessibility

Required:

- sidebar entry has visible label and accessible name;
- graph nodes remain keyboard-focusable;
- Enter/Space selects a node;
- Escape clears selection;
- Fit and Refresh are real buttons;
- selected state is programmatically represented;
- the panel has a meaningful aria label;
- color is not the only node-kind distinction;
- reduced-motion preference is respected for optional animations.

The existing graph explorer's keyboard behavior is retained.

## 22. Performance

Target scale for Feature-21:

```text
<= 500 graph nodes
<= 1500 relations
```

The initial implementation does not need virtualization.

Constraints:

- 304 refresh performs no graph re-layout;
- re-layout occurs only on a new graph revision or active Change switch;
- detail selection alone does not rebuild the graph;
- polling is paused while hidden;
- Host does not read the raw JSONL file directly for every request when an in-process
  OrvenService already owns the current store.

If later graphs exceed this scale, layout/virtualization belongs to a separate feature.

## 23. Failure behavior

### Host

- unknown Session -> 404;
- malformed Session id -> 400;
- no active Change -> ordinary empty response;
- binding/workspace mismatch -> 409;
- persistence corruption -> 500;
- no response may partially mutate Orven state.

### Client

- initial request failure -> error state with Retry;
- refresh failure after one valid graph -> stale state retaining the graph;
- Session switch aborts prior request;
- 304 retains current graph without rerender;
- malformed wire payload is rejected and shown as a Client error;
- disabling the Orven Bundle removes its panel and route through normal Cordis
  lifecycle.

## 24. Tests

### 24.1 Neutral graph UI

Existing Feature-14 tests remain Green.

Add tests only if Feature-21 requires a neutral graph projection fix.

### 24.2 Host adapter

Required:

1. route resolves a live Session and active Change;
2. route refuses arbitrary/missing Session ids;
3. no active Change returns the defined empty response;
4. route derives workspace from Session/binding, not browser input;
5. response contains the correct graph revision and active Change;
6. response coverage/Gate summary matches Orven status semantics;
7. matching `If-None-Match` returns 304;
8. graph revision change produces a new ETag;
9. route is removed on plugin disposal;
10. no Host route can mutate the graph.

### 24.3 Client controller

Required:

1. panel-open causes immediate load;
2. Session switch aborts and ignores old response;
3. 304 retains object/snapshot identity;
4. successful new revision updates explorer snapshot;
5. background/hidden panel stops polling;
6. visibility/panel restore resumes with immediate refresh;
7. refresh failure retains last good graph as stale;
8. disposal aborts work and timers.

### 24.4 Client composition

Required:

1. registers one `sidebar.panellist` entry;
2. registers one matching `main` keyed panel;
3. disposing the Client plugin removes both;
4. no selected Session renders no-session state;
5. active Session without Change renders empty state;
6. active Change renders summary + graph;
7. selected node renders detail inspector.

### 24.5 Distribution

Required:

- typecheck Green;
- lint Green;
- unit tests Green;
- real DSH Loader composition Green;
- packed `@orven/plugin-dsh` contains its browser client artifact;
- clean external consumer install Green;
- no public package count change;
- no `@orven/internal-*` imports leak into packed public runtime.

## 25. Acceptance demo

Starting point:

```powershell
.\scripts\orven-local.ps1 install
.\scripts\orven-local.ps1 run
```

In DSH Web:

1. open a coding Session for a Git workspace;
2. ask:

   ```text
   Add cache hit percentage to this project.
   ```

3. Feature-20 naturally guides the Agent into the Orven Change loop;
4. while work executes, click **Orven** in the sidebar;
5. see the active Change graph;
6. observe Criteria, Run(s), Artifacts and Evidence appear as the graph revision
   advances;
7. select a Criterion and inspect its relations;
8. select an Evidence node and inspect exact domain facts and source edges;
9. see the summary move from for example:

   ```text
   required 1/3 · Gate pending
   ```

   to:

   ```text
   required 3/3 · Gate satisfied
   ```

without reloading the page.

Returning to Conversation preserves the same Session.

## 26. Implementation plan

Implementation should be split into reviewable PRs after this Spec lands.

### PR A — Host graph bridge

- exact Connection Fetch route;
- versioned wire DTO;
- Session/active-Change resolution;
- coverage/Gate summary;
- ETag/304;
- Host tests.

### PR B — Client package surface

- `dsh.client` manifest;
- `./client` export;
- client bundling;
- sidebar/main registrations;
- controller + empty/loading/error states;
- DSH-native styling;
- Client tests.

### PR C — Graph integration and polish

- mount existing Orven graph explorer;
- summary header;
- node inspector;
- Session switching;
- revision-aware polling;
- accessibility;
- full external distribution verification.

A PR may combine adjacent steps when the diff remains easy to review, but the
architectural boundaries above should remain visible.

## 27. Completion criteria

Feature-21 is complete only when all are true:

- installing `@orven/plugin-dsh` adds the Orven Web panel automatically;
- the panel follows the selected Session's active Change;
- it renders the authoritative Orven graph, not reconstructed chat history;
- node/edge interaction works;
- Host policy/coverage truth is shown without browser re-derivation;
- revisions refresh while the panel is visible;
- no browser mutation API exists;
- disabling the Bundle removes both Host and Client surfaces cleanly;
- package distribution still exposes exactly two public Orven artifacts;
- all required CI and external distribution checks are Green.
