import { DICTIONARY } from './dictionary.js'

export function formatRs(n) {
  return Math.round(Math.abs(n)).toLocaleString('en-US')
}

const PROTECTED_LIMIT = 200
const SLAB_SIZE = 100
const TOP_SLAB = 700

const sameMonth = (a, b) => a && b && a.toUpperCase().replace(/[^A-Z0-9]/g, '') === b.toUpperCase().replace(/[^A-Z0-9]/g, '')

// Models sometimes copy this month's row from the history table as well.
function previousMonths(bill) {
  const rows = [...bill.history]
  const first = rows[0]
  if (
    first &&
    (sameMonth(first.month, bill.billMonth) ||
      (first.units === bill.unitsConsumed && first.amount !== null && first.amount === bill.totalPayable))
  ) {
    rows.shift()
  }
  return rows
}

function sumOf(items, predicate) {
  return items.filter(predicate).reduce((total, item) => total + item.amount, 0)
}

// Turns what the model read into plain Urdu. Every sentence is built here from
// the numbers, so nothing the model wrote is shown as an explanation.
export function explainBill(bill) {
  const items = bill.lineItems.map((item) => {
    const entry = DICTIONARY[item.key] || DICTIONARY.other
    const tone = item.amount < 0 ? 'credit' : entry.tone === 'adjust' ? 'tax' : entry.tone
    return { ...item, ...entry, tone }
  })

  const units = bill.unitsConsumed
  const total = bill.totalPayable ?? sumOf(items, () => true)
  const history = previousMonths(bill)
  const previous = history[0] || null
  const reasons = []

  const taxTotal = sumOf(items, (i) => i.tone === 'tax' && !['fpa', 'qta'].includes(i.key))
  const fpa = sumOf(items, (i) => i.key === 'fpa')
  const qta = sumOf(items, (i) => i.key === 'qta')
  const arrears = sumOf(items, (i) => i.key === 'arrears')
  const lps = sumOf(items, (i) => i.key === 'lps')

  let change = null
  if (previous?.amount && total) {
    change = { amount: total - previous.amount, month: previous.month }
  }

  if (units !== null && previous?.units !== null && previous?.units !== undefined) {
    const diff = units - previous.units
    if (diff > 0 && diff >= previous.units * 0.1) {
      reasons.push({
        id: 'more-units',
        tone: 'up',
        text: `پچھلے مہینے آپ نے ${previous.units} یونٹ استعمال کیے تھے، اس بار ${units} یونٹ، یعنی ${diff} یونٹ زیادہ۔ زیادہ بجلی جلی تو بل بھی زیادہ آیا۔`,
      })
    } else if (diff < 0 && change && change.amount > 0) {
      reasons.push({
        id: 'fewer-units-higher-bill',
        tone: 'up',
        text: `اس بار پچھلے مہینے سے کم یونٹ استعمال ہوئے، پھر بھی بل زیادہ ہے۔ اس کی وجہ نیچے دیے گئے ٹیکس اور ایڈجسٹمنٹ ہیں، آپ کا استعمال نہیں۔`,
      })
    }
  }

  const lastSix = history.slice(0, 6).filter((row) => row.units !== null)
  if (units !== null && units > PROTECTED_LIMIT && lastSix.length > 0 && lastSix.every((row) => row.units <= PROTECTED_LIMIT)) {
    reasons.push({
      id: 'lost-protected',
      tone: 'up',
      text: `پچھلے مہینوں میں آپ کے یونٹ ${PROTECTED_LIMIT} سے کم تھے، اس بار ${PROTECTED_LIMIT} سے اوپر چلے گئے۔ اس سے سستے "پروٹیکٹڈ" ریٹ کی سہولت ختم ہو سکتی ہے، اور اگلے کئی مہینے بل مہنگا آ سکتا ہے۔`,
    })
  } else if (units !== null && previous?.units != null && units > previous.units) {
    const crossed = Math.min(Math.floor(units / SLAB_SIZE), TOP_SLAB / SLAB_SIZE) * SLAB_SIZE
    if (crossed > 0 && previous.units <= crossed && units > crossed) {
      reasons.push({
        id: 'slab',
        tone: 'up',
        text: `اس بار یونٹ ${crossed} کی حد سے اوپر گئے۔ ہر 100 یونٹ کی حد پار کرنے پر فی یونٹ ریٹ بڑھ جاتا ہے، اس لیے بل یونٹوں کے حساب سے زیادہ تیزی سے بڑھا۔`,
      })
    }
  } else if (units !== null && units > PROTECTED_LIMIT && !previous) {
    reasons.push({
      id: 'over-200',
      tone: 'info',
      text: `اس مہینے ${units} یونٹ استعمال ہوئے۔ ${PROTECTED_LIMIT} یونٹ سے اوپر جانے پر فی یونٹ ریٹ کافی بڑھ جاتا ہے۔`,
    })
  }

  if (fpa > 0 && total > 0 && fpa >= total * 0.05) {
    reasons.push({
      id: 'fpa',
      tone: 'up',
      text: `فیول ایڈجسٹمنٹ (FPA) کی مد میں ${formatRs(fpa)} روپے جوڑے گئے ہیں۔ یہ پچھلے کسی مہینے کے مہنگے تیل اور گیس کا فرق ہے۔`,
    })
  } else if (fpa < 0) {
    reasons.push({ id: 'fpa-credit', tone: 'down', text: `فیول ایڈجسٹمنٹ (FPA) میں ${formatRs(fpa)} روپے کم کیے گئے ہیں۔` })
  }

  if (qta > 0 && total > 0 && qta >= total * 0.05) {
    reasons.push({ id: 'qta', tone: 'up', text: `سہ ماہی ایڈجسٹمنٹ (QTA) کی مد میں ${formatRs(qta)} روپے جوڑے گئے ہیں۔` })
  }

  if (taxTotal > 0 && total > 0 && taxTotal >= total * 0.15) {
    reasons.push({
      id: 'taxes',
      tone: 'info',
      text: `کل بل کا تقریباً ${Math.round((taxTotal / total) * 100)} فیصد (${formatRs(taxTotal)} روپے) ٹیکس اور سرچارج ہیں، جو بجلی کی قیمت کے اوپر الگ سے لگے ہیں۔`,
    })
  }

  if (arrears > 0) {
    reasons.push({ id: 'arrears', tone: 'up', text: `پچھلے بل کا ${formatRs(arrears)} روپے بقایا اس بل میں شامل ہے۔` })
  }
  if (lps > 0) {
    reasons.push({ id: 'lps', tone: 'up', text: `دیر سے بل جمع کرانے کا ${formatRs(lps)} روپے جرمانہ لگا ہے۔` })
  }

  // A gap between the lines and the total means a line was missed or misread.
  const itemsTotal = sumOf(items, () => true)
  const mismatch =
    bill.totalPayable !== null && items.length > 0 && Math.abs(itemsTotal - bill.totalPayable) > Math.max(100, bill.totalPayable * 0.03)

  return {
    company: bill.company,
    billMonth: bill.billMonth,
    dueDate: bill.dueDate,
    total,
    afterDue: bill.payableAfterDueDate,
    units,
    change,
    reasons,
    items,
    taxTotal,
    mismatch,
    history,
  }
}
