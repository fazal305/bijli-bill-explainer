// The model only reads numbers off the bill. Every Urdu explanation comes from
// the app's own dictionary (src/lib/dictionary.js), keyed by these ids, so the
// model never gets to invent what a charge means.
export const LINE_ITEM_KEYS = [
  'energy',
  'fixed_charges',
  'meter_rent',
  'fpa',
  'qta',
  'fc_surcharge',
  'njs',
  'electricity_duty',
  'gst',
  'income_tax',
  'extra_tax',
  'further_tax',
  'tv_fee',
  'arrears',
  'lps',
  'subsidy',
  'installment',
  'other',
]

export const COMPANIES = ['KE', 'LESCO', 'FESCO', 'IESCO', 'PEPCO', 'MEPCO', 'GEPCO', 'HESCO', 'SEPCO', 'PESCO', 'QESCO', 'TESCO']

const MAX_ITEMS = 30
const MAX_HISTORY = 13
const MAX_AMOUNT = 10_000_000
const MAX_UNITS = 1_000_000

export class ExtractionError extends Error {
  constructor(code, detail) {
    super(detail || code)
    this.code = code
  }
}

// Bills print "1,234", "Rs. 1,234/-" or "(120)" for a credit; models echo any of these.
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  let text = value.trim()
  const parenthesised = /^\(.*\)$/.test(text)
  text = text.replace(/rs\.?|pkr|\/-|,|\s/gi, '').replace(/[()]/g, '')
  if (!/^[-+]?\d+(\.\d+)?$/.test(text)) return null
  const n = Number(text)
  return parenthesised ? -Math.abs(n) : n
}

function amount(value) {
  const n = toNumber(value)
  if (n === null || Math.abs(n) > MAX_AMOUNT) return null
  return Math.round(n * 100) / 100
}

function units(value) {
  const n = toNumber(value)
  if (n === null || n < 0 || n > MAX_UNITS) return null
  return Math.round(n)
}

function text(value, max) {
  if (typeof value !== 'string') return null
  // Control and bidi-override characters have no place in a bill label.
  const clean = value.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, max) : null
}

function company(value) {
  const t = text(value, 20)
  if (!t) return null
  const upper = t.toUpperCase().replace(/[^A-Z]/g, '')
  if (upper === 'KELECTRIC') return 'KE'
  return COMPANIES.find((c) => upper === c) || null
}

export function parseModelJson(raw) {
  if (typeof raw !== 'string') throw new ExtractionError('unreadable', 'model returned no text')
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const start = withoutThinking.indexOf('{')
  const end = withoutThinking.lastIndexOf('}')
  if (start < 0 || end <= start) throw new ExtractionError('unreadable', 'no JSON object in model output')
  try {
    return JSON.parse(withoutThinking.slice(start, end + 1))
  } catch {
    throw new ExtractionError('unreadable', 'model output is not valid JSON')
  }
}

export function normalizeExtraction(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ExtractionError('unreadable', 'model output is not an object')
  }
  if (data.isElectricityBill === false) throw new ExtractionError('not_a_bill')

  const lineItems = (Array.isArray(data.lineItems) ? data.lineItems : [])
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      key: LINE_ITEM_KEYS.includes(item?.key) ? item.key : 'other',
      label: text(item?.label, 60) || '',
      amount: amount(item?.amount),
    }))
    .filter((item) => item.amount !== null && item.amount !== 0)

  const history = (Array.isArray(data.history) ? data.history : [])
    .slice(0, MAX_HISTORY)
    .map((row) => ({ month: text(row?.month, 12), units: units(row?.units), amount: amount(row?.amount) }))
    .filter((row) => row.month && (row.units !== null || row.amount !== null))

  const bill = {
    company: company(data.company),
    billMonth: text(data.billMonth, 20),
    dueDate: text(data.dueDate, 20),
    unitsConsumed: units(data.unitsConsumed),
    totalPayable: amount(data.totalPayable),
    payableAfterDueDate: amount(data.payableAfterDueDate),
    lineItems,
    history,
  }

  // Without a total or any charges there is nothing honest to explain.
  if (bill.totalPayable === null && lineItems.length === 0) {
    throw new ExtractionError('unreadable', 'no total and no line items')
  }
  return bill
}
