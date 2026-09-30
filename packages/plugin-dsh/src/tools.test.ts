import { describe, expect, it } from 'vitest'
import {
  orvenActiveChangeProjection,
} from './tools.js'

describe('Orven active Change Session projection', () => {
  it('starts unbound and folds the latest whole-value binding', () => {
    const initial = orvenActiveChangeProjection.init()
    expect(initial).toEqual({ changeId: null })

    const first = orvenActiveChangeProjection.apply(initial, {
      type: 'orven/active-change',
      data: { changeId: 'chg:one' },
    })
    expect(first).toEqual({ changeId: 'chg:one' })

    const unrelated = orvenActiveChangeProjection.apply(first, {
      type: 'message/custom',
      data: {},
    })
    expect(unrelated).toBe(first)

    const second = orvenActiveChangeProjection.apply(first, {
      type: 'orven/active-change',
      data: { changeId: 'chg:two' },
    })
    expect(second).toEqual({ changeId: 'chg:two' })

    const cleared = orvenActiveChangeProjection.apply(second, {
      type: 'orven/active-change',
      data: { changeId: null },
    })
    expect(cleared).toEqual({ changeId: null })
  })
})
