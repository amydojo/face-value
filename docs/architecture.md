# Face Value architecture

**Status:** Current architecture authority  
**Effective date:** July 30, 2026  
**Implementation baseline:** `main` after PR #62 (`e0173ee`)

## 1. Authority model

Face Value has one durable application state machine and one separate pure Oracle mechanical reducer.

The application reducer owns:

- registered product and assigned job
- trial timing and eligibility
- capture role and face-free metadata
- frozen YouCam protocol
- accepted baseline and follow-up signals
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
in-memory capture
→ protected YouCam analysis
→ normalized hd_redness.raw_score
→ DurableSkinSignal
→ canonical redness evidence adapter
→ deterministic evaluator
→ RednessEvaluationSnapshot
→ VerdictViewModel
```

At the current baseline, the ordinary live adapter supplies one accepted raw score for baseline and one for follow-up. It does not manufacture repeated frames, patient anchors, adherence, tolerance, masks, registration, segmentation, or unavailable provider metadata.

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

Canonical records render from the saved snapshot and are never re-evaluated during hydration or display.

## 9. Automatic comparison boundary

A guarded application effect requests `COMPARISON_CREATED` only when accepted baseline and follow-up evidence exist, the frozen protocol is compatible, and the comparison has not already settled.

The reducer invokes the canonical evaluator exactly once for that evidence generation. Duplicate starts and stale completions are rejected.

#63 will replace the current one-signal periods with atomic burst-backed periods while preserving this comparison boundary.

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

The sealed DOM contains no finding, score, limitation, evidence status, or recommendation. The result becomes presentationally available only after an authorized reveal transition.

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

## 15. Planned changes

- #63 extends capture, analysis orchestration, state, persistence, and evidence adapters with three-frame bursts.
- #64 adds reducer-owned trial-truth evidence before comparison readiness.
- #65 adds isolated calibration data and pure internal analysis without changing the production threshold.

Each PR must update the authority index and affected contracts in the same change.

See `state-model.md`, `production-journey-integration.md`, `camera-contract.md`, `redness-evidence-engine-v1.md`, `oracle-reveal-v1.md`, and `source-of-truth-manifest.md`.