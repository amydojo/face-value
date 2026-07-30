# Face Value Capture Design QA

**Source visual truth**

- `/tmp/codex-remote-attachments/019fafbc-60f6-7b42-b5fa-3d84107929fc/2CAEFB8E-40BA-4274-962F-C45B1ACB5D13/1-Photo-1.jpg` — physical iPhone searching state
- `/tmp/codex-remote-attachments/019fafbc-60f6-7b42-b5fa-3d84107929fc/2CAEFB8E-40BA-4274-962F-C45B1ACB5D13/3-Photo-3.jpg` — physical iPhone live/low-light state
- `/tmp/codex-remote-attachments/019fafbc-60f6-7b42-b5fa-3d84107929fc/2CAEFB8E-40BA-4274-962F-C45B1ACB5D13/2-Photo-2.jpg` — physical iPhone captured state

**Rendered implementation**

- `docs/verification/face-value-specimen-acquisition/searching.png`
- `docs/verification/face-value-specimen-acquisition/aligning.png`
- `docs/verification/face-value-specimen-acquisition/locking.png`
- `docs/verification/face-value-specimen-acquisition/scanning.png`
- `docs/verification/face-value-specimen-acquisition/captured.png`
- `docs/verification/face-value-specimen-acquisition/permission-denied.png`
- `docs/verification/face-value-specimen-acquisition/reduced-motion.png`

**Capture normalization**

- Source attachments: 588 × 1280 pixels. The images include physical Safari chrome; the original CSS viewport and device pixel ratio are not encoded in the attachments.
- Implementation evidence: 1170 × 2532 pixels, captured from a 390 × 844 CSS-pixel Mobile WebKit viewport at device scale factor 3.
- Full-view comparison: `/tmp/face-value-pr62.HcW90n/design-comparison.png`, 1200 × 2875 pixels. Each source and implementation image was rendered into the same 562 × 844 comparison slot with `object-fit: contain`, preserving its aspect ratio. The comparison is local-only because it contains a real face and must not be committed.
- States compared side by side: searching, live alignment guidance, and captured. The physical live reference is a low-light state while the synthetic fixture exercises distance guidance, so that pair was used to compare composition and guide behavior rather than issue copy.
- Focused evidence: the same original-resolution comparison was inspected at the guide, instruction, rail, and captured-face regions. The locking, scanning, permission, and reduced-motion implementation captures were also inspected independently because no equivalent physical source frame was supplied.

**Findings**

- No actionable P0, P1, or P2 visual mismatches remain in the corrected fixture implementation.
- Typography: Geist/Geist Mono hierarchy, casing, line height, and restraint match the established Face Value capture language. One instruction remains dominant and the specimen/rail labels remain secondary.
- Spacing and layout: the active chamber now uses the full application width under the route bar. Context, instruction, guide, and rail remain simultaneously visible, and the short-height layout scales only the guide field instead of shrinking the chamber.
- Colors and tokens: neutral warm white remains the default signal; Face Value amber is limited to the active correction, lock transfer, and scan optic. No green, cyan, or generic SDK success treatment is present.
- Image quality and assets: the production camera surface and privacy-safe fixture share identical cover geometry and a deliberate `50% 42%` crop. The fixture is intentionally abstract and is not evidence for real-face crop quality.
- Copy and content: searching, issue guidance, locking, scanning, captured, permission, and fallback copy remain within the approved contract. No pre-capture skin-analysis claim appears.
- Interaction and state continuity: the same four arc paths stay mounted from searching through captured; persistent connectors and anchors change presentation without introducing a replacement ellipse. The captured guide resolves to low emphasis rather than obscuring the specimen.
- Accessibility: instruction changes retain the existing live-region behavior, reduced motion removes breathing and scan travel, and state meaning is not conveyed by amber alone.

**Comparison history**

1. Earlier P1 — active capture rendered as a narrow, inset 1:2 card.
   - Fix: removed the height-divided width formula and fixed aspect ratio; active capture now flexes to the full available application width.
   - Post-fix evidence: `searching.png` and `aligning.png` in the implementation evidence above.
2. Earlier P1 — searching arcs were replaced by an unrelated white ellipse during locking and captured.
   - Fix: retained one four-arc SVG path system and added persistent connector paths and anchor points whose stroke progress changes by phase.
   - Post-fix evidence: `locking.png`, `scanning.png`, and `captured.png`.
3. Earlier P1 — the scan was a weak narrow light strip with no Face Value signal continuity.
   - Fix: implemented one broad amber optical plane, atmospheric bloom, and restrained leading edge using the existing capture accent and amber bloom tokens.
   - Post-fix evidence: `scanning.png`.
4. Earlier P2 — the bright captured oval remained over the face after guidance was complete.
   - Fix: held the connected guide for 150 ms, then resolved it to low opacity while preserving the captured bitmap.
   - Post-fix evidence: `captured.png`.
5. Earlier P2 — Safari height contraction could shrink the entire chamber or force guide/rail overlap.
   - Fix: preserved full-width chamber geometry and introduced container-height guide scaling at 620 px and 520 px, with exact restoration after the visual viewport expands.
   - Post-fix evidence: responsive WebKit geometry assertions at 390 × 844, 393 × 852, 402 × 874, and 430 × 932, including a simulated 660 px visual viewport contraction.

**Open Questions**

- Real-face occupancy and the tuned `50% 42%` crop still require a human pass on the fresh preview in physical iPhone Safari. Synthetic evidence cannot honestly validate subject framing, skin-tone legibility, camera startup, or Safari chrome behavior on hardware.

**Implementation Checklist**

- [x] Full-width active acquisition chamber
- [x] Stable route bar, context, instruction, guide, and rail
- [x] One persistent guide path system
- [x] Amber correction, lock transfer, and optical scan
- [x] Captured guide resolution with bitmap continuity
- [x] Reduced-motion equivalent
- [x] Responsive Mobile WebKit geometry and visual viewport checks
- [x] Privacy-safe evidence only
- [ ] Physical iPhone acceptance on the fresh Vercel preview

**Follow-up Polish**

- None identified from the privacy-safe fixture comparison. Physical-device feedback should be treated as new evidence rather than inferred from synthetic screenshots.

final result: passed
