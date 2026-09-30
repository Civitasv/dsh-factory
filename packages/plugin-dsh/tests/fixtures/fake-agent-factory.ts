import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  AgentFactory,
  AgentHandle,
  CreateAgentOptions,
  ResumeAgentOptions,
} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent'

export const name = 'orven-loader-test-agent-factory'
export const inject = ['agents']

export function apply(ctx: Context): void {
  const factory: AgentFactory = {
    createAgent: async (
      _ownerCtx: Context,
      _options: CreateAgentOptions,
    ): Promise<AgentHandle> => {
      const log: string[] = []
      const agent = {
        inject: () => { log.push('inject') },
        followup: () => { log.push('followup') },
        whenIdle: async () => { log.push('idle') },
        cancel: () => { log.push('cancel') },
        __orvenLoaderLog: log,
      } as unknown as Agent

      return {
        agent,
        dispose: async () => { log.push('dispose') },
      }
    },
    resume: async (
      _ownerCtx: Context,
      _options: ResumeAgentOptions,
    ): Promise<AgentHandle> => {
      throw new Error('Factory loader smoke does not resume agents')
    },
  }

  ctx.effect(
    () => ctx.agents.setFactory(factory),
    'orven-loader-test-agent-factory',
  )
}
