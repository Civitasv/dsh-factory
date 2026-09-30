import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { PromptSection } from '@deepseek-ai/dsh-system-prompt'
import {
  ORVEN_GUIDANCE_ORDER,
  ORVEN_GUIDANCE_SECTION,
  ORVEN_GUIDANCE_TEXT,
  ORVEN_MODEL_TOOLS,
  registerOrvenOrchestrationGuidance,
} from './orchestration.js'

function fixture(visible: readonly string[] = ORVEN_MODEL_TOOLS): {
  readonly ctx: Context
  readonly sections: PromptSection[]
} {
  const sections: PromptSection[] = []
  const names = new Set(visible)
  const ctx = {
    tools: {
      get: (name: string) => names.has(name) ? { name } : undefined,
    },
    systemPrompt: {
      section: (section: PromptSection) => {
        sections.push(section)
        return () => {}
      },
    },
  } as unknown as Context
  return { ctx, sections }
}

describe('Orven guided orchestration', () => {
  it('registers one guidance section in guided mode', () => {
    const { ctx, sections } = fixture()
    registerOrvenOrchestrationGuidance(ctx, 'guided')

    expect(sections).toHaveLength(1)
    expect(sections[0]?.name).toBe(ORVEN_GUIDANCE_SECTION)
    expect(sections[0]?.order).toBe(ORVEN_GUIDANCE_ORDER)
    expect(typeof sections[0]?.text).toBe('function')
    const text = typeof sections[0]?.text === 'function'
      ? sections[0].text({})
      : sections[0]?.text
    expect(text).toBe(ORVEN_GUIDANCE_TEXT)
    expect(text).toContain('Never treat assistant prose')
    expect(text).toContain('must not recursively call')
  })

  it('registers no section in manual mode', () => {
    const { ctx, sections } = fixture()
    registerOrvenOrchestrationGuidance(ctx, 'manual')
    expect(sections).toEqual([])
  })

  it('renders empty guidance when one Orven tool is not visible in the agent scope', () => {
    const { ctx, sections } = fixture(ORVEN_MODEL_TOOLS.slice(0, -1))
    registerOrvenOrchestrationGuidance(ctx, 'guided')

    const text = sections[0]?.text
    expect(typeof text).toBe('function')
    if (typeof text !== 'function') throw new Error('expected dynamic guidance')
    expect(text({})).toBe('')
  })
})
