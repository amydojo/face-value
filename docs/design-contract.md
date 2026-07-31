# Face Value design contract

**Status:** Current visual and interaction authority  
**Effective date:** July 30, 2026  
**Implementation base:** `main` at merged PR #67
(`330f51975f162a2c15784114d7a448492973fcad`)

**Current change:** issue #63

## 1. One persistent instrument

Face Value uses one precision-instrument grammar across registration, baseline readiness, trial pending, follow-up readiness, result, collection, and latest evidence.

The current physical stack is:

1. warm near-black page
2. warm graphite chassis
3. shallow black-glass chamber
4. one canonical specimen and live identity layer
5. restrained optical glass and state effects
6. manufactured lower deck and controls
7. one independent Evidence Record output slot

The instrument must not become a refrigerator, filing cabinet, oven, furniture drawer, generic card carousel, fake operating system, or deep architectural room.

## 2. Current continuity law

The same machine and specimen identity remain continuous through:

```text
empty instrument
→ registration preview
→ materializing
→ loading
→ identity locking
→ baseline ready
→ trial pending
→ follow-up ready
→ sealed result
→ reveal
→ evidence dispense
```

State changes may alter identity content, glass clarity, illumination, scan optics, firmware, controls, and authorized transforms. They must not replace the machine with unrelated markup or duplicate the specimen.

The current production Oracle is the result and collection machine. Historical Evidence Cassette V7 geometry remains design lineage, not a second production component.

## 3. Human hierarchy

Every default screen should communicate in this order:

1. current instrument or acquisition state
2. current question or consequence
3. one primary action
4. supporting context or quiet alternative

Technical evidence, alternate actions, raw measurements, destructive controls, and audit metadata belong behind progressive disclosure.

The interface must feel quieter as the person understands it. Do not accumulate helper paragraphs, repeated instructions, generic success cards, or duplicate CTAs.

## 4. Semantic color

Color has one job at a time.

- amber: machine operability, registration scan, acquisition correction/lock, and evidence indexing
- warm white: neutral information and acquisition guidance
- graphite: structure and supporting action
- cool muted neutral: system status and inactive evidence
- restrained coral/red: recoverable warning or safety interruption

Do not reuse the exact amber actuator treatment for generic page buttons, radio rows, decorative rules, or celebration.

State meaning must never depend on color alone.

## 5. Material system

Use:

- matte warm black page
- differentiated warm graphite shell, deck, chamber, recess, rail, and handle
- localized warm chamber bounce
- restrained machined edges
- dark optical glass
- one resin-like amber optic
- live HTML/CSS identity and paper evidence

Avoid:

- uniform bright outlines
- silver appliance gradients
- neon science-fiction glow
- generic frosted cards
- large orange bars
- excessive bevels
- decorative particles
- soft wellness beige
- metallic dashboard clutter

## 6. Specimen identity

`IdentityLockSpecimen` is the current canonical production specimen.

It preserves one invariant root and stable geometry across loading, locking, ready, pending, follow-up-ready, and result states. Persisted product identity is not mutated to fit the label; deterministic presentation formatting may shorten repeated brand text or extract compact strength only for the visible thermal label.

The specimen must remain:

- live HTML/CSS or SVG
- crisp at final scale
- independent from glass blur
- accessible through the surrounding machine copy
- free from baked screenshot text

No second product silhouette may appear for the same registered product.

## 7. Registration motion

The current ingestion sequence is restrained and finite:

```text
idle
→ materializing
→ loading
→ locking
→ confirming
→ ready
```

The label receives one registration scan while identity locks. It must not loop, shimmer indefinitely, animate individual characters, float, bounce, or pulse after readiness.

Reduced motion preserves identity commit and final locked state while removing travel, scan movement, pulse, and ceremonial delay.

## 8. Production acquisition design

The capture sequence is:

```text
Searching
→ Aligning
→ Locking
→ Scanning
→ 3 Measurements Accepted
→ Processing
```

The current visual contract includes:

- full-width active acquisition chamber
- one persistent four-arc guide system
- restrained connectors and anchors during lock
- one dominant instruction
- route and specimen context that remain secondary
- a broad amber optical scan plane
- same-bitmap freeze into processing
- calm recovery for permission, startup, lighting, movement, and provider failure

The authored guide is positioning direction, not proof of automated face geometry. Copy and visuals must not imply landmark tracking, skin diagnosis, or biometric identity.

During the current burst, the user still experiences one continuous scan. The
restrained three-position accepted-frame indicator remains subordinate to the
existing optic and does not turn the screen into a multi-photo checklist.
Positions use the established amber instrument language rather than generic
green success styling. The interface shows no raw redness scores, calibration
terminology, deliberate repositioning prompt, or extra shutter controls.

Recoverable capture rejection calmly acquires a replacement without adding a
new ceremony. After three positions settle, the deterministic **3 MEASUREMENTS
ACCEPTED** confirmation appears briefly before one transition to Processing.

## 9. Oracle result machine

The current Oracle phases are:

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

The sealed state contains no result content in the DOM or accessibility tree.

The current control verbs are:

- Reveal
- Keep or the canonical recommended action
- View supporting detail
- Collect
- Done

The reveal must feel causal and restrained. Chassis movement, optical warming, transmission, firmware reveal, roller registration, paper feed, and collection are distinct mechanisms with distinct timing.

No animation may author or upgrade evidence.

## 10. Evidence output

The Evidence Record is a physical artifact released by the Oracle, not a generic dashboard card.

The output must preserve:

- one paper coordinate system
- stable record identity
- one vertical feed path
- no reparenting during dispense
- no rotation, scale, or fade as a substitute for physical feed
- explicit collection
- the same record in detail, Home, and Previous Trials

Detailed evidence belongs in the record’s progressive disclosure rather than crammed onto the paper front.

## 11. Page controls

Page-owned actions and machine-owned controls must not compete.

Page controls should use semantic shared roles for:

- screen question
- section label
- supporting copy
- primary action
- secondary action
- option label
- error/status message

Primary actions use explicit intent labels such as:

- START A PRODUCT TRIAL
- REGISTER AND LOAD
- BEGIN BASELINE
- TAKE FOLLOW-UP SCAN
- CONTINUE TO RESULT

Avoid vague `NEXT` or `SUBMIT` when a concrete action is available.

Selection rows must retain native semantics, at least 44-pixel targets, visible focus, non-color selection indicators, and stable wrapping.

## 12. Motion laws

Motion must explain mechanism or continuity.

Allowed:

- controlled specimen load
- one registration scan
- state-selected chamber illumination
- acquisition lock and scan
- deliberate Oracle reveal
- evidence feed and collection

Forbidden:

- bounce or toy overshoot
- looping shimmer
- floating specimens
- particles and confetti
- decorative depth unrelated to state
- animation that masks loading uncertainty
- motion that creates durable or scientific state

One rigid assembly moves as one object. Children do not drift independently.

## 13. Smart-glass and optics

Blur, dimming, tint, reflection, haze, and clearing belong to the dedicated optical layer.

Specimen identity and firmware remain live and must not inherit accidental `filter`, `backdrop-filter`, opacity degradation, fractional scaling blur, or screenshot rasterization.

In revealed states, the result and identity resolve to full legibility. Reduced motion reaches the same optical truth immediately.

## 14. Language

Current primary product language includes:

- Start a new trial
- Register and load
- Baseline
- Trial in progress
- Follow-up ready
- Follow-up scan
- Result
- Recommendation
- Evidence Record
- Previous Trials

Technical codes may appear in engineering tools and full record detail. They do not lead the ordinary journey.

## 15. Accessibility

Every meaningful state requires a text equivalent.

Maintain:

- semantic buttons and radio groups
- contextual accessible names
- visible focus
- at least 44-pixel targets
- tap, Enter, Space, and pointer parity where relevant
- no drag-only interaction
- cancellation and lost-pointer recovery
- stage focus without stealing active form focus
- restrained live regions
- no color-only meaning
- reduced-motion semantic parity
- sealed-result privacy in both DOM and accessibility tree

Decorative hardware stays outside the accessibility tree.

## 16. Responsive behavior

Test at the committed mobile widths and dynamic Safari viewport states.

Requirements:

- no horizontal overflow
- one shared machine scale factor
- no independent compression of hardware parts
- registration controls remain reachable
- acquisition route bar, guide, instruction, and rail remain visible
- page controls do not fall behind Safari chrome
- long product names and evidence copy wrap without geometry drift
- native scrolling remains available outside intentional machine gesture surfaces

## 17. Source of truth

Current visual nodes and verification evidence are listed in `source-of-truth-manifest.md`.

When Figma and merged implementation differ, use the manifest and exact PR verification record to determine whether Figma is geometry authority, visual direction, or historical lineage. Do not revive a superseded component from an old node solely because it is visually polished.

## 18. Phase C additions

- #63 adds restrained burst progress without changing the camera’s physical grammar.
- #64 may add compact evidence-question controls using the shared page hierarchy.
- #65 adds an internal instrument, not a consumer visual redesign.

No Phase C PR may redesign the machine, specimen, Home, or Oracle unless a correctness issue makes the change unavoidable and explicitly reviewed.
