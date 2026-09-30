import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type { GraphId } from '@dsh-factory/core'
import { InMemoryEventStore } from '@dsh-factory/events'
import { JsonlEventStore } from '@dsh-factory/persistence'
import { DshExecutionAdapter } from './adapter.js'
import { Config, type Config as FactoryPluginConfig } from './config.js'
import { FactoryService } from './service.js'
import type { FactoryEventStore } from './store.js'

export * from './adapter.js'
export * from './config.js'
export * from './messages.js'
export * from './service.js'
export * from './store.js'

export const name = 'dsh-factory'
export const inject = ['agents']

declare module '@deepseek-ai/cordis' {
  interface Context {
    factory: FactoryService
  }
}

async function createEventStore(
  config: FactoryPluginConfig,
): Promise<FactoryEventStore> {
  if (config.graphId.trim() === '') {
    throw new Error('Factory graphId must be non-empty')
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
  config: FactoryPluginConfig = { graphId: 'factory' },
): Promise<void> {
  const store = await createEventStore(config)
  const service = new FactoryService(
    store,
    new DshExecutionAdapter(ctx.agents),
  )
  ctx.provide('factory', service)
}

void Config
