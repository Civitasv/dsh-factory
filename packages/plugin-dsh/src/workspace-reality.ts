import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import type {
  ActorRef,
  Artifact,
  ArtifactId,
  EvidenceReality,
  JsonValue,
} from '@orven/core'

const execFileAsync = promisify(execFile)

export interface WorkspaceRealitySnapshot {
  readonly artifact: Artifact
  readonly reality: EvidenceReality
  readonly provider: 'git-working-tree-v1' | 'path-only-v1'
}

async function git(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const result = await execFileAsync(
    'git',
    ['-C', cwd, ...args],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return result.stdout
}

function artifactId(digest: string): ArtifactId {
  return `artifact:workspace:${digest}` as ArtifactId
}

function metadata(value: Record<string, JsonValue>): JsonValue {
  return value
}

export async function captureWorkspaceReality(
  workspace: string,
  createdAt: string,
  createdBy: ActorRef,
): Promise<WorkspaceRealitySnapshot> {
  try {
    const [root, head, unstaged, staged, status] = await Promise.all([
      git(workspace, ['rev-parse', '--show-toplevel']),
      git(workspace, ['rev-parse', 'HEAD']),
      git(workspace, [
        'diff',
        '--binary',
        '--no-ext-diff',
        'HEAD',
        '--',
        '.',
        ':(exclude).orven/**',
      ]),
      git(workspace, [
        'diff',
        '--binary',
        '--cached',
        '--no-ext-diff',
        'HEAD',
        '--',
        '.',
        ':(exclude).orven/**',
      ]),
      git(workspace, [
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
        '--',
        '.',
        ':(exclude).orven/**',
      ]),
    ])

    const digest = createHash('sha256')
      .update('git-working-tree-v1\0')
      .update(head)
      .update('\0')
      .update(unstaged)
      .update('\0')
      .update(staged)
      .update('\0')
      .update(status)
      .digest('hex')

    const artifact: Artifact = {
      id: artifactId(digest),
      type: 'workspace-reality',
      uri: pathToFileURL(workspace).href,
      digest: `sha256:${digest}`,
      metadata: metadata({
        provider: 'git-working-tree-v1',
        workspace,
        repositoryRoot: root.trim(),
        head: head.trim(),
        dirty: status.length > 0,
      }),
      createdAt,
      createdBy,
    }

    return {
      artifact,
      reality: {
        targets: [{ id: artifact.id }],
        environment: [],
        configuration: [],
      },
      provider: 'git-working-tree-v1',
    }
  } catch {
    const digest = createHash('sha256')
      .update('path-only-v1\0')
      .update(workspace)
      .digest('hex')

    const artifact: Artifact = {
      id: artifactId(digest),
      type: 'workspace-reality',
      uri: pathToFileURL(workspace).href,
      digest: `sha256:${digest}`,
      metadata: metadata({
        provider: 'path-only-v1',
        workspace,
      }),
      createdAt,
      createdBy,
    }

    return {
      artifact,
      reality: {
        targets: [{ id: artifact.id }],
        environment: [],
        configuration: [],
      },
      provider: 'path-only-v1',
    }
  }
}
