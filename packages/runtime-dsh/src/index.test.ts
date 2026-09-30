import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, DshExecutionAdapter, inject, name } from './index.js'

describe('DSH runtime plugin', () => {
  it('declares stable plugin identity and the public agents dependency', () => {
    expect(name).toBe('dsh-factory')
    expect(inject).toEqual(['agents'])
  })

  it('publishes the Factory runtime service over the injected agents port', () => {
    let provided: unknown
    const ctx = {
      agents: { create: async () => { throw new Error('unused') } },
      provide: (key: string, value: unknown) => {
        expect(key).toBe('dshFactoryRuntime')
        provided = value
      },
    } as unknown as Context

    apply(ctx)

    expect(provided).toBeInstanceOf(DshExecutionAdapter)
  })
})
