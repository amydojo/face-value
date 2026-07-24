# Evidence Cassette V7

## Production slice

The production component is shared by the direct `/verdict` route and the application’s existing Progress Mode stage. The direct route supplies the canonical A1–01 Barrier Water Serum fixture for deterministic design review. The full flow supplies the active specimen and job from application state.

## Component system

- `EvidenceVerdict` owns verdict hierarchy, Why This Verdict disclosure, and the primary product decision.
- `EvidenceCassette` owns hardware structure, pointer and keyboard interaction, accessible state, and material presentation.
- `evidenceCassetteMachine` is the only transition authority.
- `EvidenceCassette.module.css` owns fixed geometry, depth ordering, smart glass, and rigid body transforms.

The structural stack is: fixed housing, shallow optical bay, mounted identity rail, fixed specimen and dock, persistent smart glass, structural bezel, rigid cassette module, and independent output slot.

## State model

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

Normal motion uses an 80 ms handle press, 90 ms latch release plus 50 ms mechanical pause, 200 ms micro tilt, 90 ms settle plus 70 ms optical pause, 320 ms glass clear, and a 460 ms staged close. The identity sequence overlaps the final optical clear after the hardware has settled.

Reduced motion removes translate Z and rotate X while preserving press, released, clearing, presented, and closing meaning.

## Interaction model

Tap, keyboard activation, and a deliberate horizontal handle drag dispatch the same `ACTIVATE` event. Horizontal drag was selected for the first production slice because `touch-action: pan-y` preserves normal page scrolling while the pointer is on the 60 × 44 px handle target. Drag remains threshold based rather than analog.

The reducer rejects activation while mechanical or optical work is in progress, preventing double activation and overlapping close and open sequences. Every scheduled transition is owned by an effect cleanup.

## Production depth versus Figma

Figma’s presented state uses a restrained 2D rotation to communicate depth. Production keeps the approved silhouette and opening amount but replaces that approximation with one rigid `translate3d` plus `rotateX` transform group under 1040 px perspective. The housing, chamber, bottle, glass, identity rail, and output slot remain fixed.

The chamber uses a dominant rear panel and small ceiling, side, and floor reveals rather than triangular walls. The glass remains present at approximately 1 px blur and a faint warm perimeter haze when presented.

## Accessibility

- Semantic handle button with dynamic open and close names
- 60 × 44 px target at every supported width
- Native Enter and Space support
- Focus stays on the handle through motion
- Separate Edit control after presentation
- Polite announcements for sealed, released, presented, and evidence ready states
- Text equivalents for confidence, product identity, job, and verdict

## QA evidence

Playwright captures sealed, released, micro tilted, and presented states at 402 × 874, plus sealed and presented states at 375 × 812 and 430 × 932. Interaction coverage includes rapid taps, below threshold drag, completed drag, keyboard activation, reduced motion, resize during transition, route change during transition, horizontal overflow, and runtime console errors.
