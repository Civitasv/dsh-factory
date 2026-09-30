import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ChangeKind } from '@orven/core'
import type { OrvenService } from './service.js'
import {
  beginChange,
  executeChangeWork,
  ExecutionCaptureRegistry,
  recordEvidence,
  recordObservedToolArtifact,
  status,
} from './change-loop.js'

type DshJsonValue =
  | null
  | boolean
  | number
  | string
  | DshJsonValue[]
  | { [key: string]: DshJsonValue }

function outputRecord(value: unknown): Record<string, DshJsonValue> {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new Error('Orven tool result is not JSON-serializable')
  }
  const parsed = JSON.parse(serialized) as unknown
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Orven tool result must be an object')
  }
  return parsed as Record<string, DshJsonValue>
}

const genericOutput = {
  schema: {
    type: 'object',
    additionalProperties: true,
  } as const,
  render: (_args: unknown, value: DshJsonValue) => [{
    type: 'text' as const,
    text: JSON.stringify(value, null, 2),
  }],
}

export function registerOrvenModelTools(
  ctx: Context,
  service: OrvenService,
): void {
  const captures = new ExecutionCaptureRegistry()

  ctx.on('tools/result', (exec, result) => {
    void recordObservedToolArtifact(
      ctx,
      service,
      captures,
      exec,
      result,
    ).catch((error: unknown) => {
      ctx.logger.warn('Orven tool-result capture failed: %s', String(error))
    })
  })

  ctx.tools.register(defineTool({
    name: 'orven_begin_change',
    description:
      'Begin a durable Orven software Change for the current workspace. Use it for a non-trivial implementation, bugfix, refactor, or other software change before executing work. Provide explicit acceptance Criteria.',
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: 'Short title describing the software change.',
      },
      kind: {
        type: 'string',
        enum: [
          'feature',
          'bugfix',
          'refactor',
          'performance',
          'incident',
          'security',
          'maintenance',
          'experiment',
        ],
        description: 'Change kind. Defaults to feature.',
      },
      criteria: {
        type: 'array',
        required: true,
        description: 'Acceptance criteria for the Change.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            statement: {
              type: 'string',
              required: true,
              description: 'Observable acceptance statement.',
            },
            severity: {
              type: 'string',
              enum: ['required', 'recommended'],
              description: 'Whether this Criterion blocks readiness.',
            },
          },
        },
      },
    },
    output: genericOutput,
    async execute(args, exec) {
      return outputRecord(await beginChange(ctx, service, exec.agent, {
        title: args.title,
        ...(args.kind === undefined
          ? {}
          : { kind: args.kind as ChangeKind }),
        criteria: args.criteria.map(item => ({
          statement: item.statement,
          ...(item.severity === undefined
            ? {}
            : { severity: item.severity }),
        })),
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'orven_status',
    description:
      'Read the active Orven Change for this DSH Session: criteria, current Artifact-backed Evidence coverage, derived Gate state, recent captured tool-result Artifacts, and graph revision.',
    parameters: {},
    output: genericOutput,
    async execute(_args, exec) {
      return outputRecord(await status(ctx, service, exec.agent))
    },
    isConcurrencySafe: () => true,
  }))

  ctx.tools.register(defineTool({
    name: 'orven_record_evidence',
    description:
      'Attach an explicit Artifact-backed Evidence claim to one Criterion of the active Orven Change. Use only Artifact ids returned by Orven status/execute or otherwise already recorded; assistant prose alone is not Evidence.',
    parameters: {
      criterionId: {
        type: 'string',
        required: true,
        description: 'Criterion id from orven_status.',
      },
      artifactIds: {
        type: 'array',
        required: true,
        description: 'Recorded Artifact ids that are the raw sources for this Evidence.',
        items: { type: 'string' },
      },
      claim: {
        type: 'string',
        required: true,
        description: 'Precise claim supported, contradicted, or left inconclusive by the sources.',
      },
      result: {
        type: 'string',
        required: true,
        enum: ['supports', 'contradicts', 'inconclusive'],
        description: 'Observed relationship between the sources and Criterion claim.',
      },
    },
    output: genericOutput,
    async execute(args, exec) {
      return outputRecord(await recordEvidence(ctx, service, exec.agent, {
        criterionId: args.criterionId,
        artifactIds: args.artifactIds,
        claim: args.claim,
        result: args.result,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'orven_execute',
    description:
      'Delegate one objective from the active Orven Change to a fresh DSH worker in the same workspace. Orven records the accepted Run and exact worker tool-result Artifacts. It does not automatically claim those Artifacts satisfy a Criterion.',
    parameters: {
      objective: {
        type: 'string',
        required: true,
        description: 'Concrete implementation or verification objective for the delegated worker.',
      },
    },
    output: genericOutput,
    async execute(args, exec) {
      return outputRecord(await executeChangeWork(
        ctx,
        service,
        captures,
        exec.agent,
        args.objective,
        exec.signal,
      ))
    },
  }))
}
