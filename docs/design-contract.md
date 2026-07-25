# Design contract

## Single physical grammar

Evidence Cassette V7 remains the only production hardware language. In the primary journey, the object is described to the person as a product trial, result, or saved result.

The phone behaves as a precision evidence instrument. Every screen may show a different operating state, but the physical laws remain stable.

The shared structural stack is:

1. fixed graphite enclosure
2. shallow optical bay
3. fixed specimen dock
4. live specimen and identity layer
5. dedicated persistent warm smart-glass overlay
6. structural bezel
7. one rigid transform group
8. independent saved-result output slot

The enclosure must not become a refrigerator, oven, filing unit, furniture drawer, deep room, fake operating system, or metallic card carousel.

## Human Butter hierarchy

Every default screen contains:

1. one human headline
2. one meaningful product-trial object
3. one useful piece of context
4. one filled primary action
5. at most one quiet text alternative

Technical details, destructive controls, note editing, another-product explanation, and alternate next steps use progressive disclosure. Large outlined rectangles are reserved for editable input, active selection, or focused controls. Read-only information is not bordered merely to look official.

## Shared internal modes

Production uses one typed internal interaction contract:

`index`, `active`, `review-due`, `verdict`, and `classified`.

Mode changes content, status, accessible name, and destination. Handle placement, horizontal intent, resistance threshold, latch semantics, opening depth, pause, and closing confidence remain recognizable across every mode.

## Universal handle meaning

A visible handle always means:

> Show me what this trial currently contains.

Required behavior:

- Your trials: view selected trial
- trial selection: inspect selected trial
- trial in progress: open or close trial summary
- ready to compare: begin result review through reducer state
- result: perform the V7 reveal
- saved result: open the preserved result

A handle-shaped affordance is not rendered when no meaningful action exists. Do not substitute whole-card click targets.

## Three-axis law

- Vertical page movement scrolls content.
- Horizontal movement activates a trial only from an intentional handle or changes selection from an indexed control.
- Depth changes physical attention only when a trial is selected, released, presented, or classified.

No axis is reused for an unrelated action. Decorative surfaces do not intercept gestures. The explicit handle owns `touch-action: none`; the surrounding page remains scrollable.

## State-selected atmosphere

Observation, comparison, confidence, product overlap, placement, privacy, processing, and reduced-motion states select visual variants. Blur, material luminance, the orange evidence signal, glass clarity, or depth never create or upgrade evidence state.

Internal hardware states remain:

`dormant`, `indexed`, `selected`, `sealed`, `active`, `disturbed`, `reviewDue`, `classified`, and `archived`.

The V7 result sequence remains:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

## Motion

Trial browsing is finite and stops at both ends. A deliberate horizontal gesture is accepted only by the handle. A below-threshold gesture returns deterministically without changing state.

The result reveal preserves handle press, latch release, pop toward the user, mechanical pause, restrained micro-tilt, settle, smart-glass clear, product presentation, identity reveal, and confident reseal.

The transform group moves as one rigid object. Its children never drift independently. Housing, optical bay, specimen dock, live identity, smart glass, and output slot remain fixed unless the state explicitly requires a material change.

Another-product state shows two identities in one trial. It does not depict one physical object intruding into another.

Saving commits a semantic next step. It does not move a miniature object through shelving or add celebration.

Do not add bounce, rubber motion, springy toy physics, particles, glow effects, new gradients, extra overlays, or fake sound effects.

## Smart-glass optics

Blur, dimming, tint, reflection, and clearing belong only to the dedicated glass overlay. The product and primary label remain live HTML or SVG and must not inherit `filter`, `backdrop-filter`, opacity degradation, fractional scaling, or screenshot rasterization.

At rest, identity remains readable through restrained contrast muting. In the presented state, glass blur resolves to none and product identity is fully crisp. Reduced motion resolves to the same optical truth immediately.

## Material system

Use graphite instrument surfaces, warm optical glass, restrained enamel or metallic moving surfaces, etched low-contrast labeling, one small orange evidence signal, mounted identity rails, and paper-like saved-result output.

Avoid large silver gradients, glossy appliance styling, neon science-fiction lighting, glowing docks, heavy bevels, dramatic tunnels, large orange bars, and generic frosted cards.

## Language in the visual system

Primary screen labels use Your trials, Trial in progress, Note, Follow-up scan, Result, Next step, Saved result, and Past results.

Technical codes and exact evidence terminology may appear in a detailed saved result, architecture documentation, or development tooling. They do not lead the default journey.

## System chrome and safe area

The browser and operating system own time, signal, battery, and navigation chrome. Face Value renders no simulated status row.

The application shell owns `env(safe-area-inset-top)`. The shared header renders only the Face Value brand and screen code, with no excessive desktop padding.

## Accessibility

Every meaningful state has a text equivalent. Orange, blur, motion, glass, and depth are supplemental only.

Controls remain semantic, keyboard operable, visible on focus, and at least 44 px. The handle remains at least 60 × 44 px. Tap, Enter, and Space activate the same action. Cancellation and lost pointer capture recover. Escape closes expanded content or returns through the reducer. State announcements occur at meaningful semantic boundaries rather than every animation frame.

Accessible names include the object and destination, such as “View trial for Fermented Brightening Essence,” “Reveal result for Barrier Water Serum,” and “Open saved result A1–01.” Decorative hardware stays outside the accessibility tree.

The focused note editor receives focus when opened and returns focus to Add note or Edit note when saved or cancelled. See why and Choose a different next step expose `aria-expanded` and `aria-controls` behavior.

## Reduced motion

Reduced motion removes translate Z, visible micro-tilt, overshoot, long travel, and ceremonial delay. It preserves release, presentation, classification, sealing, saved-result creation, and automatic opening with correct identity and content order.

## Responsive behavior

Each complete hardware assembly uses one shared scale factor. Test at 320 × 568, 375 × 812, 390 × 844, 402 × 874, and 430 × 932.

Hardware parts must not compress independently. Product identity must not cover the product. The primary action, See why, camera controls, note editor, next-step override, saved results, and Past results must remain reachable. No route may create horizontal overflow.

See `production-journey-integration.md` for the complete production routing, reducer, gesture, save, and verification contract.
