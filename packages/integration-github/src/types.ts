import type {
  ActorRef,
  Artifact,
  Change,
  ChangeId,
  ChangeKind,
  Relation,
} from '@orven/internal-domain'

export interface GitHubRepositoryRef {
  readonly owner: string
  readonly name: string
}

export interface GitHubIssueSnapshot {
  readonly repository: GitHubRepositoryRef
  readonly number: number
  readonly title: string
  readonly body: string | null
  readonly state: 'open' | 'closed'
  readonly labels: readonly string[]
  readonly url: string
  readonly updatedAt: string
}

export interface GitHubPullRequestSnapshot {
  readonly repository: GitHubRepositoryRef
  readonly number: number
  readonly title: string
  readonly body: string | null
  readonly state: 'open' | 'closed'
  readonly headSha: string
  readonly baseSha: string
  readonly merged: boolean
  readonly url: string
  readonly updatedAt: string
}

export interface GitHubCommitSnapshot {
  readonly repository: GitHubRepositoryRef
  readonly sha: string
  readonly message: string
  readonly url: string
}

export interface GitHubReadPort {
  readIssue(
    repository: GitHubRepositoryRef,
    number: number,
  ): Promise<GitHubIssueSnapshot>

  readPullRequest(
    repository: GitHubRepositoryRef,
    number: number,
  ): Promise<GitHubPullRequestSnapshot>

  readCommit(
    repository: GitHubRepositoryRef,
    sha: string,
  ): Promise<GitHubCommitSnapshot>
}

export interface GitHubIssueChangeProposalInput {
  readonly snapshot: GitHubIssueSnapshot
  readonly changeId: ChangeId
  readonly kind: ChangeKind
  readonly actor: ActorRef
  readonly createdAt: string
}

export interface GitHubIssueChangeProposal {
  readonly change: Change
  readonly intent: Artifact
  readonly relation: Relation
}
