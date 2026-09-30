# Domain Model

## First-class concepts

The foundational vocabulary is intentionally small:

- **Change** — durable intent to alter software behavior or structure.
- **Artifact** — a concrete input/output such as a requirement, commit, build, log, screenshot, trace, or deployment.
- **Evidence** — a structured claim backed by artifacts and an observed result.
- **Finding** — a mismatch between intended and observed reality.
- **Decision** — an explicit choice that affects the Change.
- **Gate** — a policy/verifiability boundary derived from requirements and evidence.
- **Run** — one execution attempt by a worker/runtime.
- **Relation** — a typed semantic edge in the Change graph.
- **ContextPack** — the task-specific, provenance-bearing input compiled for one execution objective.

Agents are intentionally absent from this list. Workers are selected by capability and may disappear after a Run.

## Change

A Change is not a Jira-style mutable status record. It owns identity, intent, acceptance criteria, constraints, hierarchy, and version. Operational state is projected from the event stream.

## Evidence

Artifacts and Evidence are separate. A video is an Artifact; a statement that the video demonstrates an acceptance criterion on a specific build is Evidence.

A satisfied or failed Gate must carry Evidence. `not_required` is a policy result and does not require fake evidence.

## Finding

Findings cover bugs, requirement gaps, performance regressions, test failures, security findings, UX findings, release failures, and production regressions.

A Finding that reveals an unrequested behavior should normally create or relate to another Change rather than silently expand scope.

## Relations

Relations are semantic edges such as:

- `implements`
- `verifies`
- `invalidates`
- `depends_on`
- `produces`
- `caused_by`
- `fixes`
- `supersedes`
- `derived_from`
- `blocks`
- `observed_on`
- `satisfies`

The exact persistence schema remains a later spec. The TypeScript types in `packages/core` establish vocabulary, not storage format.
