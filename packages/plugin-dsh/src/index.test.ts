import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ActorRef,
  ChangeId,
  EventId,
} from '@orven/core'
import {
  apply,
  Config,
  OrvenService,
  inject,
  name,
} from './index.js'

describe('Orven plugin', () => {
  it('declares the namespace-plugin contract', () => {
    expect(name).toBe('orven')
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
    expect(provided).toBeInstanceOf(OrvenService)
  })

  it('opens the JSONL Event Store when persistenceDirectory is configured', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-factory-plugin-'))
    try {
      let service: OrvenService | undefined
      const ctx = {
        agents: {
          create: async () => {
            throw new Error('unused')
          },
        },
        provide: (_key: string, value: unknown) => {
          service = value as OrvenService
          return () => {}
        },
      } as unknown as Context

      await apply(ctx, {
        graphId: 'persistent-plugin-test',
        persistenceDirectory: directory,
      })

      if (service === undefined) throw new Error('Factory service was not published')

      const actor: ActorRef = { kind: 'system', id: 'test' }
      const changeId = 'CHG-PERSIST' as ChangeId
      await service.append({
        changeId,
        expectedSequence: 0,
        actor,
        events: [
          {
            eventId: 'EVT-PERSIST-1' as EventId,
            occurredAt: '2026-09-30T00:00:00Z',
            event: {
              type: 'change.created',
              change: {
                id: changeId,
                kind: 'feature',
                title: 'Persistent plugin',
                createdAt: '2026-09-30T00:00:00Z',
                createdBy: actor,
              },
            },
          },
        ],
      })

      expect(await readFile(join(directory, 'graph.json'), 'utf8'))
        .toContain('persistent-plugin-test')
      expect(await readFile(join(directory, 'events.jsonl'), 'utf8'))
        .toContain('change.created')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
