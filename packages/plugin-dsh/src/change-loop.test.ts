import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import {
  SESSION_FORMAT_VERSION,
  Session,
  SessionId,
  type SessionEvent,
} from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {
  ToolExecution,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools'
import type {
  ActorRef,
  Artifact,
  ArtifactId,
  ChangeId,
  EventId,
  GraphId,
} from '@orven/core'
import { InMemoryEventStore } from '@orven/core/events'
import { JsonlEventStore } from '@orven/core/persistence'
import {
  beginChange,
  ExecutionCaptureRegistry,
  recordEvidence,
  recordObservedToolArtifact,
  status,
} from './change-loop.js'
import { captureWorkspaceReality } from './workspace-reality.js'
import { DshExecutionAdapter, type DshAgentPort } from './adapter.js'
import { OrvenService } from './service.js'

const graphId = 'orven-test' as GraphId

function fakeExecutor(): DshExecutionAdapter {
  const port: DshAgentPort = {
    create: async () => {
      throw new Error('DSH execution is unused in this test')
    },
  }
  return new DshExecutionAdapter(port)
}

function bindingFrom(session: Session): { changeId: string | null; workspace: string | null } {
  const event = [...session.snapshotEvents()]
    .reverse()
    .find((item: SessionEvent) => item.type === 'orven/active-change')
  return event?.type === 'orven/active-change'
    ? event.data
    : { changeId: null, workspace: session.header.cwd ?? null }
}

function context(): Context {
  return {
    sessionProjections: {
      stateOf: (session: Session) => bindingFrom(session),
    },
    logger: {
      warn: () => {},
    },
  } as unknown as Context
}

function agent(workspace: string): Agent {
  const id = SessionId('orven-test-session')
  const session = Session.create(
    id,
    undefined,
    {
      version: SESSION_FORMAT_VERSION,
      id,
      createdAt: 0,
      cwd: workspace,
      isSeeded: false,
    },
  )
  return {
    id,
    session,
    options: {},
  } as unknown as Agent
}

function rootWithWorkspaceStore(): OrvenService {
  return new OrvenService(
    new InMemoryEventStore(graphId),
    fakeExecutor(),
    () => '2026-09-30T00:00:00.000Z',
    {
      workspaceStoreFactory: async workspace =>
        await JsonlEventStore.open(join(workspace, '.orven'), graphId),
    },
  )
}

describe('DSH durable Change loop', () => {
  it('reopens workspace-local graph state from JSONL persistence', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'orven-workspace-'))
    try {
      const actor: ActorRef = { kind: 'system', id: 'test' }
      const id = 'change:persisted' as ChangeId

      const first = await rootWithWorkspaceStore().forWorkspace(workspace)
      await first.append({
        changeId: id,
        expectedSequence: 0,
        actor,
        events: [{
          eventId: 'event:persisted' as EventId,
          occurredAt: '2026-09-30T00:00:00.000Z',
          event: {
            type: 'change.created',
            change: {
              id,
              kind: 'feature',
              title: 'Persist me',
              createdAt: '2026-09-30T00:00:00.000Z',
              createdBy: actor,
            },
          },
        }],
      })

      const reopened = await rootWithWorkspaceStore().forWorkspace(workspace)
      expect(reopened.snapshot().nodes.some(node =>
        node.kind === 'change' && node.value.id === id,
      )).toBe(true)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('begins a Change with Criteria/Gate and reaches satisfied coverage only after Artifact-backed Evidence', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'orven-change-'))
    try {
      const ctx = context()
      const caller = agent(workspace)
      const root = rootWithWorkspaceStore()

      const begun = await beginChange(ctx, root, caller, {
        title: 'Add cache hit percent',
        criteria: [
          { statement: 'Cache hit percent is visible', severity: 'required' },
          { statement: 'Calculation is covered by tests', severity: 'required' },
        ],
      })

      const service = await root.forWorkspace(workspace)
      const snapshot = service.snapshot()
      expect(snapshot.nodes.filter(node => node.kind === 'change')).toHaveLength(1)
      expect(snapshot.nodes.filter(node => node.kind === 'criterion')).toHaveLength(2)
      expect(snapshot.nodes.filter(node => node.kind === 'gate')).toHaveLength(1)
      expect(snapshot.relations.filter(edge => edge.kind === 'has_criterion')).toHaveLength(2)
      expect(snapshot.relations.filter(edge => edge.kind === 'evaluates')).toHaveLength(2)

      const before = await status(ctx, root, caller)
      expect(before.gateState).toBe('pending')
      expect(before.coverage).toEqual({ requiredComplete: 0, requiredTotal: 2 })

      const artifact: Artifact = {
        id: 'artifact:test-output' as ArtifactId,
        type: 'dsh-tool-result',
        metadata: { tool: 'bash', exitCode: 0 },
        createdAt: '2026-09-30T00:00:00.000Z',
        createdBy: { kind: 'agent', id: String(caller.id) },
      }
      await service.append({
        changeId: begun.changeId as ChangeId,
        expectedSequence: service.currentSequence(begun.changeId as ChangeId),
        actor: { kind: 'agent', id: String(caller.id) },
        events: [{
          eventId: 'event:test-output' as EventId,
          occurredAt: '2026-09-30T00:00:00.000Z',
          event: { type: 'artifact.recorded', artifact },
        }],
      })

      await recordEvidence(ctx, root, caller, {
        criterionId: begun.criterionIds[0] as string,
        artifactIds: [String(artifact.id)],
        claim: 'The captured test output supports the first Criterion.',
        result: 'supports',
      })
      await recordEvidence(ctx, root, caller, {
        criterionId: begun.criterionIds[1] as string,
        artifactIds: [String(artifact.id)],
        claim: 'The captured test output supports the second Criterion.',
        result: 'supports',
      })

      const after = await status(ctx, root, caller)
      expect(after.gateState).toBe('satisfied')
      expect(after.coverage).toEqual({ requiredComplete: 2, requiredTotal: 2 })
      expect(after.criteria.every(item => item.complete)).toBe(true)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('treats recommended-only Criteria as non-blocking for Gate readiness', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'orven-recommended-'))
    try {
      const ctx = context()
      const caller = agent(workspace)
      const root = rootWithWorkspaceStore()
      await beginChange(ctx, root, caller, {
        title: 'Recommended-only change',
        criteria: [
          { statement: 'Optional polish is desirable', severity: 'recommended' },
        ],
      })

      const current = await status(ctx, root, caller)
      expect(current.coverage).toEqual({ requiredComplete: 0, requiredTotal: 0 })
      expect(current.gateState).toBe('satisfied')
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('changes workspace reality when untracked file content changes', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'orven-reality-'))
    try {
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const { writeFile } = await import('node:fs/promises')
      const run = promisify(execFile)
      await run('git', ['-C', workspace, 'init'])
      await run('git', ['-C', workspace, 'config', 'user.email', 'orven@example.test'])
      await run('git', ['-C', workspace, 'config', 'user.name', 'Orven Test'])
      await writeFile(join(workspace, 'tracked.txt'), 'base\n')
      await run('git', ['-C', workspace, 'add', 'tracked.txt'])
      await run('git', ['-C', workspace, 'commit', '-m', 'base'])

      await writeFile(join(workspace, 'untracked.txt'), 'one\n')
      const actor: ActorRef = { kind: 'system', id: 'reality-test' }
      const first = await captureWorkspaceReality(
        workspace,
        '2026-09-30T00:00:00.000Z',
        actor,
      )

      await writeFile(join(workspace, 'untracked.txt'), 'two\n')
      const second = await captureWorkspaceReality(
        workspace,
        '2026-09-30T00:00:01.000Z',
        actor,
      )

      expect(first.provider).toBe('git-working-tree-v1')
      expect(second.provider).toBe('git-working-tree-v1')
      expect(second.artifact.id).not.toBe(first.artifact.id)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('rejects Evidence that cites an unrecorded Artifact', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'orven-evidence-'))
    try {
      const ctx = context()
      const caller = agent(workspace)
      const root = rootWithWorkspaceStore()
      const begun = await beginChange(ctx, root, caller, {
        title: 'Reject invented evidence',
        criteria: [{ statement: 'Must have real observations' }],
      })

      await expect(recordEvidence(ctx, root, caller, {
        criterionId: begun.criterionIds[0] as string,
        artifactIds: ['artifact:does-not-exist'],
        claim: 'Invented source',
        result: 'supports',
      })).rejects.toThrow('does not exist')
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('captures ordinary DSH tool results as Artifacts for the active Change', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'orven-capture-'))
    try {
      const ctx = context()
      const caller = agent(workspace)
      const root = rootWithWorkspaceStore()
      await beginChange(ctx, root, caller, {
        title: 'Capture observations',
        criteria: [{ statement: 'Observe an exact command result' }],
      })

      const exec = {
        callId: 'call-1',
        rootCallId: 'call-1',
        name: 'bash',
        arguments: { command: 'echo hello' },
        agent: caller,
      } as unknown as ToolExecution
      const result = {
        isError: false,
        value: { exitCode: 0, stdout: 'hello\n' },
        content: [{ type: 'text', text: 'hello' }],
      } as unknown as ToolExecutionResult

      await recordObservedToolArtifact(
        ctx,
        root,
        new ExecutionCaptureRegistry(),
        exec,
        result,
      )

      const observed = await status(ctx, root, caller)
      expect(observed.capturedArtifactIds).toHaveLength(1)
      const service = await root.forWorkspace(workspace)
      const artifactNode = service.snapshot().nodes.find(node =>
        node.kind === 'artifact' && node.value.type === 'dsh-tool-result',
      )
      expect(artifactNode?.kind).toBe('artifact')
      if (artifactNode?.kind === 'artifact') {
        expect(artifactNode.value.metadata).toMatchObject({
          tool: 'bash',
          callId: 'call-1',
        })
      }
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })
})
