# YouCam Evidence Engine Implementation Roadmap

This roadmap executes `docs/youcam-evidence-engine-contract.md` without expanding product scope.

## Phase A: live-score spike

- add server-only `YOUCAM_API_KEY`
- add typed provider boundary
- request a v2.1 upload slot
- upload one JPEG or PNG to the signed URL
- create one `hd_redness` task with JSON output
- poll with bounded cancellation and timeout behavior
- validate the response
- normalize one `raw_score`
- render the normalized signal only in protected development evidence
- prove no credential or image bytes enter durable browser storage

### Exit gate

One production image returns one real normalized redness score on the deployed application without exposing credentials or persisting the image.

**Status:** complete in PR #42 and merge `cdb907f41f1eaa8d293cfef585c568a24eb477c5`.

## Phase B: matched longitudinal integration

- freeze the complete HD redness protocol at accepted baseline
- normalize the provider signal into reducer-owned durable evidence by construction
- persist only the frozen protocol, normalized signals, capture metadata, comparison, result, and face-free record
- reject every protocol mismatch locally before upload-slot creation
- run the identical follow-up analysis
- compare follow-up `raw_score` against baseline `raw_score` with a pure deterministic function
- keep calibration `pending` and confidence at `Possible` until same-session noise evidence exists
- map comparison and limitations into the existing `AnalysisResult`
- preserve the Human Butter reducer as the single durable authority through result, next step, Evidence Machine, Evidence Record, detail, Past Results, and restoration
- use request identity, cancellation, and legal reducer transitions to prevent duplicate or stale provider work
- exchange the protected engineering token for a short-lived signed `Secure`, `HttpOnly`, `SameSite=Strict` cookie
- verify the compiled client bundle contains no credentials, bearer strings, task IDs, image data URLs, blob URLs, signed provider URLs, or raw payload markers
- collect same-session calibration evidence only in a memory-only protected utility

### Automated exit gate

Changing deterministic normalized fixture values changes the real Face Value result and survives the complete mobile WebKit evidence journey without creating a second trial, result, or record store.

### Live exit gate

One genuine matched baseline and follow-up pair must run against the exact-head Vercel preview under the identical frozen protocol and reach Evidence Record detail and Past Results with no unhandled runtime errors.

**Status:** implemented in draft PR #44. Fixture-backed automation and deployment verification are required before review. The genuine matched live-provider pair remains a manual acceptance gate and must not be substituted with the unrelated Phase A images.

## Phase B.5: show the car

- replace fixture-first onboarding with reducer-owned product registration
- select YouCam eligibility from the registered protocol, not a fixture ID
- integrate Camera Kit `hdskincare` with moderate quality validation
- auto-capture one accepted Blob after a stable quality interval
- retain file selection as the single recoverable capture fallback
- replace the ten-item contract with lightweight optional context
- end session one at `Baseline locked`
- enforce the 14-day return rule in reducer transitions
- provide explicit environment-gated demo advancement without rewriting time
- keep verdict, limitation, recommendation, and scores out of the rendered and
  accessible tree until reveal
- show verdict, limitation, and `TEST LONGER` in one revealed scene
- commit placement and reuse `SAVE_RESULT` through one atomic amber event
- preserve one record ID through release, collection, detail, archive, and
  restoration
- verify the complete story in mobile WebKit and reduced motion

### Exit gate

A person can complete the Face Value trial without understanding provider
mechanics or doing manual capture homework. The record remains face-free and
the result remains honest.

**Status:** implemented on `feat/phase-b5-show-the-car`. Exact-head deployment
and physical iPhone evidence remain release gates.

## Phase C: provider hardening

- evaluate unsupported-HD handling without changing protocol after baseline
- verify completed-task resource deletion from the current official OpenAPI
  description
- consider optional mask-based Evidence Aperture only in a separately reviewed
  phase
- complete ongoing physical-device regression coverage

Phase C must not reopen Phase B.5 product scope.

## Final release gate

The integration is finished only when all three phase exit gates pass plus:

- lint
- strict TypeScript
- unit and component tests
- compiled-client privacy scan
- mobile WebKit end-to-end tests
- production build
- exact-head preview deployment
- zero unhandled runtime errors
- physical iPhone proof
