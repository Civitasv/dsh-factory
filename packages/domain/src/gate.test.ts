import { describe, expect, it } from 'vitest'
import {
  createGateEvaluation,
  type ActorRef,
  type EvidenceId,
  type EvidenceRef,
  type GateId,
} from './index.js'

const gateId = 'GATE-1' as GateId
const evidence: EvidenceRef = { id: 'EV-1' as EvidenceId }
const actor: ActorRef = { kind: 'system', id: 'test' }

describe('createGateEvaluation', () => {
  it('rejects a satisfied gate without evidence', () => {
    expect(() =>
      createGateEvaluation({
        gateId,
        state: 'satisfied',
        evaluatedAt: '2026-09-30T00:00:00Z',
        evaluatedBy: actor,
      }),
    ).toThrow('requires evidence')
  })

  it('accepts a failed gate with evidence', () => {
    const gate = createGateEvaluation({
      gateId,
      state: 'failed',
      evidence: [evidence],
      evaluatedAt: '2026-09-30T00:00:00Z',
      evaluatedBy: actor,
    })

    expect(gate.state).toBe('failed')
    expect(gate.evidence).toEqual([evidence])
  })

  it('does not require fabricated evidence for not_required', () => {
    expect(
      createGateEvaluation({
        gateId,
        state: 'not_required',
        evaluatedAt: '2026-09-30T00:00:00Z',
        evaluatedBy: actor,
      }).evidence,
    ).toEqual([])
  })
})
