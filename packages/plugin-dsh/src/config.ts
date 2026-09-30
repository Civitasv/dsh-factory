import Schema from '@deepseek-ai/schemastery'

export type OrvenOrchestrationMode = 'manual' | 'guided'

export interface Config {
  readonly graphId: string
  readonly persistenceDirectory?: string
  readonly orchestration?: OrvenOrchestrationMode
}

export const Config: Schema<Config> = Schema.object({
  graphId: Schema.string().pattern(/\S/u).default('orven'),
  persistenceDirectory: Schema.string().pattern(/\S/u),
  orchestration: Schema.union(['manual', 'guided']).default('guided'),
})
