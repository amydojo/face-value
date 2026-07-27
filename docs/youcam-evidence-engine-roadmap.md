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

## Phase C: effortless capture and hardening

- integrate Camera Kit `hdskincare` with moderate quality validation
- translate camera quality state into Face Value instructions
- evaluate unsupported-HD handling without changing protocol after baseline
- map additional provider quality failures into one clear recovery action
- verify completed-task resource deletion from the current official OpenAPI description
- add optional mask-based Evidence Aperture behind `See why`
- complete a physical iPhone baseline and follow-up smoke test

### Exit gate

A person completes the real trial without understanding YouCam mechanics or doing manual skincare homework.

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
