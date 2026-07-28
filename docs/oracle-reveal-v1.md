# Oracle Reveal v1 implementation contract

Issue #47 replaces the fragmented result cassette, placement screen, release machine, and collected-result screen with one canonical Oracle machine. The dark chassis remains mounted from sealed result through evidence collection. Only Done returns to home base.

## Reducer authority

`src/domain/oracleRevealMachine.ts` is a pure mechanical reducer. Valid transitions are:

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
dispensing (paper presented)
  → EVIDENCE_COLLECTION_STARTED
dispensing (collection locked)
  → EVIDENCE_COLLECTED
collected
  → ORACLE_DONE
done
```

Duplicate events and events from an invalid phase return the same model. `EVIDENCE_COLLECTION_STARTED` is an internal guard that locks the collection boundary before removal motion starts; it does not add a user-facing verb.

The application reducer remains the durable authority. Keep records the accepted placement and commit timestamp but does not create evidence. Only a valid `EVIDENCE_COLLECTED` transition creates and archives the deterministic record. Repeated callbacks return the existing state and cannot create another archive entry.

## Mechanical motion

All durations live in `oracleTiming`. They describe different mechanisms rather than a shared UI transition:

- handle and latch use short accelerating and crisp mechanical curves
- the chassis uses controlled deceleration without bounce or overshoot
- display warm-up is electronic opacity and illumination
- the synchronization line crosses once at constant speed
- roller registration has a brief feed and pause
- the main paper feed is nearly linear and ends with a short tension settle

The paper is never reparented. Its button remains anchored to the machine, uses one vertical transform, and reports the same `oracle-machine` coordinate system at registration, midpoint, and collection. It does not rotate, scale, or fade during feed.

Reduced motion uses the same events and order. Mechanical and optical animations complete in one millisecond, eliminating theatrical waiting without bypassing Reveal, Keep, collection, or Done.

## Presentation and controls

The machine uses permanent carbon, smoked-glass, stone-paper, and amber-control materials. Amber is active only while the machine is awaiting or acknowledging Keep.

The four user-facing control verbs are:

- Reveal: the pull handle
- Keep: the hardware amber control and text action, both wired to one handler
- View: subordinate explanation, next-step choice, and evidence detail
- Done: the sole dominant completion action

The sealed render contains no finding, score, confidence, limitation, recommendation, or next step in either the DOM or accessibility tree. Firmware and paper derive their finding from the same presentation mapping.

## Refresh and navigation

Stable Oracle state is stored with structured trial metadata. Face images and Blobs remain memory-only and are excluded by the existing privacy verifier.

Reload restores the latest stable phase:

- sealed and revealed results remain in the same analysis scene
- interrupted mechanical phases safely replay their authorized animation
- fully dispensed evidence returns in its collection position
- collected evidence returns with an empty slot and Done focused

No result transition navigates. `ORACLE_DONE` clears the completed active trial, preserves the archive, and returns to home base, where Latest Evidence acknowledges the same record.

## Verification

Unit, component, integration, WebKit E2E, and visual tests cover reducer guards, sealed-state leakage, one mounted machine instance, firmware order, shared Keep intent, exact-once persistence, stable paper geometry, focus behavior, responsive viewports, reduced motion, home continuity, detail escape, archive restoration, provider boundaries, and privacy.

Visual snapshots cover sealed, opening, transmitting, verdict, committing, paper registration, paper midpoint, fully dispensed, collected, home, and evidence detail states.

RednessEvidence v1 is explicitly out of scope. Oracle Reveal changes presentation and completion flow only; it does not change thresholds, comparison signals, confidence policy, provider boundaries, or scientific interpretation.
