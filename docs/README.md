# Face Value documentation authority

**Status:** Current repository index  
**Effective date:** July 30, 2026  
**Current implementation baseline:** `main` after PR #62 (`e0173ee`)

This index separates current product truth, planned implementation, historical records, and verification evidence. A planned issue or historical document does not override merged code or a current authority document.

## Conflict-resolution order

When documentation disagrees, use this order:

1. current merged domain types, reducer guards, provider adapters, and tests
2. current narrow authority documents listed below
3. current implementation issues whose dependencies are satisfied
4. verification records tied to an exact commit
5. historical implementation records
6. old issue bodies and pull-request descriptions

A pull request that changes product, scientific, camera, privacy, or Oracle behavior must update the relevant authority document in the same change.

## Current authorities

| Area | Authority | Scope |
| --- | --- | --- |
| Product | [`product-contract.md`](product-contract.md) | Current supported job, journeys, result actions, claims, privacy, and completion contract |
| Architecture | [`architecture.md`](architecture.md) | Reducer, provider, evaluator, persistence, Oracle, and image-lifecycle boundaries |
| State | [`state-model.md`](state-model.md) | Current application stages, evidence state, Oracle phases, restoration, and compatibility |
| Journey | [`production-journey-integration.md`](production-journey-integration.md) | First trial, follow-up, result, Home, Previous Trials, failure, and recovery |
| Camera | [`camera-contract.md`](camera-contract.md) | Native production acquisition and Camera Kit diagnostic boundary |
| Scientific engine | [`redness-evidence-engine-v1.md`](redness-evidence-engine-v1.md) | Current redness evaluator, provisional thresholds, snapshot, and evidence limitations |
| Provider/security | [`youcam-evidence-engine-contract.md`](youcam-evidence-engine-contract.md) | Current YouCam API, signed engineering session, normalization, errors, and privacy |
| Oracle | [`oracle-reveal-v1.md`](oracle-reveal-v1.md) | Current mechanical reducer and exactly-once collection boundary |
| Design | [`design-contract.md`](design-contract.md) | Current instrument grammar, material, interaction, accessibility, and responsive laws |
| Visual sources | [`source-of-truth-manifest.md`](source-of-truth-manifest.md) | Current Figma nodes and checked-in verification evidence |
| Execution | [`youcam-evidence-engine-roadmap.md`](youcam-evidence-engine-roadmap.md) | Completed phases and remaining #63–#65 sequence |

## Current implementation truth

At the current baseline:

- production acquisition uses `NativeBrowserCameraAdapter`
- the external Camera Kit renderer is diagnostic only
- ordinary trials store one accepted baseline raw score and one accepted follow-up raw score
- canonical redness evaluation uses provisional 5/10 raw-score operating boundaries
- threshold source remains `provisional_fixture`
- ordinary trial truth inputs are not yet collected
- the Oracle creates a durable Evidence Record only after explicit collection
- the archive is presented as **Previous Trials**
- no clinical-validation claim is supported

## Planned Phase C work

These issues are authoritative implementation specifications for future changes, but their behavior is not current until merged:

- #63 — three-frame redness evidence bursts
- #64 — adherence, tolerance, and participant-observed redness change
- #65 — preliminary internal calibration harness and technical evidence report

Each issue must update this index and every affected authority document in its pull request.

## Historical records

The following files preserve implementation history but do not describe current production behavior:

- [`youcam-phase-b5-implementation.md`](youcam-phase-b5-implementation.md)

Historical issue bodies and PR descriptions remain useful provenance. They are not safe implementation instructions unless a current authority explicitly points to them.

## Verification evidence

Verification records prove only the scope, environment, and commit they name.

Important current sets include:

- [`verification/face-value-specimen-acquisition/README.md`](verification/face-value-specimen-acquisition/README.md)
- `verification/first-trial-identity-lock-v2/`
- `verification/machine-continuity-2026-07-28/`

Synthetic Playwright evidence is not physical-device proof. Physical-device claims must record the exact commit, device, browser, conditions, outcome, and unresolved limitations.

## Documentation rules

Current authority documents must not:

- call the production app fixture-backed
- claim `MockOpticalAnalysisAdapter` is the only analysis implementation
- describe Camera Kit `hdskincare` as the production camera
- describe the old `SAVE_RESULT` screen flow as the current completion path
- present Previous Trials as Past Results
- present #63–#65 behavior as already shipped
- call provisional boundaries clinically meaningful or scientifically validated

Run:

```bash
npm run verify:docs
```

The verifier checks local Markdown links, required authority files, historical labels, and high-risk stale assertions.