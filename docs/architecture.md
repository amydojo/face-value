# Architecture

## Domain boundaries

`src/domain/model.ts` defines observation, camera, comparison, confidence, product-overlap, placement, capture, analysis, and durable saved-result types. The pure reducer in `src/app/machine.ts` owns all guarded transitions. React renders state; it does not infer scientific state from visual effects.

A small set of original MVP field and event names remains internal for persisted-state compatibility. They are not presentation vocabulary. Default UI and accessibility use trial, note, follow-up scan, result, next step, saved result, and Past results.

## Production journey boundary

The public application exposes one state-machine journey. There is no standalone result fixture route. `FaceValueApplication` passes the selected specimen, assigned job, analysis result, comparison, confidence, and product-overlap state into `EvidenceVerdict` only after reducer-authorized analysis.

Persisted `review_due` state returns through `OPEN_REVIEW_DUE`: a saved follow-up resumes automatic analysis, while a saved comparable result resumes the V7 result. The UI does not duplicate or reconstruct result navigation state.

Temporary React state is limited to presentation concerns: disclosure state, note draft state, focus restoration, and one animation handoff. It does not own comparison, recommendation, placement, record generation, archive insertion, or route state.

## Automatic comparison boundary

An accepted follow-up scan transitions the reducer into `analysis`. A guarded effect invokes the existing typed `AnalysisAdapter` once per follow-up capture identifier and dispatches `ANALYSIS_STARTED`, then `ANALYSIS_SUCCEEDED` or `ANALYSIS_FAILED`.

Production does not expose separate actions to run comparison or enter result review. Deterministic scenario controls remain development and test only.

## Save boundary

`SAVE_RESULT` is the production transaction for a completed result decision. It requires the placement stage and a valid analysis result. The reducer:

1. preserves the recommended or overridden placement
2. marks the trial complete and sealed
3. creates a durable result containing the full evidence context
4. inserts it only when its deterministic identifier is not already present
5. leaves the object in its classified state for the confident reseal

`OPEN_SAVED_RESULT` opens that same record after the reseal. Repeated activation, restoration, back navigation, and Past results reopening do not create duplicates.

Legacy `SEAL_PLACEMENT` and `GENERATE_RECORD` events remain explicit compatibility paths; they are not separate production controls.

## Hardware presentation boundary

`src/features/evidence-instrument` and `src/features/evidence-cassette` form one composable hardware family:

- `EvidenceInstrument` composes the enclosure, optical bay, specimen dock, smart glass, identity rail, rigid module, and output slot.
- `EvidenceCassetteSelector` owns finite trial browsing through explicit previous and next controls while the handle owns inspection.
- `CassetteHandle` owns tap, keyboard, pointer, touch, threshold, cancellation, lost-capture, and Escape behavior.
- `EvidenceCassette` owns the V7 result reveal and its explicit mechanical reducer.

The typed internal modes remain `index`, `active`, `review-due`, `verdict`, and `classified`. A handle-shaped visual is rendered only when a meaningful action exists. The handle never delegates activation to the whole card.

## Optical boundary

The specimen and identity are live HTML layers beneath a dedicated smart-glass overlay. Blur, tint, reflection, and clearing are applied only to glass. Presented and reduced-motion identity is full resolution with no inherited filter, opacity loss, or rasterized transform.

## Adapter boundaries

- `adapters/camera`: browser support, permission negotiation, stable errors, stream lifecycle, frame capture, and object URL cleanup.
- `adapters/analysis`: typed comparison request and deterministic mock implementation.
- `adapters/persistence`: structured local demo persistence only.
- `adapters/haptics`: optional capability behind safe no-op behavior.
- `adapters/clock`: injectable time source for durable artifacts.

## Data flow

User action → typed reducer event → guarded domain transition → semantic trial-object mode → optional adapter request → typed result event → explicit result-to-next-step mapping → `SAVE_RESULT` → confident reseal → idempotent saved result.

Visual motion never advances scientific state. Timers coordinate only a presentation transition already authorized by reducer state.

## Image lifecycle

Camera or file bytes are held only inside `CameraViewport`. A temporary object URL supports the private preview. The reducer receives metadata, not Blob bytes. Cleanup stops media tracks and revokes URLs when captures change, are deleted, the user leaves the screen, or the component unmounts.

## Why raw images are not persisted

The golden path needs continuity of trial state, not a permanent face-image archive. Excluding images minimizes risk, keeps saved results portable, and preserves a clean future boundary for encrypted storage, explicit consent records, and authenticated server processing.

See `production-journey-integration.md` for the language, hierarchy, gesture, optics, focus, save, fixture, and verification contracts.
