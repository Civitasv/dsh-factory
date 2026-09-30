import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import { z } from 'zod'

export interface OrvenActiveChangeBinding {
  readonly changeId: string | null
  readonly workspace: string | null
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'orven/active-change': OrvenActiveChangeBinding
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    orvenActiveChange: OrvenActiveChangeBinding
  }
}

const bindingSchema = z.object({
  changeId: z.string().nullable(),
  workspace: z.string().nullable(),
})

export function registerOrvenSessionProjection(ctx: Context): void {
  ctx.sessionProjections.register<'orvenActiveChange', OrvenActiveChangeBinding>({
    key: 'orvenActiveChange',
    stateSchema: bindingSchema,
    init: header => ({
      changeId: null,
      workspace: header.cwd ?? null,
    }),
    apply: (state, event) => {
      if (event.type !== 'orven/active-change') return state
      return event.data
    },
    stateVersion: 1,
  })
}

export function readOrvenSessionBinding(
  ctx: Context,
  session: Session,
): OrvenActiveChangeBinding {
  return ctx.sessionProjections.stateOf(session, 'orvenActiveChange') ?? {
    changeId: null,
    workspace: session.header.cwd ?? null,
  }
}

export function bindOrvenSession(
  session: Session,
  binding: OrvenActiveChangeBinding,
): void {
  session.append('orven/active-change', binding)
}
