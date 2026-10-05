# Security Policy

Bijli Bill Explainer is a static React app plus one serverless function,
`POST /api/explain`. The function receives a bill photo, sends it to an AI
model to read the numbers, validates the result and returns it. Nothing is
stored: there is no database, no accounts, no cookies and no analytics.

## Supported versions

Only the latest version on the `main` branch (and the live site built from it)
receives fixes.

## Reporting a vulnerability

Please email **fazalabbas2002@gmail.com** with a description of the issue,
steps to reproduce, and the browser or tool you used. Do not open a public
issue for security reports, and do not include a real person's bill.

You can expect an acknowledgement within a week. Once a fix is released you are
welcome to be credited in the release notes.

## In scope

- Anything that lets a request reach the AI provider without the server's
  checks (file type, size, rate limit), or leaks the API key.
- Script injection through model output or bill text.
- Error responses that reveal internal details.

## Out of scope

- A number the AI misreads, or an explanation that doesn't fit a particular
  bill. Please open a normal issue for those (with personal details removed).
- Volumetric denial of service against Vercel itself.
