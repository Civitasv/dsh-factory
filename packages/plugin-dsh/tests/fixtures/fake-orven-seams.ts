import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-tools'

export const name = 'orven-loader-test-seams'

export function apply(ctx: Context): void {
  ctx.provide('tools', {
    register: () => () => {},
  } as unknown as Context['tools'])

  ctx.provide('sessionProjections', {
    register: () => () => {},
    stateOf: () => undefined,
  } as unknown as Context['sessionProjections'])
}
