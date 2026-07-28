# Architecture

## Domain boundaries

`src/domain/model.ts` defines observation, camera, comparison, confidence, product-overlap, placement, capture, analysis, and durable saved-result types. The pure reducers in `src/app/phaseBMachine.ts` and `src/domain/oracleRevealMachine.ts` own all guarded transitions. React renders state; it does not infer scientific or durable state from visual effects.

A small set of original MVP field and event names remains internal for persisted-state compatibility. They are not presentation vocabulary. Default UI and accessibility use trial, note, follow-up scan, result, next step, saved result, and Past results.

## Production journey boundary

The public application exposes one state-machine journey. There is no standalone result fixture route. `FaceValueApplication` mounts `OracleRevealScene` only after reducer-authorized analysis. That scene owns one persistent dark machine from sealed result through collection; the application remains in the analysis stage until Done.

Persisted `review_due` state returns through `OPEN_REVIEW_DUE`: a saved follow-up resumes automatic analysis, while a comparable result resumes its stable Oracle Reveal phase. Transient motion phases resume safely from the same reducer state and the UI does not reconstruct a second result model.

Temporary React state is limited to presentation concerns: disclosure state, note draft state, focus restoration, and pointer gesture tracking. It does not own comparison, recommendation, placement, record generation, archive insertion, or route state.

## Automatic comparison boundary

An accepted follow-up scan transitions the reducer into `analysis`. A guarded
effect dispatches `COMPARISON_CREATED` once for the matched durable signals.
The reducer invokes `buildMvpRednessEvaluation`, which constructs honest
one-session evidence and calls the deterministic redness evaluator. The
resulting versioned snapshot is adapted once into the existing comparison,
analysis, placement, and `VerdictViewModel` boundaries.

Production does not accept a caller-supplied redness verdict and does not expose
separate actions to run comparison or enter result review. Scientific
thresholds, direction, attribution, and safety logic live under
`src/domain/evidence/redness`; no React component owns them.

## Evidence collection boundary

`EVIDENCE_COLLECTED` is the production transaction for a completed result decision. It is accepted only after recommendation acceptance, dispensing, and an explicit collection start. The reducer:

1. preserves the accepted next step and commit timestamp
2. creates a durable result containing the full evidence context
3. inserts it only when its deterministic identifier is not already present
4. marks the trial complete and the evidence collected
5. keeps the completed machine mounted until `ORACLE_DONE`

`ORACLE_DONE` is the only transition that returns to home base. Repeated Keep, collection, animation callbacks, restoration, back navigation, and Past Results reopening do not create duplicates.

Legacy event names remain internal compatibility paths for persisted-state migration. They are not production controls.

## Hardware presentation boundary

`src/features/oracle-reveal` is the only result-machine component family:

- `OracleRevealScene` binds application state, focus, disclosures, haptics, and semantic actions.
- `OracleMachine` preserves one chassis, glass opening, lower control deck, amber control, slot, rollers, rail, and paper coordinate system.
- the reveal handle owns native click, Enter, Space, pointer drag, cancellation, and lost-capture behavior.
- animation completion dispatches narrow reducer events; it never writes durable data.

The machine phases are `sealed`, `opening`, `transmitting`, `verdict_revealed`, `committing`, `dispensing`, `collected`, and `done`. Duplicate and invalid events return the same reducer model.

## Optical boundary

The sealed glass renders optical haze and a non-semantic silhouette only. Result and recommendation nodes are not created until their authorized phases. Firmware remains live HTML inside the fixed display opening; reduced motion preserves the same state order with one-millisecond mechanical transitions.

## Adapter boundaries

- `adapters/camera`: browser support, permission negotiation, stable errors, stream lifecycle, frame capture, and object URL cleanup.
- `adapters/analysis`: typed provider requests, durable `raw_score`
  normalization, and the single YouCam-to-redness-evidence adapter.
- `adapters/persistence`: structured local persistence, canonical snapshot
  validation, and non-destructive legacy compatibility.
- `adapters/haptics`: optional capability behind safe no-op behavior.
- `adapters/clock`: injectable time source for durable artifacts.

## Data flow

User action → typed reducer event → guarded provider request → normalized
`hd_redness.raw_score` → canonical evidence adapter → deterministic evaluator →
versioned snapshot → `VerdictViewModel` → sealed oracle → Reveal → transmission
→ Keep → dispense → explicit collection → idempotent saved result → Done → home
base.

Visual motion never advances scientific state or persists a record. `animationend` callbacks advance only the already-authorized mechanical state.

## Image lifecycle

Camera or file bytes are held only inside `CameraViewport`. A temporary object URL supports the private preview. The reducer receives metadata, not Blob bytes. Cleanup stops media tracks and revokes URLs when captures change, are deleted, the user leaves the screen, or the component unmounts.

## Why raw images are not persisted

The golden path needs continuity of trial state, not a permanent face-image archive. Excluding images minimizes risk, keeps saved results portable, and preserves a clean future boundary for encrypted storage, explicit consent records, and authenticated server processing.

See `oracle-reveal-v1.md` for the transition, motion, persistence, accessibility, and verification contracts.
See `redness-evidence-engine-v1.md` for source provenance, evaluator,
threshold, migration, fixture, and claims contracts.
