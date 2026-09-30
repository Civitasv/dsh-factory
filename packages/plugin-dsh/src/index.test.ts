import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import {
  apply,
  Config,
  FactoryService,
  inject,
  name,
} from './index.js'

describe('DSH Factory plugin', () => {
  it('declares the namespace-plugin contract', () => {
    expect(name).toBe('dsh-factory')
    expect(inject).toEqual(['agents'])
    expect(Config).toBeDefined()
  })

  it('publishes ctx.factory only after service construction', async () => {
    let key = ''
    let provided: unknown
    const ctx = {
      agents: {
        create: async () => {
          throw new Error('unused')
        },
      },
      provide: (nextKey: string, value: unknown) => {
        key = nextKey
        provided = value
        return () => {}
      },
    } as unknown as Context

    await apply(ctx, { graphId: 'plugin-test' })

    expect(key).toBe('factory')
    expect(provided).toBeInstanceOf(FactoryService)
  })
})
