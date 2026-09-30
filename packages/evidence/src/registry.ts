import type { Evidence, EvidenceKindId, JsonValue } from '@orven/internal-domain'

export interface EvidenceKindDefinition {
  readonly kind: EvidenceKindId
  readonly version: number
  readonly validatePayload: (payload: JsonValue) => void
}

export function evidenceKindKey(kind: EvidenceKindId, version: number): string {
  return `${kind}@${version}`
}

export class EvidenceRegistry {
  readonly #definitions = new Map<string, EvidenceKindDefinition>()

  register(definition: EvidenceKindDefinition): void {
    if (String(definition.kind).trim() === '') {
      throw new Error('Evidence kind must be non-empty')
    }
    if (!Number.isSafeInteger(definition.version) || definition.version <= 0) {
      throw new Error(`Evidence kind version must be a positive safe integer; got ${definition.version}`)
    }

    const key = evidenceKindKey(definition.kind, definition.version)
    if (this.#definitions.has(key)) {
      throw new Error(`Evidence kind ${key} is already registered`)
    }

    this.#definitions.set(key, definition)
  }

  has(kind: EvidenceKindId, version: number): boolean {
    return this.#definitions.has(evidenceKindKey(kind, version))
  }

  validate(evidence: Evidence): void {
    const key = evidenceKindKey(evidence.kind, evidence.kindVersion)
    const definition = this.#definitions.get(key)
    if (definition === undefined) {
      throw new Error(`Unknown Evidence kind ${key}`)
    }

    definition.validatePayload(evidence.payload)
  }
}
