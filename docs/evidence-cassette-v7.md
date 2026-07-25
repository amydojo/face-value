# Evidence Cassette V7 production grammar

Evidence Cassette V7 is the single production hardware language for Face Value and the persistent product object across index, observation, review, verdict, classification, and record access.

The phone behaves as a personal precision evidence instrument containing indexed skincare specimen cassettes. Production screens must not introduce appliance, furniture, room, or card-carousel metaphors.

## Shared physical truth

Every hardware assembly preserves the same structural order:

1. Fixed graphite enclosure.
2. Shallow optical bay.
3. Fixed specimen dock.
4. Live specimen and identity layer.
5. Dedicated warm smart-glass overlay.
6. Structural bezel.
7. One rigid cassette transform group.
8. Independent evidence output slot.

`EvidenceInstrument`, `EvidenceCassetteSelector`, `CassetteHandle`, and `EvidenceCassette` form one composable family. The verdict cassette retains its explicit mechanical reducer; other screens reuse the shared handle and mode contract rather than copying the ceremonial sequence.

## Production modes

The typed interaction modes are:

`index`, `active`, `review-due`, `verdict`, and `classified`.

- `index`: the handle opens the selected specimen.
- `active`: the handle opens or closes the current observation summary.
- `review-due`: the handle begins or restores comparison and verdict review from real state.
- `verdict`: the handle performs the V7 reveal and reseal sequence.
- `classified`: the handle opens the committed Evidence Record.

Mode determines content and destination. Handle position, horizontal intent, latch semantics, resistance, opening depth, pause, and closing confidence stay consistent.

## Verdict sequence

The ceremonial sequence remains:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

Normal motion uses an 80 ms press, 90 ms release, 50 ms pause, 200 ms micro tilt, 90 ms settle, 320 ms smart-glass clear, 190 ms specimen and identity resolve, and 460 ms close.

## Interaction grammar

- Tap, Enter, and Space activate the same semantic action.
- Horizontal drag is accepted only on the explicit cassette handle.
- Five pixels establishes drag intent; 28 horizontal-dominant pixels activates.
- The handle owns `touch-action: none`; surrounding content retains vertical page scrolling.
- Pointer capture is released on completion, cancellation, and lost capture.
- Escape closes an expanded cassette before any parent back navigation.
- Rapid repeated activation is rejected while ceremonial hardware is busy.
- Every scheduled transition owns cleanup.

## Smart-glass and identity

Product identity is live HTML text beneath a dedicated glass overlay. The specimen subtree never receives blur or opacity degradation intended for glass.

At rest, a restrained one-pixel glass blur may mute contrast without erasing FACE VALUE, product name, volume, accession, or assigned job. During presentation, both standard and WebKit backdrop filters resolve to none, while identity resolves to full opacity with no filter, no fractional transform, and no persistent `will-change`.

Reduced motion reaches the same crisp optical result without translate Z or micro tilt.

## Accessibility

- Semantic buttons and native keyboard activation.
- Minimum 44 px controls and a minimum 60 × 44 px cassette handle target.
- Contextual names identify the cassette and action.
- `aria-expanded` describes active and verdict disclosures.
- Text equivalents cover cassette identity, observation status, interference, confidence, and disposition.
- Polite announcements occur at meaningful semantic boundaries only.
- Decorative hardware remains outside the accessibility tree.

## Responsive contract

The complete assembly uses one shared width variable and scales as one object. Required verification widths are 320, 375, 390, 402, and 430 px. Hardware parts must not compress independently, identity must not cover the specimen, and no route may create horizontal overflow.

## Production routing policy

The V7 verdict is reached only through the real reducer journey. The public `/verdict` fixture route is removed. Development scenarios may select deterministic analysis fixtures, but no production-like hardcoded specimen or analysis object is mounted as a normal route.

See `production-journey-integration.md` for disposition mapping, restoration, record generation, safe-area, and WebKit verification requirements.

## Figma source

- V7 component family: node `368:3295`
- Sealed verdict frame: node `342:2752`
- Presented verdict frame: node `343:2578`

Figma uses restrained 2D approximation. Production uses CSS perspective, `translate3d`, and `rotateX` only where depth communicates a real physical state.
