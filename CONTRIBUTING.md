# Contributing

Thanks for wanting to help with Bijli Bill Explainer.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional: add AI_API_KEY to read real bills
npm run dev                  # http://localhost:5173
```

Before opening a pull request, run the same checks CI runs:

```bash
npm run lint
npm test
npm run build
npm run e2e      # first time: npx playwright install chromium
```

## Where things live

- **What a bill line means:** `src/lib/dictionary.js`. Keep each explanation to
  one or two short Urdu sentences an older parent can follow, and avoid rates or
  percentages that change with each budget.
- **Why a bill went up:** `src/lib/explain.js`, tested in
  `src/lib/explain.test.js`. Add a failing test first.
- **What the model is asked to read:** `api/_lib/model.js` (prompt) and
  `api/_lib/schema.js` (validation). A new line-item key needs an entry in
  `LINE_ITEM_KEYS`, the prompt and the dictionary; a unit test checks the
  dictionary covers every key.

## Things to keep in mind

- **Never commit a real bill**, in tests, issues or screenshots. Use
  `src/lib/sample.js` and `npm run fixture`.
- **The model reads, the app explains.** Don't render text written by the model
  as an explanation.
- **Urdu first, plain words**, large text, and check every screen at 375px with
  no sideways scrolling.
- No new dependencies without a clear reason.
