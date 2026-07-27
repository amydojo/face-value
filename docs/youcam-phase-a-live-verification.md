# YouCam Phase A live verification

**Status:** Pending real provider verification

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

PR #42 must remain draft until this sequence produces one real provider score or a provider-specific failure is diagnosed from deployment and runtime evidence.
