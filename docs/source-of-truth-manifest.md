# Face Value source-of-truth manifest

**Status:** Current visual-source and verification index  
**Effective date:** July 31, 2026  
**Implementation base:** `main` at merged PR #67
(`330f51975f162a2c15784114d7a448492973fcad`)

**Current change:** issue #63

This manifest identifies the current visual authorities, their intended role, and the checked-in evidence that proves implementation. A polished older Figma node or screenshot does not automatically override a newer merged system.

## 1. Conflict rule

Use sources in this order:

1. current product, design, camera, Oracle, and scientific authority documents
2. current merged components and tests
3. Figma nodes listed here for the named subsystem
4. verification evidence tied to an exact commit
5. older Figma explorations, issue mockups, and PR screenshots

Figma controls visual intent and canonical geometry only where this manifest says so. Reducer, evidence, privacy, provider, and accessibility truth remain code-and-contract concerns.

## 2. Figma file

Current Face Value design file:

- file: `Face Value · Evidence Fridge`
- URL: `https://www.figma.com/design/GKiVi4YJLm9WqozwAK3ThB`

## 3. Current subsystem sources

| Subsystem                              | Figma source                                                               | Role                                                                                                                            | Implementation evidence                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical specimen identity            | `FV / Specimen / Identity Lock` — node `512:162`                           | One labeled, locked specimen across registration, active trial, Oracle, and saved-result presentation                           | `verification/first-trial-identity-lock-v2/`, current Oracle snapshots, and merged PR #59                                            |
| Specimen ingestion states              | Loading `511:105`; Locking `512:102`; Locked `512:132`                     | Visual sequence and allowed alignment changes while preserving one specimen root                                                | `verification/first-trial-identity-lock-v2/`                                                                                         |
| Trial-pending machine continuity       | `04 · Machine Continuity / Trial Pending · Specimen Loaded` — node `483:5` | Shared machine/specimen truth for pending and follow-up-ready continuity                                                        | `verification/machine-continuity-2026-07-28/` and merged PR #59                                                                      |
| Acquisition sequence                   | Capture Sequence — node `542:99`                                           | Searching, Aligning, Locking, Scanning, and Captured composition and visual rhythm                                              | [`verification/face-value-specimen-acquisition/README.md`](verification/face-value-specimen-acquisition/README.md) and merged PR #62 |
| Three-measurement acquisition feedback | Existing Capture Sequence node `542:99` plus current implementation        | Readable scan-complete dwell, primary truthful progress, and decorative non-scientific activity field within the existing guide | [`verification/redness-evidence-burst-63/README.md`](verification/redness-evidence-burst-63/README.md)                               |
| Acquisition guide                      | Face Guide — node `536:24`                                                 | Four-arc guide geometry and authored positioning direction                                                                      | [`verification/face-value-specimen-acquisition/README.md`](verification/face-value-specimen-acquisition/README.md)                   |
| Acquisition engineering contract       | Engineering Contract V2 — node `556:135`; Capture Sequence page `534:2`    | State labels, layout relationships, guidance hierarchy, and responsive intent                                                   | [`verification/face-value-specimen-acquisition/README.md`](verification/face-value-specimen-acquisition/README.md)                   |
| Evidence Cassette lineage              | component family node `368:3295`                                           | Historical chassis and physical grammar lineage only; not a second current component implementation                             | current Oracle machine and `oracle-reveal-v1.md`                                                                                     |
| Historical sealed result               | node `342:2752`                                                            | Visual lineage for sealed evidence restraint                                                                                    | current Oracle sealed state tests                                                                                                    |
| Historical presented result            | node `343:2578`                                                            | Visual lineage for reveal clarity and specimen presentation                                                                     | current Oracle verdict state tests                                                                                                   |

## 4. Current implementation authority by surface

### First trial and specimen

Current production components:

- `src/features/first-trial/FirstTrialScene.tsx`
- `src/features/oracle-reveal/IdentityLockSpecimen.tsx`
- `src/features/oracle-reveal/IdentityLockSpecimen.module.css`
- `src/features/oracle-reveal/OracleRevealScene.tsx`
- `src/features/product-registration/ProductRegistration.tsx`

The machine and specimen roots must remain continuous across registration and
job confirmation. The same `IdentityLockSpecimen` must remain labeled, locked,
and seated through follow-up, sealed result, reveal, saving, dispensing,
collection, and latest-verdict presentation. Active identity comes from the
canonical registered product; saved presentation comes from the immutable
record snapshot. No route-specific duplicate specimen is allowed.

### Trial pending and Home

Current production components:

- `src/features/FaceValueApplication.tsx`
- `src/features/oracle-reveal/OracleRevealScene.tsx`
- `src/styles/FaceValue.module.css`

Current Home vocabulary is **Previous Trials**, not Past Results.

### Acquisition

Current production components:

- `src/features/capture-contract/CameraViewport.tsx`
- `src/features/capture-sequence/*`
- `src/adapters/camera/youcam-camera-kit/nativeBrowserCameraAdapter.ts`

Production uses the first-party browser video surface. Camera Kit is diagnostic only.

### Result and evidence collection

Current production components:

- `src/features/oracle-reveal/*`
- `src/domain/oracleRevealMachine.ts`

Current mechanical phases and durable collection semantics are defined in `oracle-reveal-v1.md`. Historical V7 door-state diagrams do not override the Oracle reducer.

The registered product label remains visible in sealed Oracle snapshots; this
known identity does not weaken the result-privacy boundary. Verdict copy is not
an authority for reconstructing the active specimen.

### Evidence Record

Current production components:

- `src/features/evidence-record/EvidenceRecord.tsx`
- `src/features/evidence-record/evidenceRecordViewModel.ts`

Evidence Record detail renders the saved immutable snapshot. It does not re-run scientific interpretation.

## 5. Verification evidence

### Acquisition

[`verification/face-value-specimen-acquisition/README.md`](verification/face-value-specimen-acquisition/README.md) contains privacy-safe synthetic WebKit renders and the physical-iPhone release checklist.

The checked-in screenshots prove fixture rendering, responsive layout, guide
continuity, the 1.8-second scan-complete timing contract, truthful progress
hierarchy, decorative activity-field presentation, confirmation hold, and
browser behavior only. They do not prove physical camera framing, real provider
behavior, or physical-device acceptance.

### First-trial identity lock

`verification/first-trial-identity-lock-v2/` contains:

- empty instrument
- blank and completed registration preview
- materializing, loading, locking, confirming, and ready
- trial pending
- follow-up ready
- latest verdict
- machine material comparison
- viewport captures and geometry measurements

These records support the one-machine, one-specimen continuity contract.

### Machine continuity

`verification/machine-continuity-2026-07-28/` contains cross-state comparison evidence for the shared machine family.

### Physical-device evidence

Physical source images that contain a real face remain local-only and must not be committed. A physical-device claim is valid only when a face-free verification note records:

- exact commit SHA
- deployment URL or deployment ID
- device model
- iOS and Safari version
- tested orientation and lighting conditions
- baseline and follow-up result
- camera teardown behavior
- unresolved limitations

The final exact-head physical-iPhone acceptance pass for issue #63 remains a
release gate until such a record is checked in.

## 6. Phase C source status

### #63 (current)

Adds privacy-safe acquisition-state evidence for restrained three-measurement
progress and burst recovery. The current Capture Sequence and Face Guide remain
the visual source; no second camera composition was introduced.

### #64 (planned)

Should add a focused Figma or in-browser source for the three compact trial-truth groups only when visual decisions exceed the shared control system. It must not redesign the machine.

### #65 (planned)

Internal calibration UI may use an engineering-instrument layout. It is not a consumer visual source and must remain clearly labeled preliminary/internal.

## 7. Change-control rule

Any PR that changes current machine geometry, specimen geometry, capture guide, Oracle mechanics, Evidence Record anatomy, or primary product vocabulary must:

1. identify the old and new source in this manifest
2. explain whether Figma or merged implementation is authoritative
3. update exact verification evidence
4. preserve reducer, privacy, accessibility, and scientific boundaries
5. avoid leaving both old and new nodes described as equally current

This manifest must be updated in the same PR.
