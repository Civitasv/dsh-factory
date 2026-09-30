import { describe, expect, it } from 'vitest'
import {
  createGateEvaluation,
  type ChangeId,
  type EvidenceId,
  type EvidenceRef,
  type GateId,
} from './index.js'

const changeId = 'CHG-1' as ChangeId
const gateId = 'GATE-1' as GateId
const evidence: EvidenceRef = { id: 'EV-1' as EvidenceId }

describe('createGateEvaluation', () => {
  it('rejects a satisfied gate without evidence', () => {
    expect(() =>
      createGateEvaluation({
        id: gateId,
        changeId,
        kind: 'functional',
        state: 'satisfied',
      }),
    ).toThrow('requires evidence')
  })

  it('accepts a failed gate with evidence', () => {
    const gate = createGateEvaluation({
      id: gateId,
      changeId,
      kind: 'functional',
      state: 'failed',
      evidence: [evidence],
    })

    expect(gate.state).toBe('failed')
    expect(gate.evidence).toEqual([evidence])
  })

  it('does not require fake evidence for not_required', () => {
    expect(
      createGateEvaluation({
        id: gateId,
        changeId,
        kind: 'performance',
        state: 'not_required',
      }).evidence,
    ).toEqual([])
  })
})
