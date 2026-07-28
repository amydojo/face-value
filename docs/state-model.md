# State model

Face Value uses one pure reducer. Events that do not satisfy their guard return the current state unchanged. Visual motion never advances scientific or durable state.

## Compatibility note

A small set of original MVP event keys and persisted field names remains internal to avoid an unnecessary storage migration. Those names are implementation details only. Default presentation vocabulary is Your trials, trial, note, follow-up scan, result, next step, saved result, and Past results.

Canonical redness records add a versioned evaluation snapshot without changing
the storage envelope. Current registered redness trials derive effect,
measurement, attribution, evidence, safety, and action through
`src/domain/evidence/redness`. Pre-engine records remain readable but are never
reinterpreted as canonical evidence.

## Application stages

- `welcome`: private-by-default entry and dormant instrument.
- `cabinet`: Your trials and the selected trial needing attention.
- `browse`: finite trial selection.
- `specimen`: selected product inspection and one-job question.
- `job`: assigned job and baseline-scan consequence.
- `capture_contract`: comparable-condition confirmation with trial identity retained.
- `camera`: private baseline or follow-up scan.
- `observation`: trial in progress.
- `disturbance`: another product entered the trial.
- `analysis`: automatic comparison and result-ready object.
- `analysis_failure`: comparison failed without fabricating a result.
- `comparison_refused`: scans are not fair to compare.
- `progress`: V7 result reveal.
- `placement`: recommended or overridden next step, reseal, and save boundary.
- `record`: opened saved result.
- `archive`: Past results.

The public router does not expose a separate result fixture stage. `/verdict` is not a production route. `progress` is reached only through a guarded reducer transition from a comparable analysis result or a persisted `review_due` state that already owns such a result.

## Shared internal trial-object modes

The presentation contract uses `index`, `active`, `review-due`, `verdict`, and `classified`. These modes are projections of reducer state. They do not replace the reducer or introduce local navigation state.

## V7 result hardware

The result retains its independent mechanical reducer:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

This reducer coordinates only presentation. It cannot create an analysis result, select a placement, generate a saved result, or insert a Past results entry.

## Observation

- `none`: no product trial exists.
- `baseline_pending`: a product job exists but the baseline scan is incomplete.
- `baseline`: baseline evidence exists before a stable window is established.
- `active_stable`: one product and one job are active.
- `active_disturbed`: another product remains in the trial window.
- `waiting`: structured context remains, but no result is available.
- `review_due`: a follow-up scan or comparison is ready.
- `complete`: the next step is committed and one saved result exists.

## Camera

- `idle`: no permission request or pending browser stream.
- `unsupported`: `getUserMedia` is absent.
- `requesting`: browser permission negotiation is active.
- `ready`: a stream is attached and can be captured.
- `capturing`: canvas extraction is in progress.
- `captured`: the person accepted a pending scan.
- `denied`: permission was refused.
- `no_camera`: no video input was found.
- `overconstrained`: preferred constraints could not be satisfied.
- `error`: an unknown normalized failure occurred.

## Comparison and confidence

- `not_available`: no valid follow-up comparison exists.
- `comparable`: confirmed conditions support comparison.
- `partially_comparable`: changed conditions or product overlap reduce interpretability.
- `not_comparable`: a result is refused.

The compatibility confidence field remains `insufficient`, `possible`,
`likely`, or `confirmed`. Canonical redness uses its separate evidence-quality
dimension (`insufficient`, `possible`, or `likely`). Active product overlap
blocks attribution and deterministically maps to `retry_alone`; it is not
averaged into a generic confidence value.

## Result-to-next-step mapping

The exhaustive mapping happens before the placement stage opens:

| Analysis or result condition | Placement |
| --- | --- |
| `keep` | `established` |
| `wait`, `pause`, `reassess`, `return_to_cooling`, or `seek_professional_guidance` | `paused` |
| `continue_with_overlap` | `retry_alone` |
| persisted `overlap_retained` | `retry_alone` |

Unknown recommendation values throw at the mapping boundary rather than silently choosing a default.

For canonical redness, the authoritative mapping is:

| Redness action        | Compatibility placement |
| --------------------- | ----------------------- |
| `keep`                | `established`           |
| `test_longer`         | `paused`                |
| `retry_alone`         | `retry_alone`           |
| `not_proving_job`     | `useful_elsewhere`      |
| `safety_interruption` | `released`              |

React receives this mapping through the typed presentation adapter and does not
infer it.

## Guarded production transitions

| Internal event | Valid source | Human product result | Rejected when |
| --- | --- | --- | --- |
| `OPEN_CABINET` | `welcome` | Your trials opens | any other stage |
| `BROWSE_DRAWERS` | `cabinet` | finite trial selector | wrong stage |
| `OPEN_REVIEW_DUE` | `cabinet + review_due` | saved follow-up resumes analysis; comparable result resumes result reveal | missing continuation data |
| `PREVIOUS_DRAWER` | `browse` | selected trial index decreases by one | first trial or wrong stage |
| `NEXT_DRAWER` | `browse` | selected trial index increases by one | final trial or wrong stage |
| `OPEN_DRAWER` | `browse` | selected trial enters job assignment | wrong stage |
| `OPEN_DRAWER` | `cabinet + active observation` | active trial reopens directly | no active trial |
| `ASSIGN_JOB` | `specimen`, `job` | one job stored; baseline becomes pending | wrong stage |
| `BEGIN_CAPTURE: baseline` | `job` | baseline scan conditions | no assigned-job stage |
| `BEGIN_CAPTURE: followup` | active or recoverable observation stages | follow-up scan conditions | wrong stage |
| `CONFIRM_CONTRACT` | `capture_contract` | camera stage, or refusal for `not_comparable` follow-up | wrong stage |
| `CAPTURE_ACCEPTED: baseline` | matching `camera` | trial in progress | wrong stage or mismatched kind |
| `CAPTURE_ACCEPTED: followup` | matching `camera` | analysis stage; adapter effect starts automatically | wrong stage or mismatched kind |
| `ADD_TRACE` | active observation | note saved or replaced | wrong stage |
| `INTRODUCE_SECOND_PRODUCT` | `observation` | another-product decision | wrong stage |
| `RESOLVE_DISTURBANCE: cooling` | `disturbance` | second product removed; stable attribution restored | wrong stage |
| `RESOLVE_DISTURBANCE: overlap` | `disturbance` | both retained; result will be less certain | wrong stage |
| `ANALYSIS_STARTED` | `analysis` | comparison running | wrong stage, already running, or result exists |
| `ANALYSIS_SUCCEEDED` | `analysis` | result stored; overlap confidence remains capped | wrong stage |
| `ANALYSIS_FAILED` | `analysis` | trial remains saved; no result fabricated | wrong stage |
| `RETAKE_FOLLOWUP` | `analysis_failure`, `comparison_refused` | fresh follow-up scan conditions | wrong stage |
| `SAVE_CONTEXT_ONLY` | `comparison_refused` | context preserved without a result | wrong stage |
| `ENTER_PROGRESS` | `analysis` with comparable result | V7 result screen | no result or not comparable |
| `SELECT_PLACEMENT` | `progress`, unsealed `placement` | recommended or overridden next step selected | wrong stage or already sealed |
| `SAVE_RESULT` | unsealed `placement` with analysis | classify, reseal, generate exactly one saved result | wrong stage, missing result, or already sealed |
| `OPEN_SAVED_RESULT` | sealed `placement` with record | open the saved result | missing record or wrong stage |
| `VIEW_ARCHIVE` | any active stage | Past results with return stage preserved | never rejected |
| `VIEW_RECORD` | `archive` | selected saved result opens | wrong stage |
| `BACK` | browse, result, placement, archive, record, capture states | exact semantic parent restored | otherwise unchanged |

`SEAL_PLACEMENT` and `GENERATE_RECORD` remain guarded compatibility events for older persisted sessions and focused recovery tests. Production UI does not require them.

## Automatic-analysis invariant

The adapter effect is keyed by the accepted follow-up capture identifier. It dispatches analysis only when:

- stage is `analysis`
- a follow-up capture exists
- no analysis result exists
- processing is `idle`
- that capture identifier has not already been requested in the mounted session

Reducer guards reject duplicate starts and late or invalid result events.

## Saved-result invariant

`SAVE_RESULT` preserves specimen, accession, product, job, baseline and follow-up metadata, note, comparison, finding, non-finding, confidence, another-product state, final placement, recommendation, claim boundary, timestamp, and `includesFaceImage: false`.

Archive insertion is idempotent for the deterministic record identifier. Repeated save activation, automatic open, back, reload restoration, and Past results reopening cannot add a duplicate.

## Another-product invariant

Removing the second product restores stable attribution before the follow-up. Keeping both writes `overlap_retained`. The adapter returns the reduced-confidence scenario, the reducer caps confidence at `possible`, the result maps to `retry_alone`, and the saved result preserves both confidence and overlap context.

See `production-journey-integration.md` for the complete language, interaction, accessibility, and verification contract.
