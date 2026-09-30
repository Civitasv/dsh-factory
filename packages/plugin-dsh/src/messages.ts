import { canonicalContextJson } from '@dsh-factory/context'
import type { PreparedExecution } from '@dsh-factory/execution'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'dsh-factory': {
      readonly kind: 'dsh-factory'
      readonly form: 'snapshot'
      readonly sections: readonly {
        readonly name: string
        readonly text: string
      }[]
    }
  }
}

export function factoryContextMessage(
  prepared: PreparedExecution,
): UserMessage {
  const text = canonicalContextJson(prepared.context.pack)
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: {
      kind: 'dsh-factory',
      form: 'snapshot',
      sections: [{ name: 'Factory ContextPack', text }],
    },
  })
}

export function factoryWorkMessage(
  prepared: PreparedExecution,
): UserMessage {
  return createUserMessage({
    content: [
      {
        type: 'text',
        text: [
          'Execute this DSH Factory Work objective against the injected Factory ContextPack.',
          '',
          prepared.work.objective,
        ].join('\n'),
      },
    ],
    source: { kind: 'user' },
  })
}
