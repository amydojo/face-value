# Design contract

## Single physical grammar

Evidence Cassette V7 is the only production hardware language.

The phone behaves as a precision evidence instrument containing indexed skincare specimen cassettes. Every screen may show a different operating state of that instrument, but the physical laws remain stable.

The shared structural stack is:

1. Fixed graphite enclosure.
2. Shallow optical bay.
3. Fixed specimen dock.
4. Live specimen and identity layer.
5. Dedicated persistent warm smart-glass overlay.
6. Structural bezel.
7. One rigid cassette transform group.
8. Independent Evidence Record output slot.

The enclosure must not become a refrigerator, oven, filing unit, furniture drawer, deep room, or metallic card carousel.

## Shared cassette modes

Production uses one typed interaction contract:

`index`, `active`, `review-due`, `verdict`, and `classified`.

Mode changes content, status, accessible name, and destination. Handle placement, horizontal intent, resistance threshold, latch semantics, opening depth, pause, and closing confidence remain recognizable across every mode.

## Three-axis law

- Vertical page movement scrolls content.
- Horizontal movement activates or changes a cassette only from an intentional handle or indexed control.
- Depth changes physical attention only when a cassette is selected, released, presented, or classified.

No axis is reused for an unrelated action. Decorative surfaces do not intercept gestures. The explicit handle owns `touch-action: none`; the surrounding page remains scrollable.

## State-selected atmosphere

Cassette, observation, comparison, confidence, disturbance, disposition, privacy, processing, and reduced-motion states select visual variants. Blur, material luminance, the orange evidence signal, glass clarity, or depth never create or upgrade evidence state.

General hardware states remain:

`dormant`, `indexed`, `selected`, `sealed`, `active`, `disturbed`, `reviewDue`, `classified`, and `archived`.

The verdict interaction has its own explicit sequence:

`sealed → pressing → released → tilting → settled → clearing → presented → closing → sealed`

## Motion

Cassette browsing is finite and stops at both ends. A deliberate horizontal gesture is accepted only by the cassette handle. A below-threshold gesture returns deterministically without changing state.

The verdict reveal preserves handle press, latch release, cassette pop, mechanical pause, restrained micro tilt, settle, smart-glass clear, specimen presentation, identity reveal, and confident reseal.

The cassette moves as one rigid group. Its children never drift independently. Housing, optical bay, specimen dock, live identity, smart glass, and output slot remain fixed unless the state explicitly requires a material change.

Disturbance registers two cassette identities in one observation window. It does not depict one physical object intruding into another.

Disposition commits a semantic evidence classification. It does not move a miniature object vertically through shelving.

## Smart-glass optics

Blur, dimming, tint, reflection, and clearing belong only to the dedicated glass overlay. The specimen and primary label remain live HTML or SVG and must not inherit `filter`, `backdrop-filter`, opacity degradation, fractional scaling, or screenshot rasterization.

At rest, identity remains readable through restrained contrast muting. In the presented state, glass blur resolves to none and product identity is fully crisp. Reduced motion resolves to the same optical truth immediately.

## Material system

Use graphite instrument surfaces, warm optical glass, restrained enamel or metallic cassette surfaces, etched low-contrast labeling, one small orange evidence signal, mounted identity rails, and paper Evidence Records.

Avoid large silver gradients, glossy appliance styling, neon science-fiction lighting, glowing docks, heavy bevels, dramatic tunnels, large orange bars, and generic frosted cards.

## System chrome and safe area

The browser and operating system own time, signal, battery, and navigation chrome. Face Value renders no simulated status row.

The application shell owns `env(safe-area-inset-top)`. The shared header renders only the Face Value brand and accession or screen code, with no excessive desktop padding.

## Accessibility

Every meaningful state has a text equivalent. Orange, blur, motion, glass, and depth are supplemental only.

Controls remain semantic, keyboard operable, visible on focus, and at least 44 px. The cassette handle remains at least 60 × 44 px. Tap, Enter, and Space activate the same action. Escape closes an expanded cassette or returns through the existing state machine. State announcements occur at meaningful semantic boundaries rather than every animation frame.

Accessible names include the object and destination, such as “Open evidence cassette A1–03,” “Review verdict for Fermented Brightening Essence,” and “Open classified evidence record A1–03.”

Decorative hardware stays outside the accessibility tree.

## Reduced motion

Reduced motion removes translate Z, visible micro tilt, overshoot, and long travel. It preserves selection, release, presentation, classification, and sealing through short opacity and surface-state changes with correct identity and specimen order.

## Responsive behavior

Each complete hardware assembly uses one shared scale factor. Test at 320 × 568, 375 × 812, 390 × 844, 402 × 874, and 430 × 932.

Hardware parts must not compress independently. Product identity must not cover the specimen. The primary action, Why This Verdict, camera controls, and archive records must remain reachable. No route may create horizontal overflow.

See `production-journey-integration.md` for the complete production routing and verification contract.
