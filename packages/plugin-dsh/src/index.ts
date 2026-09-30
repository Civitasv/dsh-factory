import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type { GraphId } from '@orven/core'
import { InMemoryEventStore } from '@orven/core/events'
import { JsonlEventStore } from '@orven/core/persistence'
import { DshExecutionAdapter } from './adapter.js'
import { Config, type Config as OrvenPluginConfig } from './config.js'
import { OrvenService } from './service.js'
import type { OrvenEventStore } from './store.js'

export * from './adapter.js'
export * from './config.js'
export * from './messages.js'
export * from './service.js'
export * from './store.js'

export const name = 'orven'
export const inject = ['agents']

declare module '@deepseek-ai/cordis' {
  interface Context {
    factory: OrvenService
  }
}

async function createEventStore(
  config: OrvenPluginConfig,
): Promise<OrvenEventStore> {
  if (config.graphId.trim() === '') {
    throw new Error('Orven graphId must be non-empty')
  }

  const graphId = config.graphId as GraphId
  if (config.persistenceDirectory === undefined) {
    return new InMemoryEventStore(graphId)
  }

  return await JsonlEventStore.open(
    resolve(config.persistenceDirectory),
    graphId,
  )
}

export async function apply(
  ctx: Context,
  config: OrvenPluginConfig = { graphId: 'orven' },
): Promise<void> {
  const store = await createEventStore(config)
  const service = new OrvenService(
    store,
    new DshExecutionAdapter(ctx.agents),
  )
  ctx.provide('factory', service)
}

void Config
