import { COMPANIES, ExtractionError, LINE_ITEM_KEYS } from './schema.js'

export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODELS = ['qwen/qwen3.8-27b:free', 'google/gemma-4-31b-it:free']

export const SYSTEM_PROMPT = `You read photos of Pakistani electricity bills (K-Electric and the WAPDA distribution companies: ${COMPANIES.join(', ')}).
Copy numbers exactly as printed. Never estimate, calculate or guess a value; use null when a value is missing or unreadable.

Reply with one JSON object and nothing else:
{
  "isElectricityBill": boolean,      // false if the photo is not an electricity bill
  "company": string | null,          // one of: ${COMPANIES.join(', ')}
  "billMonth": string | null,        // as printed, e.g. "AUG 26"
  "dueDate": string | null,          // as printed
  "unitsConsumed": number | null,    // units (kWh) billed this month
  "totalPayable": number | null,     // amount payable within due date
  "payableAfterDueDate": number | null,
  "lineItems": [ { "key": string, "label": string, "amount": number } ],
  "history": [ { "month": string, "units": number | null, "amount": number | null } ]
}

lineItems: every charge, tax, adjustment, arrear and credit printed on the bill, one entry each, with a non-zero amount.
Credits, relief and negative adjustments are negative numbers. Do not include sub-totals or the grand total as line items.
"label" is the label printed on the bill. "key" is the closest of:
energy (cost of electricity / energy or variable charges), fixed_charges, meter_rent, fpa (fuel price adjustment, F.P.A, FCA),
qta (quarterly tariff adjustment, QTR, Q.T.A, uniform tariff adjustment), fc_surcharge (financing cost surcharge, F.C. surcharge, PHL),
njs (Neelum Jhelum surcharge), electricity_duty, gst (general sales tax, GST on FPA counts as gst), income_tax, extra_tax, further_tax,
tv_fee (PTV fee), arrears, lps (late payment surcharge), subsidy (government relief, subsidy, rebate), installment (deferred amount or installment), other.
history: the monthly consumption history table printed on the bill, newest first. Leave empty if there is none.`

const USER_PROMPT = 'Read this electricity bill and reply with the JSON object.'

// Tries each configured model in turn; a busy free model is common, so one
// failure falls through to the next while the overall deadline allows.
export async function readBill({ image, mime, env, fetchImpl = fetch, deadline }) {
  const apiKey = env.AI_API_KEY
  if (!apiKey) throw new ExtractionError('not_configured')
  const baseUrl = (env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const models = env.AI_MODEL
    ? env.AI_MODEL.split(',').map((m) => m.trim()).filter(Boolean)
    : DEFAULT_MODELS
  const dataUrl = `data:${mime};base64,${Buffer.from(image).toString('base64')}`

  let lastError = new ExtractionError('upstream', 'no model attempted')
  for (const model of models) {
    const remaining = deadline - Date.now()
    if (remaining < 5000) break
    let response
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Bijli Bill Explainer',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: USER_PROMPT },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(remaining),
      })
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      lastError = new ExtractionError(timedOut ? 'timeout' : 'upstream', `${model}: ${error?.message}`)
      if (timedOut) break
      continue
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      lastError = new ExtractionError('upstream', `${model}: HTTP ${response.status} ${body.slice(0, 300)}`)
      // A rejected key or bad request will fail the same way on every model.
      if (response.status === 401 || response.status === 403) {
        throw new ExtractionError('not_configured', lastError.message)
      }
      continue
    }

    const payload = await response.json().catch(() => null)
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      lastError = new ExtractionError('upstream', `${model}: empty completion`)
      continue
    }
    return { content, model }
  }
  throw lastError
}
