# Face Value architecture

**Status:** Current architecture authority  
**Effective date:** July 31, 2026  
**Implementation base:** `main` at merged PR #67
(`330f51975f162a2c15784114d7a448492973fcad`)

**Current change:** issue #63

## 1. Authority model

Face Value has one durable application state machine and one separate pure Oracle mechanical reducer.

The application reducer owns:

- registered product and assigned job
- trial timing and eligibility
- capture role and face-free metadata
- active burst generation, bounded attempts, and provider settlement
- frozen YouCam protocol
- atomic baseline and follow-up bursts
- context and confounders
- deterministic comparison readiness
- immutable redness evaluation
- recommended and selected action
- Evidence Record creation
- Previous Trials
- restoration and recovery

The Oracle reducer owns temporary reveal, transmission, commit, dispense, collection, and completion phases only.

React renders authorized state. It may own form drafts, disclosure state, focus restoration, and pointer tracking. It may not calculate scientific results, create records, or introduce a second navigation model.

## 2. Current production journey boundary

The public application exposes one reducer-owned journey:

```text
first-trial registration
→ baseline capture and context
→ trial pending
→ eligible follow-up capture and context
→ deterministic comparison
→ sealed Oracle
→ reveal and recommendation
→ explicit evidence collection
→ Evidence Record
→ Home / Previous Trials
```

There is no standalone production verdict route and no public fixture-result route.

`FaceValueApplication` keeps the current Oracle mounted inside the `analysis` stage until `ORACLE_DONE`. Result presentation does not reconstruct another analysis object.

## 3. Domain boundaries

`src/domain/model.ts` defines current and compatibility product state. `src/domain/evidence/redness` defines the canonical evidence types, thresholds, evaluator, interpretation, and immutable snapshot. `src/domain/oracleRevealMachine.ts` defines mechanical phases.

Older MVP fields and events remain only where needed for saved-state migration, deterministic fixtures, or recovery tests. They do not override current product and scientific contracts.

## 4. Provider and security boundary

YouCam Skin Analysis v2.1 runs through server-side routes.

```text
request protected upload slot
→ upload in-memory image to temporary signed URL
→ create hd_redness task
→ bounded polling
→ validate provider response
→ normalize durable raw_score signal
```

`YOUCAM_API_KEY` is server-only. The protected engineering token is exchanged for a signed `Secure`, `HttpOnly`, `SameSite=Strict` cookie. The cookie protects hackathon/internal tools; it is not a consumer account system.

The browser and reducer never consume raw provider payloads. The provider boundary may expose ephemeral task identity only while work is active. Task IDs, signed URLs, credentials, and raw payloads cannot enter durable state.

## 5. Production camera boundary

Production acquisition uses `NativeBrowserCameraAdapter`.

The adapter:

- starts only from an explicit user gesture
- attaches the front camera to the exact visible Face Value `<video>` surface
- waits for a connected current frame before reporting preview readiness
- measures whole-frame exposure and movement in memory
- captures the exact visible unmirrored analysis frame
- stops tracks and releases image resources on every terminal path

It does not claim native face detection, landmarks, pose measurement, facial registration, skin-tone classification, or diagnosis.

The external Perfect Corp Camera Kit renderer remains a development diagnostic harness selected only through the diagnostics query. It is not the production camera.

## 6. Analysis and evidence boundary

Current data flow:

```text
one native camera session
→ three distinct decoded in-memory frames
→ three independent protected YouCam analyses
→ three normalized hd_redness.raw_score DurableSkinSignals
→ atomic RednessEvidenceBurst commit
→ canonical redness evidence adapter
→ deterministic aggregation and evaluator
→ RednessEvaluationSnapshot
→ VerdictViewModel
```

The native adapter accepts at most five capture attempts to obtain three
current frames. Every accepted frame has a unique identifier, decoded-frame
currentness proof, and fresh exposure and movement gate evidence. Provider
orchestration is sequential and sends one independent request per frame. A
failed provider request is retried exactly once on that same frame; a second
failure rejects the generation.

Image-bearing frames live only in the acquisition component's ephemeral
registry. The reducer receives face-free frame and provider metadata, owns the
active generation, ignores stale or duplicate settlement, and commits the
complete period only after three valid analyzed measurements exist. Incomplete
generations are never serialized.

Post-capture legibility is a runtime projection over those reducer facts. The
capture machine owns the minimum 1.8-second scan-complete dwell; provider
orchestration starts as soon as all three accepted frames are available. A
runtime presentation hook may trail genuine active/completed measurements for
a 700-millisecond minimum display and may hold the confirmed state for about
800 milliseconds. It cannot start provider work, fabricate completion, affect
the atomic period commit, enter evaluator input, or persist timing state. The
decorative activity field is authored SVG/CSS with no image-reading path.

The ordinary live adapter supplies the actual three-score baseline and
follow-up arrays plus truthful rejected-frame evidence to the canonical
evaluator. It does not manufacture repeated frames, patient anchors, adherence,
tolerance, masks, registration, segmentation, or unavailable provider
metadata.

`buildMvpRednessEvaluation` is the only live bridge from compatibility state into the canonical evaluator. Retired sign-only helpers may not return to the production path.

Scientific logic under `src/domain/evidence/redness` exclusively owns:

- period aggregation
- score polarity and delta
- effect classification
- measurement quality
- attribution quality
- evidence quality
- safety status
- action mapping
- limitations and missing evidence
- rule IDs and audit trace

No React component, animation callback, provider adapter, or LLM may create or upgrade those values.

## 7. Threshold boundary

Production currently uses the immutable provisional configuration:

- detectable: 5 raw-score points
- strong: 10 raw-score points
- source: `provisional_fixture`
- version: `redness-provisional-v1`
- provisional: `true`

These are operating thresholds, not clinical-significance boundaries.

#65 may export exploratory calibration candidates. Production must reject or ignore any candidate that has not passed a future explicit approval path.

## 8. Persistence boundary

`src/adapters/persistence` owns:

- versioned local envelopes
- validation and fail-closed hydration
- non-destructive legacy compatibility
- immutable canonical evaluation snapshots
- deterministic record IDs
- isolated Demo Lab data

Durable state includes structured trial and evaluation data only. It excludes image bytes, `File`, `Blob`, object URLs, base64, signed URLs, provider task IDs, API credentials, raw provider payloads, streams, and vendor SDK instances.

Complete face-free bursts may be serialized. `activeRednessBurst` and all
ephemeral image registries, abort controllers, luma samples, streams, and
provider work are runtime-only and are omitted from persistence. Legacy
single-signal records remain readable without synthesizing bursts or
re-evaluating saved snapshots.

Canonical records render from the saved snapshot and are never re-evaluated during hydration or display.

## 9. Automatic comparison boundary

A guarded application effect requests `COMPARISON_CREATED` only when complete
baseline and follow-up burst evidence exists, the frozen protocol is
compatible, and the comparison has not already settled. Compatibility
single-signal records remain readable through the same boundary.

The reducer invokes the canonical evaluator exactly once for that evidence generation. Duplicate starts and stale completions are rejected.

The evaluator receives the accepted raw-score arrays and rejected-frame
evidence. It alone calculates period medians, direction agreement, delta,
quality, verdict, and action. React and provider adapters do not calculate or
persist a synthetic median signal.

## 10. Oracle presentation boundary

`src/features/oracle-reveal` is the only current result-machine component family.

The Oracle phases are:

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

The sealed DOM contains no finding, score, delta, confidence, limitation,
evidence status, next step, or recommendation. The result becomes
presentationally available only after an authorized reveal transition. The
already-known registered product identity is not secret result content, so the
locked labeled specimen remains visible in the chamber while the verdict stays
sealed.

The active Oracle receives one complete `OracleSpecimenIdentity` adapted from
`state.registeredProduct`; it does not reconstruct the product from a partial
verdict view model. Once collected, latest verdict, Previous Trials, and record
detail adapt the immutable saved-record product snapshot instead. Both paths
reuse `IdentityLockSpecimen`; neither creates a parallel product store or
renderer. Demo fixtures may supply their own canonical registered product only
when that fixture owns the loaded journey.

Animation callbacks may advance authorized mechanical phases. They cannot persist evidence.

## 11. Exactly-once collection boundary

`EVIDENCE_COLLECTED` is the current durable completion transaction. It is accepted only after recommendation acceptance, evidence dispense, and explicit collection start.

The application reducer then:

1. preserves the selected action and commit time
2. creates one face-free record from the existing immutable evidence
3. inserts the record only when its deterministic ID is absent
4. marks evidence collected and the trial complete
5. keeps the Oracle mounted until `ORACLE_DONE`

Repeated clicks, animation callbacks, reload, Home, Previous Trials, and record disclosure cannot create duplicates.

Historical save/placement event names remain compatibility paths only.

## 12. Demo and calibration isolation

Demo Lab uses typed synthetic state and isolated persistence. It cannot merge with ordinary trial records or author arbitrary verdicts.

The planned `/calibration/redness` route in #65 must use:

- the existing protected engineering-session boundary
- an isolated versioned calibration store
- face-free observations
- pure reproducible calculations
- exploratory outputs that cannot load as production thresholds

## 13. Resource lifecycle

Image and camera resources are temporary capabilities, not domain state.

The capture feature owns:

- live stream
- video element binding
- frame extraction
- private preview object URL where needed
- provider-request abort authority
- cleanup on success, failure, cancellation, retry, route exit, and unmount

The reducer receives only allowed metadata and normalized evidence.

## 14. Architecture guards

Current verification must reject:

- `ui_score` in production redness evidence
- scientific decision logic in React
- duplicate evaluator implementations
- caller-authored production verdicts
- provider credentials or task IDs in client persistence
- image-bearing durable state
- direct exploratory-threshold promotion
- a second result/record store
- Camera Kit diagnostics becoming the production surface

Run `npm run verify:redness-architecture`, `npm run verify:privacy`, and `npm run verify:docs`.

## 15. Phase C status

- #63 extends capture, analysis orchestration, state, persistence, and evidence adapters with three-frame bursts in this change.
- #64 adds reducer-owned trial-truth evidence before comparison readiness.
- #65 adds isolated calibration data and pure internal analysis without changing the production threshold.

Each PR must update the authority index and affected contracts in the same change.

See `state-model.md`, `production-journey-integration.md`, `camera-contract.md`, `redness-evidence-engine-v1.md`, `oracle-reveal-v1.md`, and `source-of-truth-manifest.md`.
