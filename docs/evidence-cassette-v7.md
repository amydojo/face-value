# Evidence Cassette V7 production grammar

Evidence Cassette V7 is the single production hardware language for Face Value.

The phone behaves as a personal precision evidence instrument containing indexed skincare specimen cassettes. Production screens must not introduce appliance, furniture, room, or card-carousel metaphors.

## Shared physical truth

Every hardware assembly preserves the same structural order:

1. Fixed graphite enclosure.
2. Shallow optical bay.
3. Fixed specimen dock.
4. Persistent warm smart glass.
5. Mounted identity rail.
6. One rigid cassette transform group.
7. Independent evidence output slot.

`EvidenceInstrument` and `EvidenceCassetteSelector` provide the restrained app-wide family. `EvidenceCassette` remains the explicit ceremonial verdict interaction and retains its reducer.

## Semantic states

General application states are:

`dormant`, `indexed`, `selected`, `sealed`, `active`, `disturbed`, `reviewDue`, `classified`, and `archived`.

These states are presentation semantics, not a replacement for the domain model. Internal state and event names inherited from the original MVP may remain when changing them would add migration risk, but they must never reach visible copy, accessibility labels, analytics attributes, tests, or canonical documentation.

The verdict sequence remains:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

Normal motion uses an 80 ms press, 90 ms release, 50 ms pause, 200 ms micro tilt, 90 ms settle, 320 ms smart-glass clear, 190 ms specimen and identity resolve, and 460 ms close.

## Interaction grammar

- Tap selects, confirms, presents, seals, classifies, or advances.
- Horizontal drag is accepted only on an intentional cassette target.
- Vertical page scrolling remains available through `touch-action: pan-y`.
- Verdict handle tap, deliberate drag, Enter, and Space dispatch the same reducer event.
- General browsing uses its own finite selector state and does not reuse the verdict reducer.
- Rapid repeated activation is rejected while hardware is busy.
- Every scheduled transition owns cleanup.

## Accessibility

- Semantic buttons and native keyboard activation.
- Minimum 44 px controls and a minimum 60 × 44 px verdict handle target.
- Text equivalents for cassette identity, observation status, interference, confidence, and disposition.
- Polite announcements at meaningful semantic states only.
- Decorative hardware remains outside the accessibility tree.
- Reduced motion removes 3D depth and overshoot while preserving selection, release, presentation, classification, and sealing meaning.

## Responsive contract

The complete assembly uses one shared width variable and scales as one object. Required verification widths are 320, 375, 390, 402, and 430 px. Hardware parts must not compress independently, identity must not cover the specimen, and no route may create horizontal overflow.

## Figma source

- V7 component family: node `368:3295`
- Sealed verdict frame: node `342:2752`
- Presented verdict frame: node `343:2578`

Figma uses restrained 2D approximation. Production uses CSS perspective, `translate3d`, and `rotateX` only where depth communicates a real physical state.
