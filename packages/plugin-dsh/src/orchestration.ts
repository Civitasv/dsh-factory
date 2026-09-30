import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { OrvenOrchestrationMode } from './config.js'

export const ORVEN_GUIDANCE_SECTION = 'orven:change-loop'
export const ORVEN_GUIDANCE_ORDER = 8800

export const ORVEN_GUIDANCE_TEXT = [
  'Use Orven as the change-control loop for non-trivial requests that mutate the workspace.',
  'Before the first mutation, create a durable Change with observable acceptance Criteria using orven_begin_change unless this Session is already continuing the same active Change.',
  'Use orven_status to ground the current criteria, Evidence coverage, Gate state, and recorded Artifact ids.',
  'Prefer orven_execute for one concrete implementation or verification objective at a time; direct DSH tools remain allowed and their exact results are still captured as Artifacts while a Change is active.',
  'Attach only relevant recorded Artifact ids with orven_record_evidence. Never treat assistant prose, intention, or Run success alone as Evidence.',
  'Before claiming the task complete, call orven_status again. Report pending, contradicted, or conflicted required Criteria instead of declaring success.',
  'Do not create a Change for read-only questions or trivial tasks that do not modify the workspace.',
  'An Orven delegated worker executes its assigned objective directly and must not recursively call orven_begin_change or orven_execute.',
].join(' ')

export const ORVEN_MODEL_TOOLS = [
  'orven_begin_change',
  'orven_status',
  'orven_execute',
  'orven_record_evidence',
] as const

export function registerOrvenOrchestrationGuidance(
  ctx: Context,
  mode: OrvenOrchestrationMode,
): void {
  if (mode === 'manual') return

  ctx.systemPrompt.section({
    name: ORVEN_GUIDANCE_SECTION,
    order: ORVEN_GUIDANCE_ORDER,
    text: ({ scope }) =>
      ORVEN_MODEL_TOOLS.every(name => ctx.tools.get(name, scope) !== undefined)
        ? ORVEN_GUIDANCE_TEXT
        : '',
  })
}
