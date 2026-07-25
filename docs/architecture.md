# Architecture

## Domain boundaries

`src/domain/model.ts` defines observation, camera, comparison, confidence, disturbance, placement, capture, analysis, and Evidence Record types. The pure reducer in `src/app/machine.ts` owns all guarded transitions. React renders state; it does not infer scientific state from visual effects.

A small set of original MVP field and event names remains internal for persisted state compatibility. They are not presentation vocabulary. New UI, accessibility, analytics, tests, and documentation use Evidence Index, cassette, interference, disposition, and archive semantics.

## Production journey boundary

The public application exposes one state-machine journey. There is no standalone verdict fixture route. `FaceValueApplication` passes the selected specimen, assigned job, real analysis result, comparison, confidence, and disturbance state into `EvidenceVerdict` only after the reducer accepts `ENTER_PROGRESS`.

Persisted `review_due` state returns through `OPEN_REVIEW_DUE`: a saved follow-up resumes analysis, while a saved comparable result resumes the verdict. The UI does not duplicate or reconstruct verdict navigation state.

## Hardware presentation boundary

`src/features/evidence-instrument` and `src/features/evidence-cassette` form one composable hardware family:

- `EvidenceInstrument` composes the fixed enclosure, shallow optical bay, specimen dock, persistent smart glass, mounted identity rail, rigid cassette module, and independent output slot.
- `EvidenceCassetteSelector` owns finite indexed browsing through explicit controls while the cassette handle owns activation.
- `CassetteHandle` owns the shared tap, keyboard, pointer, touch, threshold, cancellation, and Escape contract.
- `EvidenceCassette` owns the ceremonial verdict reveal and its explicit mechanical reducer.

The typed production modes are `index`, `active`, `review-due`, `verdict`, and `classified`. General screens do not copy the verdict implementation; they compose the same handle and physical grammar with mode-specific destinations.

## Optical boundary

The specimen and identity are live HTML layers beneath a dedicated smart-glass overlay. Blur, tint, reflection, and clearing are applied only to glass. Presented and reduced-motion identity is full resolution with no inherited filter, opacity loss, or rasterized transform.

## Adapter boundaries

- `adapters/camera`: browser support, permission negotiation, stable errors, stream lifecycle, frame capture, and object URL cleanup.
- `adapters/analysis`: typed comparison request and deterministic mock implementation.
- `adapters/persistence`: structured local demo persistence only.
- `adapters/haptics`: optional capability behind safe no-op behavior.
- `adapters/clock`: injectable time source for durable artifacts.

## Data flow

User action → typed reducer event → guarded domain transition → semantic cassette mode → optional adapter request → typed result event → explicit verdict-to-placement mapping → committed disposition → idempotent Evidence Record.

Visual motion never advances scientific state. Timers only coordinate a presentation transition already authorized by explicit state.

## Image lifecycle

Camera or file bytes are held only inside `CameraViewport`. A temporary object URL supports the private preview. The reducer receives metadata, not Blob bytes. Cleanup stops media tracks and revokes URLs when captures change, are deleted, the user leaves the screen, or the component unmounts.

## Why raw images are not persisted

The golden path needs continuity of observation state, not a permanent face image archive. Excluding images minimizes risk, keeps Evidence Records portable, and preserves a clean future boundary for encrypted storage, explicit consent records, and authenticated server processing.

See `production-journey-integration.md` for the routing, mode, gesture, optics, safe-area, record, fixture, and verification contracts.
