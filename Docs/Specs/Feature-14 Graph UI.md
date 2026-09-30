# Feature-14 Graph UI

## Objective

Provide a graph-first browser presentation for the DSH Factory Change Graph.

The UI must make topology visible as topology. It must not render a sequential transcript and merely attach relationship labels.

~~~text
Change Graph Snapshot
        |
        v
Graph View Model
        |
        v
Deterministic 2D Layout
        |
        v
Interactive SVG Explorer
~~~

The UI is a projection only. It owns no durable Factory truth.

## Presentation boundary

Feature-14 may own:

- graph layout;
- viewport/pan/zoom state;
- selected node;
- presentation filters;
- detail-panel expansion;
- local action menus.

Feature-14 must not own:

- Change state;
- Gate state;
- Evidence validity;
- Work state;
- Run state;
- graph persistence;
- domain mutations.

Every domain fact comes from a supplied `ChangeGraphSnapshot`.

## Graph view model

The UI converts the heterogeneous graph into explicit presentation nodes and edges.

A View Node contains:

- domain `GraphNodeRef`;
- semantic node kind;
- title;
- compact subtitle;
- deterministic x/y position;
- incoming/outgoing relation counts.

A View Edge contains:

- Relation id;
- Relation kind;
- source/target node refs;
- source/target coordinates.

No graph edge is synthesized from visual proximity.

## Node labels

Baseline titles/subtitles:

- Change — title / kind;
- Criterion — stable Criterion id / latest revision summary when available;
- Artifact — Artifact type / id;
- Evidence — claim / result;
- Finding — Finding type / severity;
- Decision — question / outcome;
- Gate — Gate kind / latest evaluation state when available;
- Run — objective / status.

Long labels are truncated for the canvas while the full domain value remains available in the detail pane.

## Layout

The first layout is deterministic, dependency-free, and cycle-safe.

Algorithm:

1. choose the requested root Change, otherwise the first Change, otherwise first node;
2. traverse the graph as an undirected connectivity graph to assign shortest-distance layers;
3. preserve actual directed Relation direction for rendered edges;
4. sort nodes inside each layer by canonical `kind:id`;
5. place layers left-to-right;
6. place nodes top-to-bottom within each layer;
7. place disconnected nodes in deterministic trailing layers.

Because layering is based on connectivity rather than topological sort, legal global cycles never break layout.

Back-edges and cross-layer edges remain visible.

## Edge rendering

Every active Relation is rendered as a directed SVG path with:

- arrow marker;
- semantic Relation label;
- stable Relation id in DOM metadata.

Selected-node incident edges receive a presentation emphasis state.

The UI does not collapse multiple Relations between the same nodes.

## Interaction

### Selection

Clicking or keyboard-activating a node selects it.

Selection:

- highlights the node;
- highlights incident edges;
- opens/updates the detail pane;
- calls optional `onSelectNode`.

Selection is local presentation state.

### Pan and zoom

The graph viewport supports:

- pointer-drag pan;
- wheel zoom centered on the pointer;
- bounded zoom scale;
- Fit control to restore a computed full-graph viewport.

Pan/zoom never alters layout coordinates or graph facts.

### Keyboard

Focusable graph nodes expose button semantics.

- Enter/Space selects a focused node.
- Escape clears selection when focus is in the explorer.

The root explorer surface has an accessible label.

## Detail pane

The detail pane displays:

- full node title;
- node kind/id;
- domain JSON;
- incoming Relations;
- outgoing Relations.

The pane is derived from the current View Model.

It may expose caller-provided action buttons.

## Action extension

Feature-14 does not hard-code Product/Developer/QA actions.

Callers may supply:

~~~text
actionsForNode(node) -> GraphUiAction[]
onAction(action, node)
~~~

This allows later orchestration UI to expose commands such as:

- inspect context;
- create Work;
- reproduce Finding;
- re-run verification;

without moving those semantics into the graph renderer.

## Snapshot updates

The explorer accepts a complete replacement Snapshot.

On update:

- rebuild View Model deterministically;
- retain selection only if the selected node still exists;
- retain local viewport where practical;
- never diff/mutate domain objects in place.

## Revision visibility

The UI displays:

- Graph id;
- Graph Revision.

This makes it explicit which world state the user is inspecting.

## Empty graph

An empty Snapshot renders an explicit empty state rather than a broken SVG.

## Styling

Feature-14 provides minimal self-contained styles with semantic visual distinction between node kinds and selected/incident state.

Styles are presentation tokens only and are not domain semantics.

Consumers may override CSS custom properties/classes.

## Browser dependency

The renderer uses standard DOM/SVG APIs and has no React/Vue framework dependency.

The pure View Model/layout package remains testable in Node without a DOM.

## Invariants

- **UI-01 Projection only** — UI never owns durable domain state.
- **UI-02 Real topology** — every rendered edge corresponds to a Relation.
- **UI-03 Directed edges** — Relation direction remains visible.
- **UI-04 Multi-edge safe** — parallel Relations are preserved.
- **UI-05 Cycle safe** — legal graph cycles do not break layout.
- **UI-06 Deterministic layout** — equivalent snapshots produce equivalent coordinates regardless of input array order.
- **UI-07 Revision visible** — inspected Graph Revision is explicit.
- **UI-08 Local selection** — selection never mutates Change Graph.
- **UI-09 Accessible nodes** — nodes are keyboard focusable/selectable.
- **UI-10 Extensible actions** — orchestration actions enter through callbacks, not renderer-owned workflow logic.

## Acceptance criteria

- equivalent Snapshot ordering produces identical View Model;
- all active Relations render exactly once;
- cyclic graphs lay out without recursion/topological errors;
- disconnected nodes receive deterministic positions;
- selected node returns full incoming/outgoing Relations;
- browser renderer creates SVG nodes and directed edges;
- click and keyboard activation select a node;
- pan/zoom/fit operate only on viewport state;
- action callbacks receive exact selected Graph Node;
- empty Snapshot renders an explicit empty state.

## Implementation scope

Feature-14 includes:

- `packages/graph-ui`;
- deterministic graph View Model;
- cycle-safe layered layout;
- browser SVG renderer;
- selection/detail pane;
- pan/zoom/fit controls;
- keyboard interaction;
- action extension callbacks;
- pure layout/View Model tests.

## Non-goals

- graph mutation;
- freeform node dragging/reparenting;
- GraphQL server;
- collaborative cursors;
- persisted UI state;
- orchestration implementation;
- design-system framework dependency;
- production hosting application.
