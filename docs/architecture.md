# Architecture

## Domain boundaries

`src/domain/model.ts` defines observation, camera, comparison, confidence, disturbance, placement, capture, analysis, and Evidence Record types. The pure reducer in `src/app/machine.ts` owns all guarded transitions. React renders state; it does not infer scientific state from visual effects.

A small set of original MVP field and event names remains internal for persisted state compatibility. They are not presentation vocabulary. New UI, accessibility, analytics, tests, and documentation must use Evidence Index, cassette, interference, disposition, and archive semantics.

## Hardware presentation boundary

`src/features/evidence-instrument` owns the restrained app wide hardware family:

* `EvidenceInstrument` composes the fixed enclosure, shallow optical bay, specimen dock, persistent smart glass, mounted identity rail, rigid cassette module, and independent output slot.
* `EvidenceCassetteSelector` owns finite indexed browsing and intentional horizontal drag.
* `src/features/evidence-cassette` owns the ceremonial verdict reveal and its explicit reducer.

General browsing, observation, disturbance, and disposition do not reuse the verdict reducer. Each interaction keeps a small state model appropriate to its physical responsibility.

## Adapter boundaries

* `adapters/camera`: browser support, permission negotiation, stable errors, stream lifecycle, frame capture, and object URL cleanup.
* `adapters/analysis`: typed comparison request and deterministic mock implementation.
* `adapters/persistence`: structured local demo persistence only.
* `adapters/haptics`: optional capability behind safe no op behavior.
* `adapters/clock`: injectable time source for durable artifacts.

## Data flow

User action → typed reducer event → guarded domain transition → semantic hardware state → optional adapter request → typed result event → durable structured state.

Visual motion never advances scientific state. Timers only coordinate a presentation transition already authorized by explicit state.

## Image lifecycle

Camera or file bytes are held only inside `CameraViewport`. A temporary object URL supports the private preview. The reducer receives metadata, not Blob bytes. Cleanup stops media tracks and revokes URLs when captures change, are deleted, the user leaves the screen, or the component unmounts.

## Why raw images are not persisted

The golden path needs continuity of observation state, not a permanent face image archive. Excluding images minimizes risk, keeps Evidence Records portable, and preserves a clean future boundary for encrypted storage, explicit consent records, and authenticated server processing.
