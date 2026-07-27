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

## Phase B: longitudinal integration

- freeze the baseline analysis protocol
- persist only normalized baseline signal and capture metadata
- reject mismatched follow-up protocols
- run the identical follow-up analysis
- compare follow-up `raw_score` against baseline `raw_score`
- add a documented prototype noise boundary after repeated same-session calibration
- map comparison and limitations into the existing `AnalysisResult`
- dispatch the existing reducer success or failure path
- prove one real result survives through next step, record release, collection, detail, and Past Results

### Exit gate

Changing normalized YouCam values changes the real Face Value result without creating a second trial or result store.

## Phase C: effortless capture and hardening

- integrate Camera Kit `hdskincare` with moderate quality validation
- translate camera quality state into Face Value instructions
- detect unsupported HD before baseline and offer SD fallback
- preserve one mode for the full trial
- map provider errors into one clear recovery action
- cancel polling on navigation and unmount
- prevent duplicate upload and task creation
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
- mobile WebKit end-to-end tests
- production build
- exact-head preview deployment
- zero unhandled runtime errors
- physical iPhone proof
