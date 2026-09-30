import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-tools'
import type { GraphId } from '@orven/core'
import { InMemoryEventStore } from '@orven/core/events'
import { JsonlEventStore } from '@orven/core/persistence'
import { DshExecutionAdapter } from './adapter.js'
import { Config, type Config as OrvenPluginConfig } from './config.js'
import { registerOrvenSessionProjection } from './session-binding.js'
import { OrvenService } from './service.js'
import type { OrvenEventStore } from './store.js'
import { registerOrvenModelTools } from './tools.js'

export * from './adapter.js'
export * from './change-loop.js'
export * from './config.js'
export * from './messages.js'
export * from './service.js'
export * from './session-binding.js'
export * from './store.js'
export * from './workspace-reality.js'

export const name = 'orven'
export const inject = ['agents', 'tools', 'sessionProjections']

declare module '@deepseek-ai/cordis' {
  interface Context {
    orven: OrvenService
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

async function ensureWorkspacePersistenceDirectory(
  workspace: string,
): Promise<string> {
  const directory = join(workspace, '.orven')
  await mkdir(directory, { recursive: true })
  try {
    await writeFile(join(directory, '.gitignore'), '*\n', {
      encoding: 'utf8',
      flag: 'wx',
    })
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    ) {
      throw error
    }
  }
  return directory
}

export async function apply(
  ctx: Context,
  config: OrvenPluginConfig = { graphId: 'orven' },
): Promise<void> {
  const graphId = config.graphId as GraphId
  const store = await createEventStore(config)
  const executor = new DshExecutionAdapter(ctx.agents)
  const clock = (): string => new Date().toISOString()
  const service = new OrvenService(
    store,
    executor,
    clock,
    config.persistenceDirectory === undefined
      ? {
          workspaceStoreFactory: async workspace => {
            const directory = await ensureWorkspacePersistenceDirectory(workspace)
            return await JsonlEventStore.open(directory, graphId)
          },
        }
      : {},
  )

  registerOrvenSessionProjection(ctx)
  registerOrvenModelTools(ctx, service)
  ctx.provide('orven', service)
}

void Config
