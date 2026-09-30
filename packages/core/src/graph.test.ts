import { describe, expect, it } from 'vitest'
import {
  assertRelationCanBeAdded,
  type ActorRef,
  type ChangeId,
  type EvidenceId,
  type FindingId,
  type Relation,
  type RelationId,
  type RunId,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'test' }

function relation(
  id: string,
  kind: Relation['kind'],
  source: Relation['source'],
  target: Relation['target'],
): Relation {
  return {
    id: id as RelationId,
    kind,
    source,
    target,
    createdAt: '2026-09-30T00:00:00Z',
    createdBy: actor,
  }
}

const change = (id: string) => ({ kind: 'change' as const, id: id as ChangeId })

describe('Change Graph relation invariants', () => {
  it.each(['decomposes_into', 'depends_on', 'supersedes'] as const)(
    'rejects %s cycles',
    kind => {
      const existing = [
        relation('REL-1', kind, change('A'), change('B')),
        relation('REL-2', kind, change('B'), change('C')),
      ]

      expect(() =>
        assertRelationCanBeAdded(existing, relation('REL-3', kind, change('C'), change('A'))),
      ).toThrow('introduce a cycle')
    },
  )

  it('allows a heterogeneous feedback cycle', () => {
    const existing: Relation[] = [
      relation(
        'REL-1',
        'produces',
        { kind: 'run', id: 'RUN-1' as RunId },
        { kind: 'evidence', id: 'EV-1' as EvidenceId },
      ),
      relation(
        'REL-2',
        'raises',
        { kind: 'evidence', id: 'EV-1' as EvidenceId },
        { kind: 'finding', id: 'FIND-1' as FindingId },
      ),
      relation(
        'REL-3',
        'addresses',
        change('CHG-2'),
        { kind: 'finding', id: 'FIND-1' as FindingId },
      ),
    ]

    expect(() =>
      assertRelationCanBeAdded(
        existing,
        relation(
          'REL-4',
          'attempts',
          { kind: 'run', id: 'RUN-2' as RunId },
          change('CHG-2'),
        ),
      ),
    ).not.toThrow()
  })

  it('rejects relation endpoint shapes that violate semantic type', () => {
    expect(() =>
      assertRelationCanBeAdded(
        [],
        relation(
          'REL-1',
          'has_criterion',
          { kind: 'evidence', id: 'EV-1' as EvidenceId },
          change('CHG-1'),
        ),
      ),
    ).toThrow('Invalid relation shape')
  })
})
