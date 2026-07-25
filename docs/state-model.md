# State model

Face Value uses one pure reducer. Events that do not satisfy their guard return the current state unchanged. Visual motion never advances the machine.

## Compatibility note

A small set of original MVP event keys and persisted field names remains internal to avoid an unnecessary storage migration. Those names are implementation details only. They must not appear in visible copy, accessibility labels, analytics attributes, tests that describe product behavior, or canonical design documentation.

The production presentation vocabulary is Evidence Index, cassette selector, specimen, observation, interference, verdict, disposition, Evidence Record, and Evidence Archive.

## Application stages

- `welcome`: private-by-default entry and dormant instrument.
- `cabinet`: Evidence Index and active cassette register.
- `browse`: finite indexed cassette selection.
- `specimen`: selected cassette and specimen inspection.
- `job`: one assigned evidence role.
- `capture_contract`: comparable-condition confirmation with cassette identity retained.
- `camera`: private observation capture framed by accession identity.
- `observation`: sealed active observation cassette.
- `disturbance`: two cassette identities registered in one observation window.
- `analysis`: review-due cassette and comparison context.
- `progress`: Evidence Cassette V7 verdict reveal.
- `placement`: evidence disposition and cassette classification.
- `record`: independent face-free Evidence Record output.
- `archive`: durable Evidence Archive.

The public router does not expose a separate verdict stage. `/verdict` is not a production route. `progress` is reached only through a guarded reducer transition from a comparable analysis result or a persisted `review_due` state that already owns such a result.

## Shared cassette modes

The presentation contract uses `index`, `active`, `review-due`, `verdict`, and `classified`.

These modes are projections of domain state. They do not replace the reducer or introduce local navigation state.

## Verdict hardware

The verdict retains its independent mechanical reducer:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

This reducer coordinates only presentation. It cannot create an analysis result, select a placement, or generate a record.

## Observation

- `none`: no product observation exists.
- `baseline_pending`: a product job exists but baseline capture is incomplete.
- `baseline`: baseline evidence exists before a stable window is established.
- `active_stable`: one product and one job are active.
- `active_disturbed`: an overlapping product remains in the observation window.
- `waiting`: structured context remains, but no verdict is available.
- `review_due`: follow-up capture or comparison is ready for review.
- `complete`: final evidence disposition is committed and a record exists.

## Camera

- `idle`: no permission request or pending browser stream.
- `unsupported`: `getUserMedia` is absent.
- `requesting`: browser permission negotiation is active.
- `ready`: a stream is attached and can be captured.
- `capturing`: canvas extraction is in progress.
- `captured`: the user accepted a pending capture.
- `denied`: permission was refused.
- `no_camera`: no video input was found.
- `overconstrained`: preferred constraints could not be satisfied.
- `error`: an unknown normalized failure occurred.

## Comparison and confidence

- `not_available`: no valid follow-up comparison exists.
- `comparable`: user-confirmed conditions support comparison.
- `partially_comparable`: changed conditions or overlap reduce interpretability.
- `not_comparable`: a verdict is refused.

Confidence is `insufficient`, `possible`, `likely`, or `confirmed`. The reducer permanently caps retained overlap at `possible` and rewrites the recommendation to `continue_with_overlap`.

## Verdict-to-placement mapping

The exhaustive mapping happens before the placement stage opens:

| Analysis or verdict condition | Placement |
| --- | --- |
| `keep` | `established` |
| `wait`, `pause`, `reassess`, `return_to_cooling`, or `seek_professional_guidance` | `paused` |
| `continue_with_overlap` | `retry_alone` |
| persisted disturbance `overlap_retained` | `retry_alone` |

Unknown recommendation values throw at the mapping boundary rather than silently choosing a default.

## Guarded production transitions

| Internal event | Valid source | Production result | Rejected when |
| --- | --- | --- | --- |
| `OPEN_CABINET` | `welcome` | Evidence Index opens | any other stage |
| `BROWSE_DRAWERS` | `cabinet` | finite cassette selector | wrong stage |
| `OPEN_REVIEW_DUE` | `cabinet + review_due` | saved follow-up resumes analysis; saved comparable result resumes verdict | no review-due observation or missing continuation data |
| `PREVIOUS_DRAWER` | `browse` | selected cassette index decreases by one | first cassette or wrong stage |
| `NEXT_DRAWER` | `browse` | selected cassette index increases by one | final cassette or wrong stage |
| `OPEN_DRAWER` | `browse` | selected cassette enters specimen inspection | wrong stage |
| `ASSIGN_JOB` | `specimen`, `job` | evidence role stored; baseline becomes pending | wrong stage |
| `BEGIN_CAPTURE: baseline` | `job` | baseline Capture Contract | no assigned-job stage |
| `BEGIN_CAPTURE: followup` | active or recoverable observation stages | follow-up Capture Contract | wrong stage |
| `CONFIRM_CONTRACT` | `capture_contract` | camera stage, or refusal for `not_comparable` follow-up | wrong stage |
| `CAPTURE_ACCEPTED` | `camera` and metadata kind matches | baseline activates observation; follow-up opens analysis | wrong stage or mismatched kind |
| `INTRODUCE_SECOND_PRODUCT` | `observation` with trace | interference decision | no trace or wrong stage |
| `RESOLVE_DISTURBANCE: cooling` | `disturbance` | secondary cassette removed from the observation window | wrong stage |
| `RESOLVE_DISTURBANCE: overlap` | `disturbance` | overlap retained, partial comparison, confidence `possible` | wrong stage |
| `ANALYSIS_STARTED` | `analysis` | processing announcement only | wrong stage or already running/result exists |
| `ANALYSIS_SUCCEEDED` | `analysis` | result stored; overlap confidence stays capped | wrong stage |
| `ANALYSIS_FAILED` | `analysis` | `analysis_failure`; no result created | wrong stage |
| `RETAKE_FOLLOWUP` | `analysis_failure`, `comparison_refused` | fresh follow-up contract | wrong stage |
| `SAVE_CONTEXT_ONLY` | `comparison_refused` | observation waits without verdict | wrong stage |
| `ENTER_PROGRESS` | `analysis` with comparable result | real Evidence Cassette V7 verdict | no result or not comparable |
| `SELECT_PLACEMENT` | `progress`, `placement` | explicit evidence disposition selected | wrong stage |
| `SEAL_PLACEMENT` | `placement` with result | disposition committed and cassette classified | missing result or wrong stage |
| `GENERATE_RECORD` | committed `placement` | face-free Evidence Record generated once | disposition not committed, missing result, or wrong stage |
| `VIEW_ARCHIVE` | any active stage | Evidence Archive with return stage preserved | never rejected |
| `VIEW_RECORD` | archive navigation | selected record opens | wrong stage |
| `BACK` | browse, verdict, placement, archive, record, capture states | exact semantic parent restored | otherwise unchanged |

## Record invariant

Record generation preserves specimen, accession, product, job, comparison, finding, non-finding, confidence, disturbance, final placement, recommendation, claim boundary, timestamp, and `includesFaceImage: false`.

The archive insertion boundary is idempotent for a deterministic record ID. Repeated activation with the same committed classification and timestamp cannot add a duplicate record.

## Disturbance invariant

Removing C2–01 from the active observation window restores stable attribution before the follow-up. Continuing with overlap writes `overlap_retained` into domain state. The adapter returns the reduced-confidence scenario, the reducer caps confidence at `possible`, the verdict maps to `retry_alone`, and the Evidence Record preserves both confidence and disturbance.

See `production-journey-integration.md` for the complete interaction and verification contract.
