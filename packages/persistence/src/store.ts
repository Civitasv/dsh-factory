import { mkdir, open, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  asEventOffset,
  asGraphRevision,
  type ChangeGraphSnapshot,
  type ChangeId,
  type EventId,
  type GraphId,
  type GraphRevision,
} from '@dsh-factory/core'
import {
  assertEventLogConsistency,
  ConcurrencyConflictError,
  projectChangeGraph,
  type AppendRequest,
  type DomainEvent,
  type EventEnvelope,
} from '@dsh-factory/events'

const FORMAT_VERSION = 1
const METADATA_FILE = 'graph.json'
const EVENTS_FILE = 'events.jsonl'
const TEMP_EVENTS_FILE = 'events.jsonl.tmp'

interface GraphMetadata {
  readonly formatVersion: number
  readonly graphId: string
}

async function readTextIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return undefined
    }
    throw error
  }
}

function parseMetadata(text: string): GraphMetadata {
  const value = JSON.parse(text) as Partial<GraphMetadata>
  if (value.formatVersion !== FORMAT_VERSION) {
    throw new Error(
      `Unsupported Factory persistence format version ${String(value.formatVersion)}`,
    )
  }
  if (typeof value.graphId !== 'string' || value.graphId.trim() === '') {
    throw new Error('Factory persistence metadata has an invalid graphId')
  }
  return { formatVersion: FORMAT_VERSION, graphId: value.graphId }
}

function parseEvents(text: string): EventEnvelope[] {
  if (text.trim() === '') return []

  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, index) => {
      try {
        return JSON.parse(line) as EventEnvelope
      } catch (error) {
        throw new Error(
          `Invalid JSON in Factory Event Log line ${index + 1}: ${String(error)}`,
        )
      }
    })
}

async function atomicWrite(path: string, text: string): Promise<void> {
  const temporary = join(dirname(path), TEMP_EVENTS_FILE)
  const handle = await open(temporary, 'w')
  try {
    await handle.writeFile(text, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, path)
}

async function initializeMetadata(path: string, graphId: GraphId): Promise<void> {
  const metadata: GraphMetadata = {
    formatVersion: FORMAT_VERSION,
    graphId: String(graphId),
  }
  const temporary = `${path}.tmp`
  const handle = await open(temporary, 'w')
  try {
    await handle.writeFile(`${JSON.stringify(metadata)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, path)
}

export class JsonlEventStore {
  readonly #events: EventEnvelope[]
  readonly #eventIds = new Set<EventId>()
  readonly #changeSequences = new Map<ChangeId, number>()
  #writeTail: Promise<void> = Promise.resolve()

  private constructor(
    readonly directory: string,
    readonly graphId: GraphId,
    events: readonly EventEnvelope[],
  ) {
    this.#events = [...events]
    for (const event of events) {
      this.#eventIds.add(event.eventId)
      if (event.changeId !== undefined && event.sequence !== undefined) {
        this.#changeSequences.set(event.changeId, event.sequence)
      }
    }
  }

  static async open(directory: string, graphId: GraphId): Promise<JsonlEventStore> {
    await mkdir(directory, { recursive: true })

    const metadataPath = join(directory, METADATA_FILE)
    const metadataText = await readTextIfPresent(metadataPath)
    if (metadataText === undefined) {
      await initializeMetadata(metadataPath, graphId)
    } else {
      const metadata = parseMetadata(metadataText)
      if (metadata.graphId !== String(graphId)) {
        throw new Error(
          `Factory persistence Graph id mismatch: stored ${metadata.graphId}, requested ${graphId}`,
        )
      }
    }

    const eventText = await readTextIfPresent(join(directory, EVENTS_FILE))
    const events = parseEvents(eventText ?? '')
    assertEventLogConsistency(graphId, events)

    return new JsonlEventStore(directory, graphId, events)
  }

  currentSequence(changeId: ChangeId): number {
    return this.#changeSequences.get(changeId) ?? 0
  }

  currentRevision(): GraphRevision {
    return asGraphRevision(this.#events.at(-1)?.offset ?? 0)
  }

  readAll(): readonly EventEnvelope[] {
    return [...this.#events]
  }

  project(): ChangeGraphSnapshot {
    return projectChangeGraph(this.graphId, this.#events)
  }

  append(request: AppendRequest): Promise<readonly EventEnvelope[]> {
    const operation = this.#writeTail.then(() => this.#appendNow(request))
    this.#writeTail = operation.then(
      () => undefined,
      () => undefined,
    )
    return operation
  }

  async #appendNow(request: AppendRequest): Promise<readonly EventEnvelope[]> {
    if (request.events.length === 0) {
      throw new Error('Append requires at least one event')
    }

    const changeId = request.changeId
    const expectedSequence = request.expectedSequence

    if (changeId === undefined && expectedSequence !== undefined) {
      throw new Error('expectedSequence requires changeId')
    }
    if (changeId !== undefined && expectedSequence === undefined) {
      throw new Error('Change-owned append requires expectedSequence')
    }

    if (changeId !== undefined && expectedSequence !== undefined) {
      const actual = this.currentSequence(changeId)
      if (actual !== expectedSequence) {
        throw new ConcurrencyConflictError(changeId, expectedSequence, actual)
      }
    }

    const batchIds = new Set<EventId>()
    for (const pending of request.events) {
      if (this.#eventIds.has(pending.eventId) || batchIds.has(pending.eventId)) {
        throw new Error(`Duplicate event id ${pending.eventId}`)
      }
      batchIds.add(pending.eventId)
    }

    let offset = Number(this.currentRevision())
    let sequence = changeId === undefined ? undefined : this.currentSequence(changeId)
    const appended: EventEnvelope[] = []

    for (const pending of request.events) {
      offset += 1
      if (sequence !== undefined) sequence += 1

      appended.push({
        eventId: pending.eventId,
        graphId: this.graphId,
        offset: asEventOffset(offset),
        occurredAt: pending.occurredAt,
        actor: request.actor,
        event: pending.event as DomainEvent,
        ...(changeId === undefined ? {} : { changeId }),
        ...(sequence === undefined ? {} : { sequence }),
        ...(request.causationId === undefined ? {} : { causationId: request.causationId }),
        ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
      })
    }

    const next = [...this.#events, ...appended]
    assertEventLogConsistency(this.graphId, next)
    const serialized = next.map(event => JSON.stringify(event)).join('\n') + '\n'
    await atomicWrite(join(this.directory, EVENTS_FILE), serialized)

    this.#events.push(...appended)
    for (const event of appended) this.#eventIds.add(event.eventId)
    if (changeId !== undefined && sequence !== undefined) {
      this.#changeSequences.set(changeId, sequence)
    }

    return appended
  }
}
