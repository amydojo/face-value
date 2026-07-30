# Face Value production journey integration

**Status:** Current journey authority  
**Effective date:** July 30, 2026  
**Implementation baseline:** `main` after PR #62 (`e0173ee`)

Face Value exposes one reducer-owned product journey. Development fixtures, diagnostics, and Demo Lab starting points project typed state into the same production components; they do not create an alternate consumer product.

## 1. First-trial continuity

The current first-time journey is:

```text
empty instrument
→ START A PRODUCT TRIAL
→ product registration inside the persistent instrument
→ live specimen identity preview
→ REGISTER AND LOAD
→ specimen materializes, loads, scans, and locks
→ Reduce visible redness confirmed
→ guided baseline capture
→ optional baseline capture context
→ baseline locked
→ trial pending
```

`FaceValueApplication` keeps one `FirstTrialScene`, one machine root, and one specimen root mounted across welcome, registration, and job confirmation. Registration draft state is local presentation state. `REGISTER_PRODUCT` is the only durable identity-commit boundary.

The journey does not insert:

- an empty archive before registration
- a generic product-success card
- a second machine
- a duplicate bottle
- a separate identity confirmation route

## 2. Returning Home

Home is reducer-derived and has two broad forms.

### Active trial

Show:

- trial status
- the same registered specimen
- baseline/follow-up timeline
- follow-up availability
- one follow-up action when eligible
- Previous Trials

The active object remains continuous with registration and baseline capture. Home does not replace it with a generic trial card.

### No active trial

Show:

- no active-trial status
- latest completed verdict when one exists
- **START A NEW TRIAL**
- **PREVIOUS TRIALS**

The archive term is **Previous Trials**.

## 3. Trial timing

The product registration freezes an expected observation window. Accepted baseline evidence stores its actual time and a reducer-owned follow-up eligibility time.

Production follow-up is rejected before eligibility. The protected demo may set an explicit `demoTimelineAdvanced` flag without rewriting the original baseline timestamp or claiming that real days elapsed.

The current default interval may be fourteen days for the registered launch job, but evaluation uses the stored product window rather than assuming one universal clinical interval.

## 4. Guided acquisition

Both baseline and follow-up use the current production acquisition sequence:

```text
Searching
→ Aligning
→ Locking
→ Scanning
→ Captured
→ YouCam processing
```

Production capture uses `NativeBrowserCameraAdapter` and the exact visible first-party `<video>` surface. Camera access starts only from an explicit user gesture.

The current local signal model may observe:

- preview availability
- whole-frame exposure
- frame-to-frame movement
- stable hold

It does not claim native face detection, pose estimation, facial landmarks, skin-tone classification, or facial registration.

The external Camera Kit renderer is available only through the development diagnostics query. It is not an alternate production camera.

## 5. Capture context

After an accepted baseline or follow-up analysis, the current optional context surface asks only about conditions the camera cannot reliably know:

- makeup
- recent heat or exercise
- recent cleansing or skincare
- routine or treatment change
- one short user-authored note

Capture context may create a limitation or confounder. It cannot increase confidence, change the deciding raw score, diagnose a condition, or manufacture attribution.

Adherence, tolerance, symptoms, and participant-observed longitudinal redness direction are separate trial-level concepts planned in #64. They must not be silently inferred from current capture context.

## 6. Evidence processing

The current ordinary path uses:

```text
accepted baseline capture
→ YouCam HD redness raw score
→ frozen durable baseline signal
→ accepted eligible follow-up capture
→ identical YouCam protocol
→ durable follow-up signal
→ canonical redness evidence adapter
→ deterministic evaluator
→ immutable RednessEvaluationSnapshot
```

The current implementation stores one accepted provider score per period. #63 will replace the live single-frame assumption with one low-friction three-measurement burst per period.

A valid follow-up automatically requests comparison. There is no consumer action to author the verdict, choose a threshold, or call a language model.

## 7. Comparison and failure behavior

Comparison succeeds only through the canonical evaluator. Provider output cannot override:

- protocol mismatch
- invalid or limited measurement evidence
- product overlap or confounders
- insufficient observation time
- safety evidence

Failure behavior must preserve already accepted evidence.

- baseline failure leaves registration and product identity safe
- follow-up failure leaves the accepted baseline and active trial safe
- protocol mismatch is rejected before an interpretive result
- timeout and provider errors offer one recoverable action
- cancellation and route teardown reject stale work and release resources
- duplicate callbacks cannot create duplicate signals, comparisons, or records

No failure path invents a result.

## 8. Sealed result

When comparison produces a canonical snapshot, the current Oracle remains mounted inside the analysis journey.

Before reveal, finding, score, evidence status, limitations, and recommendation remain absent from the rendered and accessibility trees.

The reveal sequence is authorized by the Oracle reducer:

```text
sealed
→ opening
→ transmitting
→ verdict_revealed
```

The revealed surface presents:

- the deterministic finding
- a plain-language interpretation
- evidence status
- the recommended action
- a restrained See why disclosure
- the option to choose a different next step where allowed

The Oracle does not create another result model. Firmware, paper, Home, Previous Trials, and Evidence Record detail derive from the same saved evaluation and presentation mapping.

## 9. Recommendation and collection

The current completion sequence is:

```text
verdict_revealed
→ recommendation accepted or deliberately changed
→ committing
→ dispensing
→ evidence presented
→ collection started
→ EVIDENCE_COLLECTED
→ collected
→ ORACLE_DONE
→ Home
```

The durable Evidence Record is created only at `EVIDENCE_COLLECTED`.

- recommendation acceptance does not yet create the record
- animation completion does not create the record
- paper registration does not create the record
- collection callbacks are idempotent
- `ORACLE_DONE` returns Home only after the durable record exists

The former mandatory separate next-step screen and visible `SAVE RESULT` action are historical behavior. Legacy events may remain inside migration and recovery code only.

## 10. Evidence Record continuity

One record ID is preserved across:

- Oracle paper
- explicit collection
- Evidence Record detail
- Home latest verdict
- Previous Trials
- browser reload
- progressive disclosure

Canonical records render from the saved `RednessEvaluationSnapshot`. React must not re-run thresholds, classify direction, or calculate safety during render.

Older records remain readable through legacy fields without being assigned new burst, trial-truth, mask, symptom, or calibration evidence.

## 11. Previous Trials

Previous Trials is a face-free history of completed Evidence Records.

It must not:

- contain active camera images
- include demo-clearing controls in ordinary production
- regenerate records on open
- recalculate old results under a newer threshold
- expose provider task IDs, signed URLs, or raw payloads

Opening a record preserves the selected record and a deterministic Back destination.

## 12. Demo Lab and protected tools

Demo Lab is an internal instrument behind the existing engineering-session boundary.

It may:

- open canonical typed fixture states
- load an isolated synthetic demo journey
- run the ordinary real-camera journey
- clear Demo Lab data without affecting ordinary trials

It may not:

- author arbitrary verdicts
- merge synthetic data into ordinary storage
- expose secrets in the client
- imply that synthetic capture is physical evidence

The planned calibration route in #65 must use the same protected boundary and an isolated calibration store.

## 13. Accessibility

The production journey preserves:

- native semantic controls
- meaningful heading focus after stage changes
- visible focus
- minimum 44 CSS-pixel controls
- one-handed mobile reach where practical
- VoiceOver names that identify object and destination
- live-region guidance only at meaningful acquisition changes
- no color-only state
- tap, keyboard, and pointer parity for reveal and collection
- deterministic Escape and Back behavior
- reduced-motion parity without skipping semantic steps

A sealed result must remain sealed for assistive technology as well as sighted presentation.

## 14. Responsive behavior

The application must support the committed mobile widths and dynamic Safari viewport changes without horizontal overflow.

During active capture:

- route bar, instruction, guide, and action rail remain reachable
- the chamber uses the available width
- visual-viewport contraction does not create false camera failure
- the page does not compete with the camera for scroll
- leaving the route stops camera activity

Registration, Home, trial pending, follow-up ready, Oracle, record detail, and Previous Trials remain natively scrollable when content exceeds the visible height.

## 15. Current verification story

Automated proof includes:

- reducer legality and idempotency
- provider contract and failure fixtures
- raw-score-only architecture guards
- sealed-state DOM and accessibility checks
- Oracle exactly-once collection
- persistence and legacy hydration
- first-trial machine/specimen continuity
- Mobile WebKit acquisition sequence and visual viewport behavior
- compiled-client privacy scan

Synthetic WebKit evidence is not physical-device proof. A final exact-head physical-iPhone golden-path pass remains a release gate and must record the tested commit, device, browser, conditions, and result.

## 16. Planned journey changes

### #63

The user still experiences one scan, while the system collects three genuine provider measurements and commits one burst-backed evidence period atomically.

### #64

After follow-up evidence is secured, the journey collects adherence, tolerance, and participant-observed redness direction before comparison becomes ready.

### #65

A separate protected route collects calibration observations. It does not enter consumer navigation or replace the provisional production threshold.

## 17. Non-goals

This journey does not add:

- multiple active product trials
- a multi-concern dashboard
- automatic product or ingredient identification
- diagnosis or treatment advice
- cloud accounts
- permanent face storage
- an LLM verdict layer
- another cassette or Oracle implementation

See `product-contract.md`, `state-model.md`, `architecture.md`, `camera-contract.md`, `redness-evidence-engine-v1.md`, and `oracle-reveal-v1.md`.