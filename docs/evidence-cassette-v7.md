# Evidence Cassette V7 production grammar

Evidence Cassette V7 is the single internal hardware language for Face Value and the persistent product object across trial selection, trial progress, result review, classification, and saved-result access.

The primary journey calls the object a product trial, result, or saved result. The internal component family may retain cassette terminology for engineering precision.

The phone behaves as a personal precision evidence instrument. Production screens must not introduce appliance, furniture, room, fake-operating-system, or card-carousel metaphors.

## Shared physical truth

Every hardware assembly preserves the same structural order:

1. fixed graphite enclosure
2. shallow optical bay
3. fixed specimen dock
4. live product and identity layer
5. dedicated warm smart-glass overlay
6. structural bezel
7. one rigid transform group
8. independent saved-result output slot

`EvidenceInstrument`, `EvidenceCassetteSelector`, `CassetteHandle`, and `EvidenceCassette` form one composable family. The result object retains its explicit mechanical reducer; other screens reuse the shared handle and mode contract rather than copying the ceremonial sequence.

## Production modes

The typed internal interaction modes are:

`index`, `active`, `review-due`, `verdict`, and `classified`.

- `index`: the handle views the selected trial.
- `active`: the handle opens or closes the current trial summary.
- `review-due`: the handle begins or restores result review through real reducer state.
- `verdict`: the handle performs the V7 result reveal and reseal sequence.
- `classified`: the handle opens the preserved saved result.

Mode determines content and destination. Handle position, horizontal intent, latch semantics, resistance, opening depth, pause, and closing confidence stay consistent.

## Universal handle contract

A visible handle always means:

> Show me what this trial currently contains.

A handle-shaped affordance is omitted when no meaningful destination exists. The whole object does not become a substitute click target.

Contextual accessible names use human language, including:

- View trial for Fermented Brightening Essence
- Open trial summary for Barrier Water Serum
- Reveal result for Hydrating Drops
- Open saved result A1–01

## Result sequence

The ceremonial sequence remains:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

Normal motion uses an 80 ms press, restrained release and pause, a 200 ms micro-tilt, settle, smart-glass clear, product and identity resolve, and a 460 ms confident close.

The causal order remains:

1. latch release
2. pop toward the user
3. mechanical pause
4. restrained micro-tilt
5. smart-glass clearing
6. product presentation
7. identity reveal
8. confident reseal

Do not add bounce, rubber motion, springy toy physics, celebration, particles, glow, new gradients, extra explanatory overlays, or fake sound effects.

## Interaction grammar

- Tap, Enter, and Space activate the same semantic action.
- Horizontal drag is accepted only on the explicit handle.
- Five pixels establishes drag intent; 28 horizontal-dominant pixels activates.
- The handle owns `touch-action: none`; surrounding content retains vertical page scrolling.
- Pointer capture is released on completion and recovered on cancellation or lost capture.
- Escape closes expanded content before parent back navigation.
- Rapid repeated activation is rejected while ceremonial hardware is busy.
- Every scheduled transition owns cleanup.

## Smart glass and identity

Product identity is live HTML text beneath a dedicated glass overlay. The product subtree never receives blur or opacity degradation intended for glass.

At rest, a restrained one-pixel glass blur may mute contrast without erasing FACE VALUE, product name, volume, accession, or assigned job. During presentation, standard and WebKit backdrop filters resolve to none, while identity resolves to full opacity with no filter, fractional transform, or persistent `will-change`.

Reduced motion reaches the same crisp optical result without translate Z, micro-tilt, or ceremonial delay.

## Save and reseal handoff

The V7 result reveal does not create the saved result. The main reducer owns the decision and durable boundary.

After the person accepts the recommended result action, the next-step screen shows the mapped placement. One `SAVE_RESULT` activation commits the placement and creates one durable result. The classified trial object performs the confident reseal, then `OPEN_SAVED_RESULT` opens the same record automatically.

The hardware animation never advances classification or record state by itself.

## Accessibility

- semantic button for every visible handle
- minimum 44 px controls and a minimum 60 × 44 px handle target
- contextual names identify the trial and destination
- `aria-expanded` describes trial-summary and result disclosures
- text equivalents cover identity, result, another-product context, confidence, and next step
- polite announcements occur at meaningful semantic boundaries only
- decorative hardware remains outside the accessibility tree
- cancellation, lost pointer capture, Escape, and reduced motion recover to valid semantic state

## Responsive contract

The complete assembly uses one shared width variable and scales as one object. Required verification widths are 320, 375, 390, 402, and 430 px. Hardware parts must not compress independently, identity must not cover the product, and no route may create horizontal overflow.

## Production routing policy

The V7 result is reached only through the real reducer journey. The public fixture route remains removed. Development scenarios may select deterministic analysis fixtures, but no production-like hardcoded product or result object is mounted as a normal route.

See `production-journey-integration.md` for result mapping, restoration, automatic comparison, exactly-once saving, safe-area, accessibility, and WebKit verification requirements.

## Figma source

- V7 component family: node `368:3295`
- Sealed result frame: node `342:2752`
- Presented result frame: node `343:2578`

Figma uses restrained 2D approximation. Production uses CSS perspective, `translate3d`, and `rotateX` only where depth communicates a real physical state.
