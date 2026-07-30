# Face Value Oracle Reveal v1

**Status:** Current result-machine and collection authority  
**Effective date:** July 30, 2026  
**Implementation baseline:** `main` after PR #62 (`e0173ee`)

The Oracle is the one current machine mounted from sealed result through explicit Evidence Record collection. It presents an already-authorized canonical result. It does not measure skin, evaluate redness, select thresholds, or create a second result model.

## 1. Authority separation

The application reducer owns:

- immutable redness evaluation
- recommended and selected action
- record identity and persistence
- active-trial completion
- Previous Trials
- restoration

`src/domain/oracleRevealMachine.ts` owns mechanical phases only.

React binds state, semantic controls, focus, haptics, and presentation. Animation callbacks may advance a previously authorized mechanical phase; they may not create scientific or durable state.

## 2. Mechanical reducer

Current phases and transitions are:

```text
sealed
  → REVEAL_STARTED
opening
  → REVEAL_PULL_COMPLETED
transmitting
  → TRANSMISSION_COMPLETED
verdict_revealed
  → RECOMMENDATION_ACCEPTED
committing
  → DISPENSE_STARTED
dispensing
  → EVIDENCE_DISPENSED
dispensing, paper presented
  → EVIDENCE_COLLECTION_STARTED
dispensing, collection locked
  → EVIDENCE_COLLECTED
collected
  → ORACLE_DONE
done
```

Duplicate events and invalid-phase events return the same model.

`EVIDENCE_COLLECTION_STARTED` is an internal guard that locks collection before removal motion begins. It does not add another visible step.

## 3. Durable collection boundary

Recommendation acceptance records the selected intent and commit time but does not yet create a durable record.

Only a valid `EVIDENCE_COLLECTED` application transition:

1. creates the deterministic face-free Evidence Record from the existing evaluation
2. inserts it when its ID is not already present
3. marks the active trial complete and evidence collected
4. preserves the same record for detail, Home, Previous Trials, and reload

Repeated control activation, animation callbacks, collection callbacks, Back, restoration, and disclosure changes cannot create another record.

`ORACLE_DONE` is the only result-machine transition that returns to Home.

## 4. Sealed-state privacy

Before authorized reveal, the rendered and accessibility trees contain no:

- finding
- score
- delta
- evidence status
- limitation
- recommendation
- next step

The sealed glass may render non-semantic optical haze and specimen silhouette only.

The result becomes present only after the reducer reaches `verdict_revealed`.

## 5. Presentation model

Firmware, Evidence Record paper, Home latest verdict, Previous Trials, and full Evidence Record detail derive from the same canonical saved evaluation and typed view-model adapters.

The Oracle must not:

- calculate score direction
- look up thresholds during render
- infer attribution or safety
- override the canonical action
- treat animation state as confidence
- author fallback scientific copy

The current repository includes RednessEvidence v1. The Oracle’s scope remains presentation and collection only.

## 6. Controls

Current user intents are:

- Reveal
- accept the canonical recommended action or deliberately choose an allowed alternative
- view supporting evidence
- collect the Evidence Record
- Done

Controls are semantic native elements or equivalent accessible controls. The reveal handle supports tap, Enter, Space, intentional pointer drag, cancellation, and lost-pointer recovery.

No whole-machine click target substitutes for explicit control ownership.

## 7. Mechanical motion

Different mechanisms use distinct timing and easing:

- handle and latch: short and crisp
- chassis reveal: controlled deceleration without bounce
- display warm-up: optical/electronic transition
- transmission: one deliberate pass
- roller registration: brief feed and pause
- paper dispense: near-linear feed with restrained tension settle
- collection: one locked removal path

The paper is never reparented. It remains in one Oracle coordinate system, moves vertically, and does not rotate, scale, or fade as a substitute for feed.

No particles, confetti, springy toy motion, or looping glow are permitted.

## 8. Reduced motion

Reduced motion preserves:

- sealed-state privacy
- reveal authorization
- recommendation acceptance
- committing
- evidence dispense
- collection
- exactly-once record creation
- Done

It removes long travel, micro-tilt, overshoot, and ceremonial delay. It does not bypass state or create an alternate completion path.

## 9. Refresh and restoration

Stable Oracle state is persisted as structured face-free trial metadata.

Restoration rules:

- sealed result remains sealed
- revealed result remains revealed
- interrupted mechanical phases resume from an authorized stable phase
- fully dispensed evidence returns in its collection position
- collected evidence returns with the same record ID and empty slot
- no image is restored
- `ORACLE_DONE` returns Home while preserving Previous Trials

## 10. Evidence artifact continuity

The same record identity must exist across:

- paper firmware
- dispense
- collection
- Evidence Record detail
- Home latest verdict
- Previous Trials
- reload

The artifact front remains concise. Full technical evidence, raw values, threshold provenance, rule IDs, and audit trace belong in progressive disclosure.

#63 and #64 may add burst and trial-truth details to the saved snapshot and full Evidence Record. They must not create a new paper or Oracle state machine.

## 11. Accessibility

Verification must preserve:

- sealed content absent from assistive technology
- contextual accessible names
- visible focus
- logical focus movement at phase changes
- tap, keyboard, and pointer parity
- at least 44-pixel controls
- no color-only meaning
- deterministic cancellation
- reduced-motion parity
- no duplicate announcements from animation frames

## 12. Privacy

The Oracle receives and renders face-free evaluation and record data only.

It must not receive:

- face image bytes
- `File` or `Blob`
- object or data URLs
- provider task IDs
- signed upload URLs
- raw provider responses
- API credentials

## 13. Verification

Current test coverage should include:

- reducer guards and invalid events
- sealed-state DOM and accessibility leakage
- one mounted machine instance
- firmware and paper content agreement
- recommended-action and alternative-action flow
- exact-once `EVIDENCE_COLLECTED`
- stable paper geometry
- focus and input behavior
- responsive viewports
- reduced motion
- Home continuity
- Evidence Record and Previous Trials restoration
- provider and privacy boundaries

Visual snapshots cover the meaningful stable and transitional phases without claiming that screenshots prove physical-device behavior.

## 14. Change control

Any Oracle change must preserve:

- one machine family
- one scientific result source
- one durable record generator
- sealed-state privacy
- explicit collection
- stable artifact identity
- reducer-owned completion

A Phase C issue may extend evidence content but must not redesign Oracle mechanics unless a correctness problem is separately reviewed.