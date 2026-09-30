import { canonicalContextJson } from '@orven/core/context'
import type { PreparedExecution } from '@orven/core/execution'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'orven': {
      readonly kind: 'orven'
      readonly form: 'snapshot'
      readonly sections: readonly {
        readonly name: string
        readonly text: string
      }[]
    }
  }
}

export function orvenContextMessage(
  prepared: PreparedExecution,
): UserMessage {
  const text = canonicalContextJson(prepared.context.pack)
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: {
      kind: 'orven',
      form: 'snapshot',
      sections: [{ name: 'Factory ContextPack', text }],
    },
  })
}

export function orvenWorkMessage(
  prepared: PreparedExecution,
): UserMessage {
  return createUserMessage({
    content: [
      {
        type: 'text',
        text: [
          'Execute this Orven Work objective against the injected Factory ContextPack.',
          '',
          prepared.work.objective,
        ].join('\n'),
      },
    ],
    source: { kind: 'user' },
  })
}
