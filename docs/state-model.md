# State model

Face Value uses one pure reducer. Events that do not satisfy their guard return the current state unchanged. Visual motion never advances the machine.

## Compatibility note

A small set of original MVP event keys and persisted field names remains internal to avoid an unnecessary storage migration. Those names are implementation details only. They must not appear in visible copy, accessibility labels, analytics attributes, tests that describe product behavior, or canonical design documentation.

The production presentation vocabulary is Evidence Index, cassette selector, specimen, observation, interference, verdict, disposition, Evidence Record, and Evidence Archive.

## State families

### Instrument availability

The persisted `cabinet` field remains a compatibility flag with values `closed`, `opening`, `open`, and `closing`. Presentation interprets it as whether the Evidence Index is available. No furniture or appliance behavior is derived from it.

### Application stage

* `welcome`: private by default entry and dormant instrument.
* `cabinet`: Evidence Index and active cassette register.
* `browse`: finite indexed cassette selection.
* `specimen`: selected cassette and specimen inspection.
* `job`: one assigned evidence role.
* `capture_contract`: comparable condition confirmation with cassette identity retained.
* `camera`: private observation capture framed by accession identity.
* `observation`: sealed active observation cassette.
* `disturbance`: two cassette identities registered in one observation window.
* `analysis`: review due cassette and comparison context.
* `progress`: Evidence Cassette V7 verdict reveal.
* `placement`: evidence disposition and cassette classification.
* `record`: independent face free Evidence Record output.
* `archive`: durable Evidence Archive.

### General hardware presentation

* `dormant`: instrument waiting for a specimen journey.
* `indexed`: cassette exists in the Evidence Index.
* `selected`: one cassette is selected for inspection.
* `sealed`: cassette contents remain optically obscured.
* `active`: one product and one job are under observation.
* `disturbed`: another cassette identity overlaps the observation window.
* `reviewDue`: comparison is ready for review.
* `classified`: evidence disposition has been committed.
* `archived`: observation has a durable record.

### Verdict hardware

The verdict retains its independent reducer:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

General application hardware does not force itself through the verdict sequence.

### Observation

* `none`: no product observation exists.
* `baseline_pending`: a product job exists but baseline capture is incomplete.
* `baseline`: baseline evidence exists before a stable window is established.
* `active_stable`: one product and one job are active.
* `active_disturbed`: an overlapping product remains in the observation window.
* `waiting`: structured context remains, but no verdict is available.
* `review_due`: follow up capture or comparison is ready for review.
* `complete`: final evidence disposition is committed and a record exists.

### Camera

* `idle`: no permission request or pending browser stream.
* `unsupported`: `getUserMedia` is absent.
* `requesting`: browser permission negotiation is active.
* `ready`: a stream is attached and can be captured.
* `capturing`: canvas extraction is in progress.
* `captured`: the user accepted a pending capture.
* `denied`: permission was refused.
* `no_camera`: no video input was found.
* `overconstrained`: preferred constraints could not be satisfied.
* `error`: an unknown normalized failure occurred.

### Comparison

* `not_available`: no valid follow up comparison exists.
* `comparable`: user confirmed conditions support comparison.
* `partially_comparable`: changed conditions or overlap reduce interpretability.
* `not_comparable`: a verdict is refused.

### Confidence

* `insufficient`, `possible`, `likely`, `confirmed`.
* The mock adapter provides fixture confidence. The reducer permanently caps an overlap retained observation at `possible`.

### Evidence disposition

The persisted `ProductPlacement` union remains the domain record for routine disposition:

* `established`
* `observation`
* `cooling`
* `paused`
* `useful_elsewhere`
* `unclear`
* `retry_alone`
* `released`

The internal `cooling` value means outside the active observation window. It is never rendered as refrigeration, a shelf, or a user facing location.

## Guarded transitions

| Internal event | Valid source | Production result | Rejected when |
| --- | --- | --- | --- |
| `OPEN_CABINET` | `welcome` | Evidence Index opens | any other stage |
| `BROWSE_DRAWERS` | `cabinet` | finite cassette selector | wrong stage |
| `PREVIOUS_DRAWER` | `browse` | selected cassette index decreases by one | first cassette or wrong stage |
| `NEXT_DRAWER` | `browse` | selected cassette index increases by one | final cassette or wrong stage |
| `OPEN_DRAWER` | `browse` | selected cassette enters specimen inspection | wrong stage |
| `ASSIGN_JOB` | `specimen`, `job` | evidence role stored; baseline becomes pending | wrong stage |
| `BEGIN_CAPTURE: baseline` | `job` | baseline Capture Contract | no assigned job stage |
| `BEGIN_CAPTURE: followup` | `observation`, `analysis_failure`, `comparison_refused` | follow up Capture Contract | wrong stage |
| `CONFIRM_CONTRACT` | `capture_contract` | camera stage, or refusal for `not_comparable` follow up | wrong stage |
| `CAMERA_REQUESTED` | `camera` | `requesting` | wrong stage |
| `CAMERA_READY` | `camera + requesting` | `ready` | permission state does not match |
| `CAMERA_CAPTURING` | `camera + ready` | `capturing` | stream is not ready |
| `CAMERA_FAILED` | `camera` | stable normalized failure state; file input remains | wrong stage |
| `CAPTURE_ACCEPTED` | `camera` and metadata kind matches current capture kind | baseline activates observation; follow up opens analysis | wrong stage or mismatched capture kind |
| `DELETE_CURRENT_CAPTURE` | `camera` | pending metadata resets; component revokes bytes and URL | wrong stage |
| `ADD_TRACE` | `observation + active_stable` | one evidence rail event stored | unstable or wrong stage |
| `INTRODUCE_SECOND_PRODUCT` | `observation` with trace | interference decision | no trace or wrong stage |
| `RESOLVE_DISTURBANCE: cooling` | `disturbance` | secondary cassette removed from the observation window | wrong stage |
| `RESOLVE_DISTURBANCE: overlap` | `disturbance` | overlap retained, partial comparison, confidence `possible` | wrong stage |
| `ANALYSIS_STARTED` | `analysis` | processing announcement only | wrong stage |
| `ANALYSIS_SUCCEEDED` | `analysis` | result stored; overlap confidence stays capped | wrong stage |
| `ANALYSIS_FAILED` | `analysis` | `analysis_failure`; no result created | wrong stage |
| `RETAKE_FOLLOWUP` | `analysis_failure`, `comparison_refused` | fresh follow up contract | wrong stage |
| `SAVE_CONTEXT_ONLY` | `comparison_refused` | observation waits without verdict | wrong stage |
| `ENTER_PROGRESS` | `analysis` with a comparable result | Evidence Cassette V7 verdict | no result or not comparable |
| `SELECT_PLACEMENT` | `progress`, `placement` | evidence disposition selected | wrong stage |
| `SEAL_PLACEMENT` | `placement` with result and job | disposition committed | missing result or wrong stage |
| `GENERATE_RECORD` | committed `placement` | face free Evidence Record generated | disposition not committed, missing result, or wrong stage |
| `VIEW_ARCHIVE` | any active stage | Evidence Archive with return stage preserved | never rejected |
| `VIEW_RECORD` | archive navigation | selected record opens | never rejected |
| `RETURN_TO_CABINET` | any active stage | Evidence Index restored | never rejected |
| `DELETE_OBSERVATION` | any active observation stage | current observation resets; existing archive remains | never rejected |
| `CLEAR_DEMO_DATA` | any stage | complete fixture reset | never rejected |
| `BACK` | browse, verdict, archive, record, capture states | exact semantic parent restored | otherwise unchanged |

## Disturbance invariant

Removing C2–01 from the active observation window restores stable attribution before the follow up. Continuing with overlap writes `overlap_retained` into domain state. The mock adapter returns the reduced confidence scenario, the reducer caps confidence at `possible`, the verdict displays the retained condition, and the Evidence Record preserves both confidence and disturbance.
