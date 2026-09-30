import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { GraphId } from '@orven/core'
import { InMemoryEventStore } from '@orven/core/events'
import { DshExecutionAdapter, type DshAgentPort } from './adapter.js'
import { OrvenService } from './service.js'
import { apply as applyTools } from './tools.js'

const signal = new AbortController().signal

function unusedAgentPort(): DshAgentPort {
  return {
    create: async () => {
      throw new Error('orven_execute is not part of this tool boundary test')
    },
  }
}

async function setup() {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SessionProjectionRegistry)

  const service = new OrvenService(
    new InMemoryEventStore('GRAPH-TOOLS' as GraphId),
    new DshExecutionAdapter(unusedAgentPort()),
    () => '2026-09-30T00:00:00Z',
  )
  ctx.provide('orven', service)
  applyTools(ctx)

  const session = Session.create(SessionId('orven-tools-test'))
  const agent = { session } as Agent
  let call = 0

  const execute = async (name: string, args: unknown) =>
    await ctx.tools.execute({
      signal,
      callId: ToolCallId(`orven-test-${++call}`),
      name,
      arguments: args,
      agent,
    })

  return { ctx, service, agent, execute }
}

describe('Orven model-facing DSH tools', () => {
  it('fails status explicitly before the Session has an active Change', async () => {
    const test = await setup()
    try {
      const result = await test.execute('orven_status', {})
      expect(result.isError).toBe(true)
      expect(JSON.stringify(result.content)).toContain(
        'no active Orven Change',
      )
    } finally {
      await test.ctx.fiber.dispose()
    }
  })

  it('creates, binds, and reads a durable Change through the real Tool Runtime', async () => {
    const test = await setup()
    try {
      const created = await test.execute('orven_begin_change', {
        title: 'Expose cache hit percentage',
        kind: 'feature',
        criteria: [
          {
            statement: 'The UI shows cache hit percentage.',
            severity: 'required',
          },
          {
            statement: 'Calculation behavior has verification coverage.',
            severity: 'recommended',
          },
        ],
      })

      if (created.isError) {
        throw new Error(JSON.stringify(created.error))
      }
      expect(created.value).toMatchObject({
        graphRevision: 10,
      })
      expect(
        (created.value as { criteria: unknown[] }).criteria,
      ).toHaveLength(2)

      const projected = test.ctx.sessionProjections.stateOf(
        test.agent.session,
        'orvenActiveChange',
      )
      expect(projected?.changeId).toBe(
        (created.value as { changeId: string }).changeId,
      )

      const status = await test.execute('orven_status', {})
      if (status.isError) {
        throw new Error(JSON.stringify(status.error))
      }
      expect(status.value).toMatchObject({
        title: 'Expose cache hit percentage',
        kind: 'feature',
        graphRevision: 10,
        runs: {
          total: 0,
          succeeded: 0,
          failed: 0,
          cancelled: 0,
        },
      })
      expect(
        (status.value as {
          criteria: Array<{
            evidence: {
              supporting: number
              contradicting: number
              inconclusive: number
              invalidated: number
            }
          }>
        }).criteria.map(item => item.evidence),
      ).toEqual([
        {
          supporting: 0,
          contradicting: 0,
          inconclusive: 0,
          invalidated: 0,
        },
        {
          supporting: 0,
          contradicting: 0,
          inconclusive: 0,
          invalidated: 0,
        },
      ])
      expect(test.service.snapshot().nodes.some(node =>
        node.kind === 'change'
        && node.value.title === 'Expose cache hit percentage'
      )).toBe(true)
    } finally {
      await test.ctx.fiber.dispose()
    }
  })
})
