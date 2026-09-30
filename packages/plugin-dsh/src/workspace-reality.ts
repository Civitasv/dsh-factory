import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile, readlink, lstat } from 'node:fs/promises'
import { join } from 'node:path'
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
    const [rootText, head, unstaged, staged, status, untrackedText] = await Promise.all([
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
      git(workspace, [
        'ls-files',
        '--others',
        '--exclude-standard',
        '--full-name',
        '-z',
        '--',
        '.',
        ':(exclude).orven/**',
      ]),
    ])

    const root = rootText.trim()
    const untracked = untrackedText
      .split('\0')
      .filter(path => path.length > 0)
      .sort((left, right) => left.localeCompare(right))

    const digestBuilder = createHash('sha256')
      .update('git-working-tree-v1\0')
      .update(head)
      .update('\0')
      .update(unstaged)
      .update('\0')
      .update(staged)
      .update('\0')
      .update(status)

    for (const path of untracked) {
      const absolute = join(root, path)
      const stat = await lstat(absolute)
      digestBuilder.update('\0untracked\0').update(path).update('\0')
      if (stat.isSymbolicLink()) {
        digestBuilder.update('symlink\0').update(await readlink(absolute))
      } else {
        digestBuilder.update('file\0').update(await readFile(absolute))
      }
    }

    const digest = digestBuilder
      .digest('hex')

    const artifact: Artifact = {
      id: artifactId(digest),
      type: 'workspace-reality',
      uri: pathToFileURL(workspace).href,
      digest: `sha256:${digest}`,
      metadata: metadata({
        provider: 'git-working-tree-v1',
        workspace,
        repositoryRoot: root,
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
