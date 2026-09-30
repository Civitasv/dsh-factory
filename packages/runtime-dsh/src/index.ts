import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import { DshExecutionAdapter } from './adapter.js'

export * from './adapter.js'
export * from './messages.js'

export const name = 'dsh-factory'
export const inject = ['agents']

declare module '@deepseek-ai/cordis' {
  interface Context {
    dshFactoryRuntime: DshExecutionAdapter
  }
}

export function apply(ctx: Context): void {
  ctx.provide('dshFactoryRuntime', new DshExecutionAdapter(ctx.agents))
}
