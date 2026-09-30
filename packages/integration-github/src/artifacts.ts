import { createHash } from 'node:crypto'
import type {
  ActorRef,
  Artifact,
  ArtifactId,
  JsonValue,
} from '@dsh-factory/core'
import type {
  GitHubCommitSnapshot,
  GitHubIssueSnapshot,
  GitHubPullRequestSnapshot,
  GitHubRepositoryRef,
} from './types.js'

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('GitHub snapshot contains non-finite number')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const key of Object.keys(value).sort(compareText)) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== undefined) result[key] = canonicalize(child)
    }
    return result
  }
  throw new Error('GitHub snapshot contains non-JSON value')
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function validateRepository(repository: GitHubRepositoryRef): GitHubRepositoryRef {
  const owner = repository.owner.trim()
  const name = repository.name.trim()
  if (owner === '' || name === '') throw new Error('GitHub repository owner/name must be non-empty')
  return { owner, name }
}

function validateNumber(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`)
  }
  return value
}

function validateSha(value: string, label: string): string {
  const sha = value.trim()
  if (!/^[0-9a-fA-F]{7,64}$/.test(sha)) {
    throw new Error(`${label} must be a 7-64 character hexadecimal SHA`)
  }
  return sha.toLowerCase()
}

export function normalizeIssue(
  snapshot: GitHubIssueSnapshot,
): GitHubIssueSnapshot {
  return {
    repository: validateRepository(snapshot.repository),
    number: validateNumber(snapshot.number, 'GitHub Issue number'),
    title: snapshot.title,
    body: snapshot.body ?? null,
    state: snapshot.state,
    labels: [...new Set(snapshot.labels.map(label => label.trim()).filter(Boolean))].sort(compareText),
    url: snapshot.url,
    updatedAt: snapshot.updatedAt,
  }
}

export function normalizePullRequest(
  snapshot: GitHubPullRequestSnapshot,
): GitHubPullRequestSnapshot {
  return {
    repository: validateRepository(snapshot.repository),
    number: validateNumber(snapshot.number, 'GitHub Pull Request number'),
    title: snapshot.title,
    body: snapshot.body ?? null,
    state: snapshot.state,
    headSha: validateSha(snapshot.headSha, 'GitHub Pull Request headSha'),
    baseSha: validateSha(snapshot.baseSha, 'GitHub Pull Request baseSha'),
    merged: snapshot.merged,
    url: snapshot.url,
    updatedAt: snapshot.updatedAt,
  }
}

export function normalizeCommit(
  snapshot: GitHubCommitSnapshot,
): GitHubCommitSnapshot {
  return {
    repository: validateRepository(snapshot.repository),
    sha: validateSha(snapshot.sha, 'GitHub commit SHA'),
    message: snapshot.message,
    url: snapshot.url,
  }
}

function artifact(
  type: string,
  snapshot: JsonValue,
  url: string,
  createdAt: string,
  actor: ActorRef,
): Artifact {
  const serialized = canonicalJson({ type, snapshot })
  const digest = createHash('sha256').update(serialized).digest('hex')
  return {
    id: `artifact:github:${digest}` as ArtifactId,
    type,
    uri: url,
    digest: `sha256:${digest}`,
    metadata: snapshot,
    createdAt,
    createdBy: actor,
  }
}

export function issueArtifact(
  snapshot: GitHubIssueSnapshot,
  actor: ActorRef,
): Artifact {
  const normalized = normalizeIssue(snapshot)
  return artifact(
    'github/issue',
    normalized as unknown as JsonValue,
    normalized.url,
    normalized.updatedAt,
    actor,
  )
}

export function pullRequestArtifact(
  snapshot: GitHubPullRequestSnapshot,
  actor: ActorRef,
): Artifact {
  const normalized = normalizePullRequest(snapshot)
  return artifact(
    'github/pull-request',
    normalized as unknown as JsonValue,
    normalized.url,
    normalized.updatedAt,
    actor,
  )
}

export function commitArtifact(
  snapshot: GitHubCommitSnapshot,
  actor: ActorRef,
  createdAt: string,
): Artifact {
  const normalized = normalizeCommit(snapshot)
  return artifact(
    'github/commit',
    normalized as unknown as JsonValue,
    normalized.url,
    createdAt,
    actor,
  )
}

export function githubSnapshotDigest(type: string, snapshot: unknown): string {
  return createHash('sha256')
    .update(canonicalJson({ type, snapshot }))
    .digest('hex')
}
