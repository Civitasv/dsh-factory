import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-session-projection/types'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z } from 'zod'
import type {
  ChangeId,
  ChangeKind,
} from '@orven/core'
import type { ChangeStatus } from '@orven/core/application'
import type { CapabilityId } from '@orven/core/work'
import { DshRuntimeOutcomeCollector } from './collector.js'
import type { OrvenService } from './service.js'

export const name = 'orven-tools'
export const inject = ['orven', 'tools', 'sessionProjections']

declare module '@deepseek-ai/cordis' {
  interface Context {
    orven: OrvenService
  }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'orven/active-change': {
      readonly changeId: string | null
    }
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    orvenActiveChange: {
      readonly changeId: string | null
    }
  }
}

const activeChangeSchema = z.object({
  changeId: z.string().nullable(),
}).strict()

export const orvenActiveChangeProjection = {
  key: 'orvenActiveChange',
  stateVersion: 1,
  stateSchema: activeChangeSchema,
  init: () => ({ changeId: null }),
  apply: (
    state: { readonly changeId: string | null },
    event: { readonly type: string; readonly data: unknown },
  ) => {
    if (event.type !== 'orven/active-change') return state
    const data = event.data as { readonly changeId: string | null }
    return { changeId: data.changeId }
  },
}

const CHANGE_KINDS = [
  'feature',
  'bugfix',
  'refactor',
  'performance',
  'incident',
  'security',
  'maintenance',
  'experiment',
] as const satisfies readonly ChangeKind[]

const DSH_AGENT_CAPABILITY = 'orven.dsh.agent' as CapabilityId

function requireAgent(
  agent: Agent | undefined,
  tool: string,
): Agent {
  if (agent === undefined) {
    throw new Error(`${tool} requires an owning DSH Agent Session`)
  }
  return agent
}

function activeChange(ctx: Context, agent: Agent): ChangeId {
  const state = ctx.sessionProjections.stateOf(
    agent.session,
    'orvenActiveChange',
  )
  if (state?.changeId === null || state?.changeId === undefined) {
    throw new Error(
      'This DSH Session has no active Orven Change. Call orven_begin_change first.',
    )
  }
  return state.changeId as ChangeId
}

function bindChange(agent: Agent, changeId: ChangeId): void {
  agent.session.append('orven/active-change', {
    changeId: String(changeId),
  })
}

const criterionOutput = {
  type: 'object',
  additionalProperties: false,
  properties: {
    criterionId: { type: 'string', required: true },
    revision: { type: 'integer', required: true },
    statement: { type: 'string', required: true },
    severity: {
      type: 'string',
      required: true,
      enum: ['required', 'recommended'],
    },
  },
} as const

const evidenceFactsOutput = {
  type: 'object',
  additionalProperties: false,
  properties: {
    supporting: { type: 'integer', required: true },
    contradicting: { type: 'integer', required: true },
    inconclusive: { type: 'integer', required: true },
    invalidated: { type: 'integer', required: true },
  },
} as const

const statusOutput = {
  type: 'object',
  additionalProperties: false,
  properties: {
    changeId: { type: 'string', required: true },
    graphRevision: { type: 'integer', required: true },
    title: { type: 'string', required: true },
    kind: { type: 'string', required: true, enum: [...CHANGE_KINDS] },
    criteria: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...criterionOutput.properties,
          evidence: { ...evidenceFactsOutput, required: true },
        },
      },
    },
    gates: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          gateId: { type: 'string', required: true },
          kind: { type: 'string', required: true },
          state: {
            type: 'string',
            required: true,
            enum: ['pending', 'passed', 'failed', 'not_required'],
          },
          evidenceCount: { type: 'integer', required: true },
        },
      },
    },
    runs: {
      type: 'object',
      required: true,
      additionalProperties: false,
      properties: {
        total: { type: 'integer', required: true },
        succeeded: { type: 'integer', required: true },
        failed: { type: 'integer', required: true },
        cancelled: { type: 'integer', required: true },
        latest: {
          type: 'object',
          additionalProperties: false,
          properties: {
            runId: { type: 'string', required: true },
            status: {
              type: 'string',
              required: true,
              enum: ['succeeded', 'failed', 'cancelled'],
            },
            objective: { type: 'string', required: true },
            startedAt: { type: 'string', required: true },
            finishedAt: { type: 'string', required: true },
          },
        },
      },
    },
    disposition: {
      type: 'string',
      enum: ['completed', 'cancelled', 'superseded', 'rejected'],
    },
  },
} as const

function serializeStatus(status: ChangeStatus) {
  return {
    changeId: String(status.changeId),
    graphRevision: Number(status.graphRevision),
    title: status.title,
    kind: status.kind,
    criteria: status.criteria.map(criterion => ({
      criterionId: String(criterion.criterionId),
      revision: criterion.revision,
      statement: criterion.statement,
      severity: criterion.severity,
      evidence: { ...criterion.evidence },
    })),
    gates: status.gates.map(gate => ({
      gateId: String(gate.gateId),
      kind: gate.kind,
      state: gate.state,
      evidenceCount: gate.evidenceCount,
    })),
    runs: {
      total: status.runs.total,
      succeeded: status.runs.succeeded,
      failed: status.runs.failed,
      cancelled: status.runs.cancelled,
      ...(status.runs.latest === undefined
        ? {}
        : {
            latest: {
              runId: String(status.runs.latest.runId),
              status: status.runs.latest.status,
              objective: status.runs.latest.objective,
              startedAt: status.runs.latest.startedAt,
              finishedAt: status.runs.latest.finishedAt,
            },
          }),
    },
    ...(status.disposition === undefined
      ? {}
      : { disposition: status.disposition }),
  }
}

type ToolStatus = ReturnType<typeof serializeStatus>

function renderStatus(status: ToolStatus): string {
  const supporting = status.criteria.reduce(
    (total, criterion) => total + criterion.evidence.supporting,
    0,
  )
  return [
    `Orven Change: ${status.title} (${status.changeId})`,
    `Graph Revision: ${status.graphRevision}`,
    `Criteria: ${status.criteria.length}; criterion-scoped supporting Evidence: ${supporting}`,
    `Runs: ${status.runs.total} total, ${status.runs.succeeded} succeeded, ${status.runs.failed} failed, ${status.runs.cancelled} cancelled`,
    `Gates: ${status.gates.map(gate => `${gate.kind}=${gate.state}`).join(', ') || 'none'}`,
  ].join('\n')
}

function actorFor(agent: Agent) {
  return {
    kind: 'agent' as const,
    id: `dsh:${String(agent.session.id)}`,
  }
}

export function apply(ctx: Context): void {
  ctx.sessionProjections.register(orvenActiveChangeProjection as never)
  const collector = new DshRuntimeOutcomeCollector(ctx)

  ctx.tools.register(defineTool({
    name: 'orven_begin_change',
    description:
      'Create and durably bind an Orven Change for this DSH Session. '
      + 'Use this when the user asks for a concrete software change that should be tracked through acceptance criteria and execution.',
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: 'Short durable title for the software change.',
      },
      kind: {
        type: 'string',
        required: true,
        enum: [...CHANGE_KINDS],
        description: 'Change classification.',
      },
      criteria: {
        type: 'array',
        required: true,
        description: 'Concrete acceptance criteria for the Change.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            statement: {
              type: 'string',
              required: true,
              description: 'One observable acceptance criterion.',
            },
            severity: {
              type: 'string',
              enum: ['required', 'recommended'],
              description: 'Defaults to required.',
            },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          changeId: { type: 'string', required: true },
          graphRevision: { type: 'integer', required: true },
          gateId: { type: 'string', required: true },
          criteria: {
            type: 'array',
            required: true,
            items: criterionOutput,
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text:
          `Created Orven Change ${value.changeId} at Graph Revision ${value.graphRevision} `
          + `with ${value.criteria.length} acceptance criteria. It is now active for this DSH Session.`,
      }],
    },
    async execute(args, exec) {
      const agent = requireAgent(exec.agent, 'orven_begin_change')
      const created = await ctx.orven.beginChange({
        title: args.title,
        kind: args.kind,
        criteria: args.criteria.map(criterion => ({
          statement: criterion.statement,
          ...(criterion.severity === undefined
            ? {}
            : { severity: criterion.severity }),
        })),
        actor: actorFor(agent),
      })
      bindChange(agent, created.changeId)
      return {
        changeId: String(created.changeId),
        graphRevision: Number(created.graphRevision),
        gateId: String(created.gateId),
        criteria: created.criteria.map(criterion => ({
          criterionId: String(criterion.criterionId),
          revision: criterion.revision,
          statement: criterion.statement,
          severity: criterion.severity,
        })),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'orven_status',
    description:
      'Read the durable status of this DSH Session\'s active Orven Change. '
      + 'Evidence counts are facts, not an automatic claim that a Criterion or Gate is satisfied.',
    parameters: {},
    output: {
      schema: statusOutput,
      render: (_args, value) => [{
        type: 'text',
        text: renderStatus(value),
      }],
    },
    async execute(_args, exec) {
      const agent = requireAgent(exec.agent, 'orven_status')
      return serializeStatus(ctx.orven.status(activeChange(ctx, agent)))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'orven_execute',
    description:
      'Derive current Work for this DSH Session\'s active Orven Change and execute it through a child DSH Agent. '
      + 'The completed Run and raw normalized DSH tool observations are recorded durably. '
      + 'Run success does not by itself satisfy acceptance Criteria.',
    parameters: {
      objective: {
        type: 'string',
        description:
          'Optional execution objective. Omit to derive an objective from the active Change and its current Criteria.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          changeId: { type: 'string', required: true },
          executionId: { type: 'string', required: true },
          state: {
            type: 'string',
            required: true,
            enum: ['succeeded', 'failed', 'cancelled', 'stale'],
          },
          graphRevision: { type: 'integer', required: true },
          runId: { type: 'string' },
          artifactCount: { type: 'integer', required: true },
          evidenceCount: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text:
          `Orven execution ${value.executionId} finished ${value.state}. `
          + `Graph Revision: ${value.graphRevision}; Artifacts: ${value.artifactCount}; Evidence: ${value.evidenceCount}. `
          + 'Use orven_status to inspect the current Change.',
      }],
    },
    async execute(args, exec) {
      const agent = requireAgent(exec.agent, 'orven_execute')
      const changeId = activeChange(ctx, agent)
      const work = ctx.orven.deriveWork({
        changeId,
        requiredCapabilities: [DSH_AGENT_CAPABILITY],
        ...(args.objective?.trim()
          ? { objective: args.objective.trim() }
          : {}),
      })
      const result = await ctx.orven.executeWork({
        work,
        worker: {
          id: 'orven:dsh-agent',
          capabilities: [DSH_AGENT_CAPABILITY],
          maxParallel: 1,
        },
        availableCapabilities: [DSH_AGENT_CAPABILITY],
        attempt: 1,
        collector,
        signal: exec.signal,
      })

      if (result.state === 'stale') {
        return {
          changeId: String(changeId),
          executionId: String(result.executionId),
          state: result.state,
          graphRevision: Number(result.actualRevision),
          artifactCount: 0,
          evidenceCount: 0,
        }
      }

      const recorded = await ctx.orven.recordExecution({
        changeId,
        result,
        actor: actorFor(agent),
      })
      return {
        changeId: String(changeId),
        executionId: String(result.executionId),
        state: result.state,
        graphRevision: Number(recorded.graphRevision),
        runId: String(recorded.runId),
        artifactCount: result.artifacts.length,
        evidenceCount: result.evidence.length,
      }
    },
  }))
}
