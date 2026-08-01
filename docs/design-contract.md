# Face Value design contract

**Status:** Current visual and interaction authority  
**Effective date:** July 31, 2026  
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

`IdentityLockSpecimen` is the current canonical production specimen and the
only renderer for a loaded product, including the Oracle result sequence.

It preserves one invariant root and stable geometry across loading, locking, ready, pending, follow-up-ready, and result states. Persisted product identity is not mutated to fit the label; deterministic presentation formatting may shorten repeated brand text or extract compact strength only for the visible thermal label.

For an active result, its complete identity comes from the reducer-owned
registered product: product ID, accession, brand, product name, strength,
volume, and assigned job. For a saved result, it comes from that immutable
record's product snapshot. Partial verdict copy and generic demo identity are
not alternate identity sources.

The specimen must remain:

- live HTML/CSS or SVG
- crisp at final scale
- independent from glass blur
- accessible through the surrounding machine copy
- free from baked screenshot text
- seated at the same chamber position with its grounded contact shadow
- visibly locked with its thermal label, evidence strip, and status marker

No second product silhouette may appear for the same registered product. The
specimen may not unload, float, become anonymous, or lose label content during
sealed, opening, transmitting, revealed, committing, dispensing, collected,
Home, Previous Trials, Evidence Record, or reload presentation.

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
→ Scan complete
→ Analyzing measurement 1
→ Analyzing measurement 2
→ Analyzing measurement 3
→ Measurements confirmed
→ existing comparison processing
```

The current visual contract includes:

- full-width active acquisition chamber
- one persistent four-arc guide system
- restrained connectors and anchors during lock
- one dominant instruction
- route and specimen context that remain secondary
- a broad amber optical scan plane
- same-bitmap freeze into a soft dark veil and restrained settle
- calm recovery for permission, startup, lighting, movement, and provider failure

The authored guide is positioning direction, not proof of automated face geometry. Copy and visuals must not imply landmark tracking, skin diagnosis, or biometric identity.

During the current burst, the user still experiences one continuous scan. After
the third frame, **SCAN COMPLETE / You can relax.** explicitly separates the
live camera from the preserved still for at least 1.8 seconds. Provider work may
continue in the background; the dwell does not defer requests, reducer truth,
or durable evidence. A calm 200–250 millisecond crossfade then enters the latest
truthful presentation state without replaying completed work.

Ordinary analysis keeps **Analyzing your scan / Checking three measurements for
consistency.** stable. The primary status stack directly beneath that copy owns
the restrained three-position indicator and **MEASUREMENT 1/2/3 OF 3** label.
Solid amber means completed, an amber ring with a slow 1.6–2 second breath means
active, and a faint hollow neutral ring means waiting. A presented position may
trail a genuine completion for at least 700 milliseconds of legibility, but it
must never lead it, move backward, or render zero.

Approximately 18–24 authored amber SVG points may move slowly inside the
existing capture-guide geometry while analysis is genuinely active. This
decorative, `aria-hidden` field is only an instrument-activity cue. Its
coordinates are not image-derived and do not represent redness, landmarks,
segmentation, depth, or measured skin regions; they are neither persisted nor
passed to a provider or evaluator. The field remains behind copy and the dark
captured-image veil and stops when analysis completes.

The interface shows no raw redness scores, calibration terminology, deliberate
repositioning prompt, extra shutter controls, or synthetic scientific geometry.

Recoverable capture rejection calmly acquires a replacement without adding a
new ceremony. Six seconds without a new genuine accepted completion adds the
tertiary line **Finishing this measurement…** without replacing stable analysis
copy. The timer resets only when a genuine analysis is accepted. The bounded
same-frame attempt two uses **Rechecking this measurement…** only while that
request is active and without exposing implementation language.
**MEASUREMENTS CONFIRMED / Preparing your comparison.** appears only after all
three analyses and remains for approximately 800 milliseconds before the
existing processing presentation. No spinner, percentage, countdown, progress
bar, or face-crossing scan line is allowed.

Reduced motion preserves every truthful copy, the 1.8-second readable dwell,
and every indicator-state change. It removes the captured-still settle,
active-indicator pulse, and traveling point activity; the point field is static
at low opacity or omitted when a static field would be confusing.

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
The already-known registered specimen identity is not result content and stays
visible, labeled, locked, and physically seated without weakening reveal
authorization.

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
