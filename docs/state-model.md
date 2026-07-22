# State model

Face Value uses one pure reducer. Events that do not satisfy their guard return the current state unchanged. Visual motion never advances the machine.

## State families

### Cabinet

- `closed`: initial exterior state.
- `opening`: reserved semantic phase for coordinated latch work.
- `open`: indexed drawers are available.
- `closing`: reserved semantic phase for coordinated closure and folio emergence.

### Application stage

- `welcome`: private-by-default product entry.
- `cabinet`: canonical cabinet directory and active aperture.
- `browse`: finite Observation Shelf drawer selection.
- Remaining stages move through specimen, capture, observation, disturbance, comparison, Progress Mode, placement, record, and archive.

### Observation

- `none`: no product observation exists.
- `baseline_pending`: a product job exists but baseline capture is incomplete.
- `baseline`: baseline evidence exists before a stable window is established.
- `active_stable`: one product and one job are active.
- `active_disturbed`: an overlapping product remains in the observation window.
- `waiting`: structured context remains, but no progress conclusion is available.
- `review_due`: follow-up capture or comparison is ready for review.
- `complete`: final placement is sealed and a record exists.

### Camera

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

### Comparison

- `not_available`: no valid follow-up comparison exists.
- `comparable`: user-confirmed conditions support comparison.
- `partially_comparable`: changed conditions or overlap reduce interpretability.
- `not_comparable`: Progress Mode is refused.

### Confidence

- `insufficient`, `possible`, `likely`, `confirmed`.
- The mock adapter provides fixture confidence. The reducer permanently caps an overlap-retained observation at `possible`.

### Placement

- `established`, `observation`, `cooling`, `paused`, `useful_elsewhere`, `unclear`, `retry_alone`, `released`.

## Guarded transitions

| Event | Valid source | Result | Rejected when |
| --- | --- | --- | --- |
| `OPEN_CABINET` | `welcome` | cabinet opens at drawer 1 | any other stage |
| `BROWSE_DRAWERS` | `cabinet` | finite Observation Shelf drawer browser | wrong stage |
| `PREVIOUS_DRAWER` | `browse` | index decreases by one | first drawer or wrong stage |
| `NEXT_DRAWER` | `browse` | index increases by one | final drawer or wrong stage |
| `OPEN_DRAWER` | `browse` | selected specimen opens | wrong stage |
| `ASSIGN_JOB` | `specimen`, `job` | job is stored; baseline becomes pending | wrong stage |
| `BEGIN_CAPTURE: baseline` | `job` | baseline Capture Contract | no assigned-job stage |
| `BEGIN_CAPTURE: followup` | `observation`, `analysis_failure`, `comparison_refused` | follow-up Capture Contract | wrong stage |
| `CONFIRM_CONTRACT` | `capture_contract` | camera stage, or refusal for `not_comparable` follow-up | wrong stage |
| `CAMERA_REQUESTED` | `camera` | `requesting` | wrong stage |
| `CAMERA_READY` | `camera + requesting` | `ready` | permission state does not match |
| `CAMERA_CAPTURING` | `camera + ready` | `capturing` | stream is not ready |
| `CAMERA_FAILED` | `camera` | stable normalized failure state; file input remains | wrong stage |
| `CAPTURE_ACCEPTED` | `camera` and metadata kind matches current capture kind | baseline activates observation; follow-up opens analysis | wrong stage or mismatched capture kind |
| `DELETE_CURRENT_CAPTURE` | `camera` | pending metadata resets; component revokes bytes and URL | wrong stage |
| `ADD_TRACE` | `observation + active_stable` | one Trace Rail event is stored | unstable or wrong stage |
| `INTRODUCE_SECOND_PRODUCT` | `observation` with Trace | disturbance decision | no Trace or wrong stage |
| `RESOLVE_DISTURBANCE: cooling` | `disturbance` | stable observation restored | wrong stage |
| `RESOLVE_DISTURBANCE: overlap` | `disturbance` | `overlap_retained`, partial comparison, confidence `possible` | wrong stage |
| `ANALYSIS_STARTED` | `analysis` | processing announcement only | wrong stage |
| `ANALYSIS_SUCCEEDED` | `analysis` | result stored; overlap confidence stays capped | wrong stage |
| `ANALYSIS_FAILED` | `analysis` | `analysis_failure`; no result is created | wrong stage |
| `RETAKE_FOLLOWUP` | `analysis_failure`, `comparison_refused` | fresh follow-up contract | wrong stage |
| `SAVE_CONTEXT_ONLY` | `comparison_refused` | observation waits without progress conclusion | wrong stage |
| `ENTER_PROGRESS` | `analysis` with a comparable result | Progress Mode | no result or not comparable |
| `SELECT_PLACEMENT` | `progress`, `placement` | placement stage and explicit destination | wrong stage |
| `SEAL_PLACEMENT` | `placement` with result and job | observation completes and destination is visibly sealed | missing result or wrong stage |
| `GENERATE_RECORD` | sealed `placement` | face-free Evidence Record generated | placement is not sealed, missing result, or wrong stage |
| `VIEW_ARCHIVE` | any active stage | archive with return stage preserved | never rejected |
| `VIEW_RECORD` | archive navigation | selected record opens | never rejected |
| `RETURN_TO_CABINET` | any active stage | cabinet restored | never rejected |
| `DELETE_OBSERVATION` | any active observation stage | current observation resets; existing archive remains | never rejected |
| `CLEAR_DEMO_DATA` | any stage | complete fixture reset | never rejected |
| `BACK` | browse, progress, archive, record, capture states | exact semantic parent restored | otherwise unchanged |

## Disturbance invariant

Returning C2–01 to Cooling restores stable attribution before the follow-up. Continuing with overlap writes `overlap_retained` into domain state. The mock adapter then returns the reduced-confidence scenario, the reducer caps confidence at `possible`, Progress Mode displays the retained condition, and the Evidence Record preserves both the confidence and disturbance value.
