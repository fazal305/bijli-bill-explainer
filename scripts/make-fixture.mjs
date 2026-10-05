// Draws a made-up LESCO-style bill (the same numbers as src/lib/sample.js) and
// saves it as a photo for the end-to-end tests. No real customer data.
import { chromium } from '@playwright/test'
import { SAMPLE_BILL } from '../src/lib/sample.js'

const rows = SAMPLE_BILL.lineItems.map((i) => `<tr><td>${i.label}</td><td>${i.amount.toLocaleString('en-US')}</td></tr>`).join('')
const history = SAMPLE_BILL.history.map((h) => `<tr><td>${h.month}</td><td>${h.units}</td><td>${h.amount}</td></tr>`).join('')
const html = `<body style="margin:0;font:15px Arial;background:#e9f3ea;padding:24px;width:760px">
<h2 style="margin:0">LESCO · SAMPLE BILL · NOT A REAL CUSTOMER</h2>
<p>Name: SAMPLE CUSTOMER &nbsp; Ref No: 00 00000 0000000 &nbsp; Bill Month: ${SAMPLE_BILL.billMonth} &nbsp; Due Date: ${SAMPLE_BILL.dueDate}</p>
<p>Units Consumed: <b>${SAMPLE_BILL.unitsConsumed}</b></p>
<div style="display:flex;gap:24px"><table border="1" cellpadding="4" style="border-collapse:collapse;background:#fff">${rows}
<tr><td><b>Payable Within Due Date</b></td><td><b>${SAMPLE_BILL.totalPayable.toLocaleString('en-US')}</b></td></tr>
<tr><td>Payable After Due Date</td><td>${SAMPLE_BILL.payableAfterDueDate.toLocaleString('en-US')}</td></tr></table>
<table border="1" cellpadding="4" style="border-collapse:collapse;background:#fff"><tr><th>Month</th><th>Units</th><th>Bill</th></tr>${history}</table></div></body>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 808, height: 560 } })
await page.setContent(html)
await page.screenshot({ path: 'e2e/fixtures/sample-bill.jpg', type: 'jpeg', quality: 85, fullPage: true })
await browser.close()
console.log('wrote e2e/fixtures/sample-bill.jpg')
