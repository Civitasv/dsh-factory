import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session } from '@deepseek-ai/dsh-session'
import type { PreparedExecution } from '@orven/core/execution'
import { DshRuntimeOutcomeCollector } from './collector.js'

type Handler = (...args: any[]) => unknown

function collectorHarness() {
  const handlers = new Map<string, Handler[]>()
  const ctx = {
    on: (event: string, handler: Handler) => {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
      return () => {}
    },
  } as unknown as Context

  const collector = new DshRuntimeOutcomeCollector(
    ctx,
    () => '2026-09-30T00:00:00Z',
  )

  const emit = (event: string, ...args: unknown[]) => {
    for (const handler of handlers.get(event) ?? []) handler(...args)
  }

  return { collector, emit }
}

function agent(id: string): Agent {
  return {
    session: { id } as unknown as Session,
  } as unknown as Agent
}

function execution(id: string): PreparedExecution {
  return {
    executionId: id as never,
  } as unknown as PreparedExecution
}

describe('DshRuntimeOutcomeCollector', () => {
  it('isolates exact child Agent observations and emits Run-scoped Evidence', async () => {
    const { collector, emit } = collectorHarness()
    const child = agent('child')
    const parent = agent('parent')

    emit('tools/result', {
      agent: parent,
      name: 'read',
      callId: 'parent-call',
      arguments: { file_path: 'parent.txt' },
    }, {
      isError: false,
      content: [{ type: 'text', text: 'parent' }],
      value: { text: 'parent' },
    })

    emit('tools/result', {
      agent: child,
      name: 'read',
      callId: 'child-call',
      arguments: { file_path: 'child.txt' },
    }, {
      isError: false,
      content: [{ type: 'text', text: 'child' }],
      value: { text: 'child' },
    })

    emit('session/event', parent.session, {
      type: 'turn/end',
      data: { reason: { kind: 'failed' } },
    })
    emit('session/event', child.session, {
      type: 'turn/end',
      data: { reason: { kind: 'completed' } },
    })

    const outcome = await collector.collect(
      child,
      execution('exec:child:1'),
    )

    expect(outcome.status).toBe('succeeded')
    expect(outcome.artifacts).toHaveLength(1)
    expect(outcome.evidence).toHaveLength(1)

    const artifact = outcome.artifacts[0]!
    expect(artifact.type).toBe('dsh/tool-result')
    expect(artifact.metadata).toMatchObject({
      tool: 'read',
      callId: 'child-call',
      isError: false,
    })

    const evidence = outcome.evidence[0]!
    expect(String(evidence.kind)).toBe('factory/runtime-observation')
    expect(evidence.result).toBe('supports')
    expect(evidence.sources).toEqual([
      { artifact: { id: artifact.id }, role: 'raw_output' },
    ])
    expect(evidence.reality.targets).toEqual([{ id: artifact.id }])
    expect(evidence.subjects).toEqual([
      {
        kind: 'node',
        node: {
          kind: 'run',
          id: 'run:exec:child:1',
        },
      },
    ])
    expect(
      evidence.subjects.some(subject => subject.kind === 'criterion_revision'),
    ).toBe(false)
  })

  it.each([
    ['aborted', 'cancelled'],
    ['failed', 'failed'],
  ] as const)('maps turn/end %s to %s', async (reason, expected) => {
    const { collector, emit } = collectorHarness()
    const child = agent('child')

    emit('session/event', child.session, {
      type: 'turn/end',
      data: { reason: { kind: reason } },
    })

    const outcome = await collector.collect(
      child,
      execution('exec:terminal:1'),
    )

    expect(outcome.status).toBe(expected)
  })

  it('fails closed when collection sees no durable turn/end', async () => {
    const { collector } = collectorHarness()
    const child = agent('child')

    const outcome = await collector.collect(
      child,
      execution('exec:missing-end:1'),
    )

    expect(outcome.status).toBe('failed')
    expect(outcome.diagnostics).toContain('failed closed')
  })
})
