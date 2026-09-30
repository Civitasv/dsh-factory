import Schema from '@deepseek-ai/schemastery'

export interface Config {
  readonly graphId: string
  readonly persistenceDirectory?: string
}

export const Config: Schema<Config> = Schema.object({
  graphId: Schema.string().pattern(/\S/u).default('orven'),
  persistenceDirectory: Schema.string().pattern(/\S/u),
})
