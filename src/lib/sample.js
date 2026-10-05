// A made-up bill for the "see an example" button. It is not anyone's real bill
// and the screen says so; the numbers only need to add up.
export const SAMPLE_BILL = {
  company: 'LESCO',
  billMonth: 'AUG 26',
  dueDate: '24 SEP 26',
  unitsConsumed: 236,
  totalPayable: 14465,
  payableAfterDueDate: 15450,
  lineItems: [
    { key: 'energy', label: 'Cost of Electricity', amount: 9850 },
    { key: 'fpa', label: 'F.P.A', amount: 1120 },
    { key: 'qta', label: 'QTR Tariff Adj.', amount: 340 },
    { key: 'fc_surcharge', label: 'F.C Surcharge', amount: 762 },
    { key: 'electricity_duty', label: 'Electricity Duty', amount: 148 },
    { key: 'gst', label: 'GST', amount: 2210 },
    { key: 'tv_fee', label: 'TV Fee', amount: 35 },
  ],
  history: [
    { month: 'JUL 26', units: 195, amount: 5980 },
    { month: 'JUN 26', units: 188, amount: 5710 },
    { month: 'MAY 26', units: 176, amount: 5340 },
    { month: 'APR 26', units: 142, amount: 4420 },
    { month: 'MAR 26', units: 120, amount: 3890 },
    { month: 'FEB 26', units: 115, amount: 3760 },
  ],
}
