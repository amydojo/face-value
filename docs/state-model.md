# Face Value state model

**Status:** Current state authority  
**Effective date:** July 31, 2026  
**Implementation base:** `main` at merged PR #67
(`330f51975f162a2c15784114d7a448492973fcad`)

**Current change:** issue #63

Face Value uses one reducer-owned application state machine for product, evidence, navigation, persistence, and recovery. The Oracle uses a separate pure reducer for temporary mechanical phases. Events that fail their guards return the current model unchanged.

Visual motion never creates scientific evidence, chooses an action, or writes durable data.

## 1. Compatibility boundary

The state and persistence model contains older names retained to read existing local records and focused recovery fixtures. Compatibility names are not current product instructions.

Current default vocabulary includes:

- Start a new trial
- Register and load
- Trial in progress
- Follow-up ready
- Result
- Recommendation
- Evidence Record
- Previous Trials

Historical terms such as `cabinet`, `browse`, `placement`, `SAVE_RESULT`, and Past Results may remain inside migration and legacy reducer paths only.

Canonical redness records own an immutable `RednessEvaluationSnapshot`. Pre-engine records remain readable but are never reinterpreted as though they contained canonical evidence.

## 2. Application stages

The current `AppStage` union is:

```ts
| 'welcome'
| 'product_registration'
| 'cabinet'
| 'browse'
| 'specimen'
| 'job'
| 'capture_contract'
| 'camera'
| 'baseline_context'
| 'baseline_locked'
| 'waiting_for_followup'
| 'followup_ready'
| 'followup_context'
| 'observation'
| 'disturbance'
| 'analysis'
| 'analysis_failure'
| 'comparison_refused'
| 'progress'
| 'placement'
| 'record'
| 'archive'
```

Not every stage is part of the current ordinary journey. Some remain for legacy restoration and deterministic fixture coverage.

### Current ordinary journey stages

- `welcome`: empty instrument for a person without an active trial; first-trial continuity begins here.
- `product_registration`: reducer-owned product identity is being entered; the draft remains presentation state until commit.
- `job`: registered specimen is loaded and the one supported job is confirmed before baseline capture.
- `camera`: baseline or follow-up acquisition and private in-memory image handoff.
- `baseline_context`: optional context after an accepted baseline analysis.
- `baseline_locked`: stable transition acknowledging accepted baseline evidence.
- `waiting_for_followup`: active trial before its eligible date.
- `followup_ready`: active trial whose follow-up may begin.
- `followup_context`: optional context after accepted follow-up analysis.
- `analysis`: deterministic comparison and the mounted sealed Oracle.
- `analysis_failure`: provider or comparison work failed without deleting accepted evidence or fabricating a result.
- `comparison_refused`: saved evidence cannot support comparison under the frozen contract.
- `record`: one opened immutable Evidence Record.
- `archive`: Previous Trials.

### Compatibility and internal stages

- `cabinet`, `browse`, and `specimen` support older journeys, fixture projections, and restoration.
- `capture_contract`, `observation`, and `disturbance` preserve earlier explicit contract/overlap paths and focused tests.
- `progress` and `placement` remain typed compatibility stages; the current Oracle result journey stays mounted inside `analysis` and uses `oracleRevealState` rather than navigating through a mandatory separate next-step screen.

No public `/verdict` route exists. Demo fixtures do not create a second production state model.

## 3. Registered product and trial identity

`RegisteredProduct` is the current production identity. It preserves:

- stable product and accession IDs
- brand and product name
- optional strength and volume
- the supported job `Reduce visible redness`
- protocol ID `youcam-redness-v1`
- expected observation window
- registration time

Registration drafts, loading/locking animations, and transient specimen materialization are not durable until the reducer accepts `REGISTER_PRODUCT`.

The same registered identity is projected into registration, baseline readiness, trial pending, follow-up readiness, result, Evidence Record, Home, and Previous Trials.

## 4. Observation state

The current `ObservationState` values are:

- `none`: no active product trial
- `baseline_pending`: product and job exist but accepted baseline evidence does not
- `baseline`: accepted baseline exists before the active waiting state is established
- `active_stable`: one active product and job under ordinary conditions
- `active_disturbed`: another product or material trial change is present
- `waiting`: active evidence exists but no follow-up/result is available
- `review_due`: follow-up or result work can resume
- `complete`: the active trial produced one collected durable record

An active trial may render through the dedicated `waiting_for_followup` and `followup_ready` application stages while preserving this underlying observation state.

## 5. Camera state

`CameraState` remains:

- `idle`
- `unsupported`
- `requesting`
- `ready`
- `capturing`
- `captured`
- `denied`
- `no_camera`
- `overconstrained`
- `error`

Production uses `NativeBrowserCameraAdapter`. Camera readiness requires a connected visible video surface with current frame dimensions. The adapter and acquisition reducer own one camera session, cancellation authority, stable-hold timing, scan timing, capture, teardown, and stale-callback rejection.

The reducer receives face-free capture metadata. It never receives image bytes, streams, object URLs, signed upload URLs, or raw provider responses.

The current ordinary path starts one reducer-owned `ActiveRednessBurst` per
baseline or follow-up generation. It tracks face-free captured/rejected frame
evidence, sequential provider requests, accepted durable signals, and terminal
failure. The capture boundary is five attempts and the acceptance boundary is
three independently analyzed measurements.

The active generation is runtime recovery state only. It is omitted from local
persistence, and all image-bearing values remain in an ephemeral component
registry. One abort controller is authoritative for cancellation, route exit,
retry, and unmount. Events for obsolete generation identifiers are no-ops.

Post-capture presentation is a projection of that active reducer state, not a
second workflow machine. The active measurement comes from the frame index of
the currently running reducer/provider request; completed indicators come only
from accepted frames. The minimum 1.8-second scan-complete dwell and
700-millisecond progress legibility may trail those facts but never lead them.
Attempt two selects the bounded recheck copy only while its request is active.
The six-second no-progress flag is ephemeral component state, resets only on a
genuine accepted-count advance, and is never persisted or used as evidence.

`REDNESS_BURST_COMMIT_REQUESTED` immediately commits a complete burst and moves
the active burst to runtime status `committed` while the confirmation copy
remains visible. `REDNESS_BURST_PRESENTATION_COMPLETED` then clears that runtime
burst and advances the route after the approximately 800-millisecond
presentation hold. The latter event creates no evidence and is ignored unless
the same generation has already committed.

## 6. Longitudinal evidence state

`LongitudinalSkinEvidence` currently preserves:

- one frozen `AnalysisProtocol`
- one optional complete baseline `RednessEvidenceBurst`
- one optional complete follow-up `RednessEvidenceBurst`
- exactly three accepted `DurableSkinSignal` observations per complete burst
- face-free accepted and rejected frame metadata
- one compatibility `RednessComparison`
- one optional canonical `RednessEvaluationSnapshot`

Legacy baseline/follow-up single-signal fields remain optional compatibility
data. Hydration does not reinterpret them as a burst and does not recalculate
their saved record. A median must never masquerade as an original provider
signal.

`REDNESS_BURST_COMMIT_REQUESTED` is the atomic period boundary. The reducer
accepts it only when one current generation contains three unique captured
frame identifiers, three independently settled compatible provider signals,
and no unresolved request. It writes either the whole baseline/follow-up burst
or nothing.

Canonical evaluation owns:

- baseline and endpoint period aggregation
- raw-score delta
- effect classification
- measurement quality
- attribution quality
- evidence quality
- safety status
- recommended action
- limitations, missing evidence, rules, and audit trace

React renders these values. It does not derive them.

## 7. Comparison and evidence states

Compatibility comparison values remain:

- `not_available`
- `comparable`
- `partially_comparable`
- `not_comparable`

Canonical redness uses separate fields instead of collapsing all meaning into one confidence value:

- effect: worsened, no detectable change, directional improvement, meaningful candidate, or strong improvement
- measurement: invalid, limited, adequate, or strong
- attribution: blocked, weak, moderate, or strong
- evidence: insufficient, possible, or likely
- safety: clear, check required, or interrupted
- action: keep, test longer, retry alone, not proving job, or safety interruption

The compatibility confidence field remains available for old presentation and records. It cannot override canonical evidence fields.

## 8. Current action mapping

Canonical redness actions map into compatibility placement values through one typed adapter:

| Redness action        | Compatibility placement |
| --------------------- | ----------------------- |
| `keep`                | `established`           |
| `test_longer`         | `paused`                |
| `retry_alone`         | `retry_alone`           |
| `not_proving_job`     | `useful_elsewhere`      |
| `safety_interruption` | `released`              |

Unknown values fail explicitly. UI components do not invent a fallback placement.

## 9. Current guarded journey transitions

The current high-level production sequence is reducer-authorized:

```text
START_PRODUCT_REGISTRATION
→ REGISTER_PRODUCT
→ BEGIN_CAPTURE(baseline)
→ BASELINE_ANALYSIS_STARTED
→ BASELINE_ANALYSIS_ACCEPTED
→ CAPTURE_CONTEXT_RECORDED
→ FINISH_BASELINE_SESSION
→ CHECK_FOLLOWUP_ELIGIBILITY
→ BEGIN_CAPTURE(followup)
→ FOLLOWUP_ANALYSIS_STARTED
→ FOLLOWUP_ANALYSIS_ACCEPTED
→ CAPTURE_CONTEXT_RECORDED
→ COMPARISON_CREATED
→ Oracle mechanical events
→ EVIDENCE_COLLECTED
→ ORACLE_DONE
```

Important guards:

- product identity commits once per registration event
- baseline must be accepted before the trial can wait or become follow-up eligible
- follow-up work requires an accepted baseline and identical frozen protocol
- provider failure preserves existing accepted evidence
- duplicate request identities are rejected
- stale completion cannot settle a newer retry or cancelled generation
- comparison cannot exist without required accepted evidence
- a saved evaluation snapshot cannot be replaced by a render-time recalculation
- one deterministic record ID may enter Previous Trials once

The exact reducer includes additional recovery, demo, legacy, and migration events. Those paths must preserve these invariants.

## 10. Oracle mechanical state

The current Oracle reducer phases are:

```text
sealed
→ opening
→ transmitting
→ verdict_revealed
→ committing
→ dispensing
→ collected
→ done
```

Canonical events include:

- `REVEAL_STARTED`
- `REVEAL_PULL_COMPLETED`
- `TRANSMISSION_COMPLETED`
- `RECOMMENDATION_ACCEPTED`
- `DISPENSE_STARTED`
- `EVIDENCE_DISPENSED`
- `EVIDENCE_COLLECTION_STARTED`
- `EVIDENCE_COLLECTED`
- `ORACLE_DONE`

The Oracle reducer coordinates only authorized presentation and collection phases.

- Reveal does not create a result.
- Recommendation acceptance does not create a record.
- Dispense animation does not create a record.
- `EVIDENCE_COLLECTION_STARTED` locks the collection gesture.
- `EVIDENCE_COLLECTED` is the current exactly-once durable record boundary.
- `ORACLE_DONE` returns to Home after the record exists.

The Oracle mechanical model does not own product identity. During an active
result, one complete identity adapter projects `state.registeredProduct` into
the existing `IdentityLockSpecimen`. Saved latest/history/detail surfaces
project the immutable Evidence Record product snapshot. Sealed-state privacy
hides verdict fields, not the already-known locked product identity.

Historical V7 door-state sequences remain design provenance, not the current production reducer.

## 11. Persistence and restoration

Persistence stores structured, face-free application data. Restoration resolves interrupted work to a legal stable state:

- interrupted registration returns to a safe first-trial state
- interrupted baseline capture without committed evidence returns to registered
  baseline readiness
- interrupted follow-up capture without committed evidence returns to follow-up
  readiness
- a reload during the short committed confirmation presentation resumes the
  appropriate baseline or follow-up context with the already-durable burst
- accepted baseline resumes context, locked, waiting, or ready state
- accepted baseline and follow-up evidence resume deterministic comparison
- sealed and revealed Oracle states remain semantically sealed or revealed
- interrupted mechanical phases resume from authorized stable state
- dispensed evidence returns in its collection position
- collected evidence returns with the same record ID
- no image is restored

Legacy records hydrate through explicit compatibility adapters. They are not assigned evidence they never contained.

## 12. Automatic comparison invariant

A guarded application effect requests comparison only when:

- the application is in `analysis`
- complete baseline and follow-up bursts exist, or a readable legacy pair exists
- no saved comparison or canonical result exists
- the current evidence request has not already been handled
- required protocol and schema guards pass

The reducer rejects duplicate starts and stale success/failure events. Scientific classification remains in `src/domain/evidence/redness`.

## 13. Exactly-once record invariant

The record generator uses a deterministic identity derived from the trial. A valid `EVIDENCE_COLLECTED` transition:

1. preserves the accepted action and commit time
2. creates the face-free record from the existing immutable evaluation
3. inserts it only when its ID is absent
4. marks evidence collected and the trial complete
5. keeps the Oracle mounted until Done

Repeated clicks, animation callbacks, collection callbacks, reload, Home rendering, Previous Trials, and record disclosure cannot create a second record.

## 14. Phase C state status

### #63 (current)

Typed burst generations, accepted/rejected frame evidence, atomic
baseline/follow-up period commits, provider settlement guards, and
stale-generation protection are implemented. Legacy single-signal records
remain readable without re-evaluation.

### #64 (planned)

Adds reducer-owned committed adherence, tolerance, symptoms, and participant-observed direction before comparison readiness.

### #65 (planned)

Adds isolated calibration observations and an exploratory internal registry. Calibration state must not merge with ordinary trial state or become a production threshold without a future approval path.

## 15. Source files

Current state truth is defined primarily by:

- `src/domain/model.ts`
- the application reducer under `src/app` and `src/domain`
- `src/domain/oracleRevealMachine.ts`
- `src/domain/evidence/redness/*`
- `src/adapters/persistence/*`
- reducer and restoration tests

See `architecture.md`, `production-journey-integration.md`, and `oracle-reveal-v1.md` for the surrounding boundaries.
