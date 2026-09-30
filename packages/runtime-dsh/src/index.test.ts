import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { createRuntimeBinding, name } from './index.js'

describe('DSH runtime adapter', () => {
  it('exposes a stable namespace-plugin name', () => {
    expect(name).toBe('dsh-factory')
  })

  it('keeps DSH ownership behind a runtime binding', () => {
    const binding = createRuntimeBinding({} as Context)
    expect(binding).toEqual({ runtime: 'dsh' })
  })
})
