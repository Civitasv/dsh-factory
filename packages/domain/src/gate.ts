import type { GateEvaluation, GateEvaluationInput } from './domain.js'

export function createGateEvaluation(input: GateEvaluationInput): GateEvaluation {
  const evidence = input.evidence ?? []
  const terminalEvidenceState = input.state === 'satisfied' || input.state === 'failed'

  if (terminalEvidenceState && evidence.length === 0) {
    throw new Error(`Gate state ${input.state} requires evidence`)
  }

  return {
    gateId: input.gateId,
    state: input.state,
    evidence,
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: input.evaluatedBy,
  }
}
