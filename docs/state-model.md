# Face Value state model

**Status:** Current state authority  
**Effective date:** July 30, 2026  
**Implementation baseline:** `main` after PR #62 (`e0173ee`)

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

The current ordinary path accepts one analyzed measurement per period. #63 will add a reducer-owned burst generation and atomic three-measurement period commit; that model is planned, not current.

## 6. Longitudinal evidence state

`LongitudinalSkinEvidence` currently preserves:

- one frozen `AnalysisProtocol`
- one accepted baseline `DurableSkinSignal`
- one accepted follow-up `DurableSkinSignal`
- one compatibility `RednessComparison`
- one optional canonical `RednessEvaluationSnapshot`

The compatibility single-signal fields remain current until #63 migrates the live path to burst-backed periods. A median must never masquerade as an original provider signal.

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

| Redness action | Compatibility placement |
| --- | --- |
| `keep` | `established` |
| `test_longer` | `paused` |
| `retry_alone` | `retry_alone` |
| `not_proving_job` | `useful_elsewhere` |
| `safety_interruption` | `released` |

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

Historical V7 door-state sequences remain design provenance, not the current production reducer.

## 11. Persistence and restoration

Persistence stores structured, face-free application data. Restoration resolves interrupted work to a legal stable state:

- interrupted registration returns to a safe first-trial state
- interrupted baseline capture returns to registered baseline readiness
- interrupted follow-up capture returns to follow-up readiness
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
- accepted baseline and follow-up evidence exist
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

## 14. Planned state amendments

### #63

Adds typed burst generations, accepted/rejected frame evidence, atomic baseline/follow-up period commits, and stale-generation protection. It must preserve legacy single-signal records without re-evaluation.

### #64

Adds reducer-owned committed adherence, tolerance, symptoms, and participant-observed direction before comparison readiness.

### #65

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