import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-factory'

export interface DshFactoryRuntimeBinding {
  readonly runtime: 'dsh'
}

export function createRuntimeBinding(_ctx: Context): DshFactoryRuntimeBinding {
  return { runtime: 'dsh' }
}

export function apply(ctx: Context): void {
  createRuntimeBinding(ctx)
}
