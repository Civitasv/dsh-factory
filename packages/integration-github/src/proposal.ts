import { createHash } from 'node:crypto'
import type { RelationId } from '@dsh-factory/core'
import { issueArtifact, normalizeIssue } from './artifacts.js'
import type {
  GitHubIssueChangeProposal,
  GitHubIssueChangeProposalInput,
} from './types.js'

export function proposeChangeFromIssue(
  input: GitHubIssueChangeProposalInput,
): GitHubIssueChangeProposal {
  const snapshot = normalizeIssue(input.snapshot)
  const intent = issueArtifact(snapshot, input.actor)
  const relationDigest = createHash('sha256')
    .update(`${input.changeId}:${intent.id}:has_intent`)
    .digest('hex')

  return {
    change: {
      id: input.changeId,
      kind: input.kind,
      title: snapshot.title,
      createdAt: input.createdAt,
      createdBy: input.actor,
    },
    intent,
    relation: {
      id: `relation:github-intent:${relationDigest}` as RelationId,
      source: { kind: 'change', id: input.changeId },
      target: { kind: 'artifact', id: intent.id },
      kind: 'has_intent',
      createdAt: input.createdAt,
      createdBy: input.actor,
    },
  }
}
