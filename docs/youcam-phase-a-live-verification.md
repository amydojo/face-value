# YouCam Phase A live verification

**Status:** Exact-head preview redeployment requested

This file records the deployment and live-score exit gate for PR #42.

Required Vercel preview environment variables:

- `YOUCAM_API_KEY`
- `YOUCAM_SPIKE_TOKEN`

Verification sequence:

1. Deploy branch `feat/youcam-phase-a-live-score` as a preview.
2. Open `/youcam-spike` on the exact deployment.
3. Confirm the protected route renders.
4. Submit one valid front-facing JPEG or PNG.
5. Confirm the server requests a YouCam upload slot without exposing the API key.
6. Confirm the browser uploads directly to the signed URL.
7. Confirm task creation requests only `hd_redness` with JSON output.
8. Confirm bounded polling reaches a terminal provider state.
9. Confirm the UI receives one normalized finite `raw_score` and no `ui_score`.
10. Confirm no image bytes, base64, signed upload URL, or credentials appear in browser storage or the Evidence Record.

## Deployment diagnosis

The first live preview rendered the client route, but Vercel's function compiler reported NodeNext ESM resolution errors for extensionless imports in the three YouCam function modules. The branch now uses explicit `.js` specifiers for all cross-module Vercel Function imports and includes root and API TypeScript module-resolution configuration.

The corrected exact head passed GitHub CI. A fresh preview deployment was requested on July 27, 2026 to determine whether Vercel quota capacity has returned and to verify that both server functions compile cleanly.

PR #42 must remain draft until the refreshed preview builds the functions cleanly and this sequence produces one real provider score or a provider-specific failure is diagnosed from deployment and runtime evidence.
