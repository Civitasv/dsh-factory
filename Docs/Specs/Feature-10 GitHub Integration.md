# Feature-10 GitHub Integration

## Objective

Bridge GitHub collaboration facts into DSH Factory without making GitHub Issues, Pull Requests, or branches the source of Factory domain state.

GitHub data enters Factory as immutable Artifacts and explicit Change proposals.

## Boundary

~~~text
GitHub API / Webhook
        |
        v
GitHub Integration
        |
        +--> immutable Artifact snapshot
        |
        +--> optional Change-intent proposal
        |
        v
Factory Event / Graph layers
~~~

GitHub remains an external system. Factory Change, Gate, Evidence, Work, and Run state are not reconstructed from mutable GitHub labels/status fields.

## Normalized snapshots

Feature-10 defines immutable normalized snapshots for:

- repository;
- Issue;
- Pull Request;
- commit.

Only stable, workflow-relevant fields are retained.

Issue snapshot includes repository, number, title, body, state, labels, URL, and updated timestamp.

Pull Request snapshot includes repository, number, title, body, state, head SHA, base SHA, merged state, URL, and updated timestamp.

Commit snapshot includes repository, SHA, message, URL.

## Artifact representation

GitHub snapshots become Factory Artifacts:

- `github/issue`
- `github/pull-request`
- `github/commit`

Artifact metadata contains the complete normalized snapshot.

Artifact digest and id are deterministically derived from canonical JSON of:

- Artifact semantic type;
- normalized snapshot.

Equivalent GitHub snapshots produce identical Artifact ids and digests regardless of label input ordering.

A changed GitHub snapshot produces a new immutable Artifact.

## Artifact metadata

Feature-10 extends the generic Artifact contract with optional JSON-compatible `metadata`.

This is not GitHub-specific state. It allows immutable external facts to travel with an Artifact while keeping the Artifact node self-contained for replay/context use.

## Issue -> Change proposal

A GitHub Issue may explicitly seed a Factory Change.

The caller must provide:

- target Change id;
- Change kind;
- actor.

The integration produces:

- Change;
- Issue Artifact;
- `has_intent` Relation from Change to the Issue Artifact.

It does not infer Change kind from labels.

The proposal is not appended automatically; it is a typed proposal for the Factory Event layer.

## Pull Requests and commits

PR and commit snapshots are captured as Artifacts only.

Feature-10 does not equate:

- PR open with Work running;
- PR merged with Change completed;
- branch state with Gate state.

Later integration logic may relate these Artifacts to Runs/Evidence using ordinary Factory semantics.

## Client port

Feature-10 defines a small GitHub read port:

- read Issue;
- read Pull Request;
- read commit.

Network authentication, Octokit choice, webhook server implementation, and retry transport remain outside the domain adapter.

A concrete host can implement this port using GitHub REST/GraphQL.

## Idempotency

Snapshot-to-Artifact conversion is content-addressed.

Repeated delivery of the same external snapshot is idempotent.

A later updated snapshot becomes a new Artifact rather than mutating prior GitHub history.

## Canonicalization

Canonicalization:

- sorts repository owner/name as provided after trimming;
- sorts/uniques Issue labels;
- normalizes absent bodies to null;
- preserves GitHub case-sensitive text content;
- serializes object keys deterministically.

## Invariants

- **GH-01 External system** — GitHub is not Factory domain truth.
- **GH-02 Immutable snapshot** — imported GitHub facts become immutable Artifacts.
- **GH-03 Content addressed** — equivalent snapshots map to identical Artifact ids/digests.
- **GH-04 No label inference** — Change kind is never inferred from labels.
- **GH-05 Explicit intent** — Issue-to-Change conversion uses an explicit proposal.
- **GH-06 No merge completion shortcut** — merged PR does not automatically complete a Change.
- **GH-07 Replayable metadata** — normalized snapshot is retained as Artifact metadata.
- **GH-08 Idempotent ingestion** — repeated identical snapshots do not create new identities.
- **GH-09 Transport separation** — GitHub HTTP/auth implementation is behind a port.
- **GH-10 Domain independence** — core remains free of GitHub package dependencies.

## Acceptance criteria

- Issue/PR/commit snapshots convert to deterministic Artifacts;
- Issue label order does not affect identity;
- changed Issue body/update time changes identity;
- Issue proposal produces Change + intent Artifact + has_intent Relation;
- caller-specified Change kind is preserved;
- PR merged state remains Artifact metadata only;
- invalid repository/number/SHA inputs are rejected;
- metadata is JSON-compatible and replayable.

## Implementation scope

Feature-10 includes:

- optional generic Artifact metadata;
- `packages/integration-github`;
- normalized GitHub snapshots;
- canonical content-addressed Artifact conversion;
- Issue-to-Change proposal;
- GitHub read-port interface;
- tests for idempotency, canonicalization, and proposal semantics.

## Non-goals

- webhook server;
- GitHub App authentication;
- PR creation/merge actions;
- issue comments;
- CI Check Run ingestion (Feature-11);
- branch protection;
- automatic Change completion.
