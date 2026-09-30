import { describe, expect, it } from 'vitest'
import type { ActorRef, ChangeId } from '@orven/internal-domain'
import {
  commitArtifact,
  issueArtifact,
  proposeChangeFromIssue,
  pullRequestArtifact,
  type GitHubIssueSnapshot,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'github' }

function issue(labels: readonly string[] = ['feature', 'ui']): GitHubIssueSnapshot {
  return {
    repository: { owner: 'Civitasv', name: 'dsh-factory' },
    number: 12,
    title: 'Graph-first workflow',
    body: 'Build it',
    state: 'open',
    labels,
    url: 'https://github.com/Civitasv/dsh-factory/issues/12',
    updatedAt: '2026-09-30T00:00:00Z',
  }
}

describe('GitHub Artifact normalization', () => {
  it('is idempotent across Issue label ordering and duplicates', () => {
    const left = issueArtifact(issue(['ui', 'feature', 'ui']), actor)
    const right = issueArtifact(issue(['feature', 'ui']), actor)

    expect(left.id).toBe(right.id)
    expect(left.digest).toBe(right.digest)
  })

  it('creates a new immutable Artifact when an Issue snapshot changes', () => {
    const left = issueArtifact(issue(), actor)
    const right = issueArtifact({ ...issue(), body: 'Changed' }, actor)
    expect(left.id).not.toBe(right.id)
  })

  it('retains PR merged state as metadata only', () => {
    const artifact = pullRequestArtifact(
      {
        repository: { owner: 'Civitasv', name: 'dsh-factory' },
        number: 4,
        title: 'Feature',
        body: null,
        state: 'closed',
        headSha: 'a'.repeat(40),
        baseSha: 'b'.repeat(40),
        merged: true,
        url: 'https://github.com/Civitasv/dsh-factory/pull/4',
        updatedAt: '2026-09-30T00:00:00Z',
      },
      actor,
    )

    expect(artifact.type).toBe('github/pull-request')
    expect(artifact.metadata).toMatchObject({ merged: true })
  })

  it('rejects invalid commit SHAs', () => {
    expect(() =>
      commitArtifact(
        {
          repository: { owner: 'Civitasv', name: 'dsh-factory' },
          sha: 'not-a-sha',
          message: 'bad',
          url: 'https://github.com/Civitasv/dsh-factory/commit/nope',
        },
        actor,
        '2026-09-30T00:00:00Z',
      ),
    ).toThrow('hexadecimal SHA')
  })
})

describe('Issue Change proposal', () => {
  it('uses explicit Change kind and produces has_intent relation', () => {
    const proposal = proposeChangeFromIssue({
      snapshot: issue(),
      changeId: 'CHG-12' as ChangeId,
      kind: 'experiment',
      actor,
      createdAt: '2026-09-30T00:01:00Z',
    })

    expect(proposal.change.kind).toBe('experiment')
    expect(proposal.change.title).toBe('Graph-first workflow')
    expect(proposal.intent.type).toBe('github/issue')
    expect(proposal.relation.kind).toBe('has_intent')
    expect(proposal.relation.target).toEqual({
      kind: 'artifact',
      id: proposal.intent.id,
    })
  })
})
