import { describe, expect, it } from 'vitest'
import { LINE_ITEM_KEYS } from '../../api/_lib/schema.js'
import { DICTIONARY, GLOSSARY_ORDER } from './dictionary.js'
import { explainBill } from './explain.js'
import { SAMPLE_BILL } from './sample.js'

const base = {
  company: 'FESCO',
  billMonth: 'SEP 26',
  dueDate: null,
  unitsConsumed: null,
  totalPayable: null,
  payableAfterDueDate: null,
  lineItems: [],
  history: [],
}
const ids = (result) => result.reasons.map((r) => r.id)

describe('dictionary', () => {
  it('has an Urdu entry for every key the server can return', () => {
    for (const key of LINE_ITEM_KEYS) expect(DICTIONARY[key]?.title).toBeTruthy()
    for (const key of GLOSSARY_ORDER) expect(DICTIONARY[key]).toBeTruthy()
  })
})

describe('explainBill', () => {
  it('explains the sample bill: more units, lost protected status, FPA, taxes', () => {
    const result = explainBill(SAMPLE_BILL)
    expect(ids(result)).toEqual(['more-units', 'lost-protected', 'fpa', 'taxes'])
    expect(result.change).toEqual({ amount: 14465 - 5980, month: 'JUL 26' })
    expect(result.mismatch).toBe(false)
  })

  it('spots a 100-unit slab crossing when protected status is not involved', () => {
    const result = explainBill({
      ...base,
      unitsConsumed: 312,
      totalPayable: 20000,
      lineItems: [{ key: 'energy', label: 'Cost', amount: 20000 }],
      history: [{ month: 'AUG 26', units: 280, amount: 16000 }],
    })
    expect(ids(result)).toEqual(['more-units', 'slab'])
    expect(result.reasons[1].text).toContain('300')
  })

  it('blames taxes, not usage, when units fell but the bill rose', () => {
    const result = explainBill({
      ...base,
      unitsConsumed: 150,
      totalPayable: 9000,
      lineItems: [
        { key: 'energy', label: 'Cost', amount: 6000 },
        { key: 'gst', label: 'GST', amount: 3000 },
      ],
      history: [{ month: 'AUG 26', units: 180, amount: 8000 }],
    })
    expect(ids(result)).toEqual(['fewer-units-higher-bill', 'taxes'])
  })

  it('drops the current month when the model copies it into the history', () => {
    const result = explainBill({
      ...base,
      unitsConsumed: 100,
      totalPayable: 4000,
      lineItems: [{ key: 'energy', label: 'Cost', amount: 4000 }],
      history: [
        { month: 'Sep-26', units: 100, amount: 4000 },
        { month: 'Aug-26', units: 90, amount: 3500 },
      ],
    })
    expect(result.change.month).toBe('Aug-26')
  })

  it('shows negative adjustments as credits and flags lines that do not add up', () => {
    const result = explainBill({
      ...base,
      totalPayable: 10000,
      lineItems: [
        { key: 'energy', label: 'Cost', amount: 7000 },
        { key: 'fpa', label: 'FPA', amount: -500 },
      ],
    })
    expect(result.items[1].tone).toBe('credit')
    expect(ids(result)).toContain('fpa-credit')
    expect(result.mismatch).toBe(true)
  })

  it('mentions arrears and late payment surcharge', () => {
    const result = explainBill({
      ...base,
      totalPayable: 5300,
      lineItems: [
        { key: 'energy', label: 'Cost', amount: 3000 },
        { key: 'arrears', label: 'Arrears', amount: 2000 },
        { key: 'lps', label: 'L.P.S', amount: 300 },
      ],
    })
    expect(ids(result)).toEqual(expect.arrayContaining(['arrears', 'lps']))
    expect(result.mismatch).toBe(false)
  })
})
