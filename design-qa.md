# Face Value capture design QA

**Scope:** Current acquisition, Trial Truth, Evidence Record, and issue #65 internal calibration surfaces

**Implementation base:** `main` at merged PR #69
(`f95b051f6c562919c23da0d08728fff124d27d48`)

**Issue #63 privacy-safe fixture result:** Pass on the exact Vercel preview
recorded in the draft pull request

**Final physical-iPhone release result:** Pending explicit exact-head acceptance record

## Source visual truth

Local physical-iPhone source attachments were used during PR #62 correction for:

- searching state
- live low-light state
- captured state

Those attachments contain a real face and temporary local paths. They are intentionally not committed and are not durable repository references.

Current Figma nodes and checked-in evidence are indexed in `docs/source-of-truth-manifest.md`.

## Rendered implementation evidence

- `docs/verification/face-value-specimen-acquisition/searching.png`
- `docs/verification/face-value-specimen-acquisition/aligning.png`
- `docs/verification/face-value-specimen-acquisition/locking.png`
- `docs/verification/face-value-specimen-acquisition/scanning.png`
- `docs/verification/face-value-specimen-acquisition/captured.png`
- `docs/verification/face-value-specimen-acquisition/permission-denied.png`
- `docs/verification/face-value-specimen-acquisition/reduced-motion.png`

The committed implementation evidence was captured from a `390 × 844` CSS-pixel Mobile WebKit viewport at device scale factor 3. It is synthetic and contains no user data.

Issue #63 adds a second privacy-safe evidence set under
`docs/verification/redness-evidence-burst-63/`. It covers baseline and
follow-up progress, recoverable rejection, provider failure, and final immutable
Evidence Record continuity without storing a face frame.

## QA findings

No actionable P0, P1, or P2 mismatch remained in the privacy-safe fixture implementation after the PR #62 corrections.

### Typography and hierarchy

- Geist and Geist Mono roles remain consistent with Face Value capture language.
- One instruction remains dominant.
- Specimen, route, and action-rail labels remain secondary.

### Spacing and layout

- Active capture uses the full application width under the route bar.
- Context, instruction, guide, and rail remain visible together.
- Short-height behavior scales the guide field rather than shrinking the whole chamber.
- Dynamic visual-viewport tests preserve layout on Safari-like contraction and restoration.

### Color and material

- Warm white is the neutral guidance signal.
- Amber is limited to correction, lock transfer, and scan optics.
- No green, cyan, or generic vendor success treatment remains.

### Guide and scan continuity

- One four-arc guide system remains mounted from Searching through Captured.
- Locking adds persistent connectors instead of replacing the guide with another ellipse.
- Scanning uses the shared amber optical plane, bloom, and leading edge.
- Captured resolves the guide to low emphasis over the same frozen bitmap.

### Issue #63 burst feedback

- One three-position indicator remains subordinate to the existing guide.
- Accepted positions use restrained amber rather than generic green success.
- Recoverable capture rejection automatically acquires a replacement without a
  second camera screen or shutter.
- **3 MEASUREMENTS ACCEPTED** appears briefly before the one existing
  processing transition.
- Raw redness scores, calibration language, and deliberate repositioning
  instructions remain absent.

### Accessibility

- Instruction changes use the existing restrained live region.
- Reduced motion removes breathing and scan travel while preserving semantic states.
- State meaning does not depend on amber alone.

## Corrected issues

1. **Earlier P1:** capture rendered as a narrow inset poster.  
   **Correction:** full-width active chamber with short-viewport guide scaling.

2. **Earlier P1:** Searching arcs were replaced by a separate white ellipse.  
   **Correction:** one persistent four-arc path system with state-selected connectors.

3. **Earlier P1:** scan appeared as a weak narrow strip.  
   **Correction:** broad restrained amber optical plane using existing Face Value tokens.

4. **Earlier P2:** a bright guide remained over the captured face.  
   **Correction:** brief hold followed by low-emphasis resolution over the same frame.

5. **Earlier P2:** Safari height contraction could shrink the chamber or create overlap.  
   **Correction:** full-width chamber preservation and container-height guide scaling.

## What fixture QA does not prove

Synthetic comparison cannot honestly validate:

- physical camera startup
- permission behavior on the final deployment
- real-face occupancy and crop
- legibility across real skin tones and lighting
- Safari chrome on the target device
- real provider request completion
- camera activity shutdown on hardware

The physical observations used to find the original faults are evidence of those faults, not a final acceptance record for the corrected exact head.

## Current checklist

- [x] Full-width active acquisition chamber
- [x] Stable route bar, context, instruction, guide, and rail
- [x] One persistent guide path system
- [x] Restrained correction, lock, and optical scan treatment
- [x] Captured guide resolution with bitmap continuity
- [x] Reduced-motion equivalent
- [x] Mobile WebKit geometry and visual-viewport checks
- [x] Privacy-safe committed evidence only
- [x] Exact-head privacy-safe baseline and follow-up burst evidence
- [x] Exact-head recoverable rejection and provider-failure evidence
- [x] Exact-head immutable Evidence Record continuity evidence
- [ ] Final exact-head physical-iPhone baseline and follow-up acceptance record

## Final assessment

The acquisition foundation passes the existing PR #62 privacy-safe fixture QA.
Issue #63 passes its exact-preview Mobile WebKit visual, responsive, runtime,
and face-free continuity checks. This is desktop-browser evidence driven by
synthetic frames and provider-shaped responses; it is not physical-iPhone or
genuine-provider proof.

Hackathon release still requires a separately recorded exact-head physical-iPhone golden-path pass. The repository must not represent that release gate as complete until the checklist in `docs/verification/face-value-specimen-acquisition/README.md` is executed and documented.

---

# Trial Truth capture-check design QA

## Comparison target

- **Source visual truth:** `/tmp/codex-remote-attachments/019fbf79-acf9-7fd3-b17f-a2fb7f21d127/85AFFC86-9952-4048-8B2E-30D619E603BB/5-Photo-5.jpg`, the attached physical-iPhone Trial Truth machine reference, plus the authored `CAPTURE CHECK · OPTIONAL` requirements in PR #69.
- **Implementation evidence:** `/tmp/trial-truth-capture-check-qa/390-capture-check.png`, `/tmp/trial-truth-capture-check-qa/390-context-editor.png`, `/tmp/trial-truth-capture-check-qa/390-context-summary.png`, and the corresponding `320-*.png` captures.
- **Viewport and density:** source is `588 × 1280` JPEG with physical Safari chrome. Implementation captures are `1170 × 1992` at a `390 × 664` CSS-pixel Mobile WebKit viewport and `960 × 1560` at a `320 × 520` viewport, both at device scale factor 3. The focused editor captures were normalized to `390 × 664` and `320 × 520` before comparison.
- **States compared:** physical machine shell at Trial Truth Step 3; implemented capture-check choice, in-machine context editor, and saved context summary.

## Full-view comparison evidence

The source and implementation were opened in the same comparison input. The implementation preserves the warm laboratory page, one stationary Face Value machine, compact registered-product identity, firmware glass, lower deck, amber control, and continuous grounding shadow. The fourth checkpoint remains within the same machine and does not introduce the former standalone form page, a second card hierarchy, or document scrolling.

At both widths, the active question, two choices, compact summary, machine deck, Back action, and continuous left/right shadow bleed remain within the viewport. The `320px` authored wrapping remains readable without horizontal overflow.

## Focused comparison evidence

Focused, density-normalized editor captures were inspected because the firmware labels and 44px controls were too small to judge reliably in the full-view images. The four canonical context fields remain legible in a two-column internal scroller; the optional bounded note remains reachable in that scroller. The physical deck and amber control do not move between choice, editor, and summary states.

## Required fidelity surfaces

- **Fonts and typography:** existing Face Value sans/mono roles, weights, tracking, hierarchy, product-identity truncation, and authored question wrapping are preserved. No cramped headline stack remains at 320px or 390px.
- **Spacing and layout rhythm:** one firmware question occupies the display; answer controls and helper copy have balanced separation; the context editor scrolls internally while the document and machine stay fixed.
- **Colors and tokens:** the implementation reuses the existing glass, graphite, muted text, dark-amber selection, and Oracle-ready amber hardware treatment. Disabled hardware remains dormant.
- **Image quality and assets:** the active firmware flow intentionally contains no bottle render, matching the requested compact product identity. No replacement imagery or placeholder asset was introduced; the canonical bottle remains in the Oracle state.
- **Copy and content:** checkpoint, question, choice, field, summary, Edit, Save Context, Continue, and See Result language match the requested flow and existing CaptureContext contract.
- **Accessibility and interaction:** Mobile WebKit checks cover 44px targets, accessible names, focus transfer, disabled behavior, Back/Edit preservation, Reduce Motion, zero document scroll, visual-viewport scale 1, and no horizontal overflow.

## Comparison history

1. The first editor capture exposed a Reduce Motion specificity gap when returning Back from the context subview. The reduced-motion selector was strengthened so both forward and back firmware states have no animation or translation. The post-fix Mobile WebKit check passes.
2. Initial screenshots were taken during the 320ms firmware transition and were not valid comparison evidence. They were replaced with post-transition captures at the same viewports and states; the revised evidence shows the complete firmware content.

## Findings

No actionable P0, P1, or P2 visual mismatch remains in the browser-rendered implementation. The optional note is below the internally scrollable four-option grid by design so all option targets remain at least 44px without changing the machine height.

## Interaction and runtime evidence

Primary choice, Add Context, checkbox, bounded note, Back, Edit, Save Context, Step 3 Continue, final See Result, duplicate submission, comparison, and Evidence Record interactions were exercised in Mobile WebKit. Browser console errors, page errors, and unhandled rejections are covered by the focused Trial Truth suite.

## Remaining hardware gap

Browser rendering cannot prove physical Safari toolbar behavior, keyboard contraction while editing the optional note, or the exact shadow appearance on a real iPhone. Those remain manual exact-head checks.

final result: passed

---

# Preliminary redness calibration design QA

## Verification boundary

The `/calibration/redness` instrument is an internal engineering surface, not
a consumer redesign. Automated browser verification uses only deterministic,
explicitly synthetic, face-free observations. It makes no provider request and
does not stand in for genuine calibration collection: YouCam task creation is
currently blocked by HTTP 400 `CreditInsufficiency`.

## Responsive and accessible states

Focused Mobile WebKit coverage exercises 320px and 430px mobile layouts plus a
1280px desktop layout. It covers the provider-blocked state, synthetic standard,
no-treatment, degraded, and complete datasets; answer-first metrics; candidate
comparison; participant timelines; exclusions; raw session inspection;
breakdowns; canonical export/import; confirmation-based isolated clearing;
keyboard operation; visible focus; reduced motion; and document-level overflow.

Status meaning is always present in text. Tables use semantic captions and
headers, controls retain at least 44px targets on mobile, dialogs are named,
and raw rows expose explicit unavailable fields without inferring skin tone or
other missing evidence. The instrument remains reachable only from protected
Demo Lab utilities.

## Evidence Record extension

Full Evidence Record disclosure uses the existing visual system and now groups
the immutable saved snapshot into Observed change, Measurement support, Trial
truth, Evidence boundaries, and Supported next action. Text provenance names
provider measurement, deterministic Face Value evaluation, participant report,
or unavailable evidence. Legacy records keep an honest missing-detail state.
No new paper, Oracle machine, production route, or threshold-control surface is
introduced.

## Remaining physical checks

After provider credits return, the exact deployed head still needs a physical
iPhone pass for signed engineering authorization, one genuine three-frame
burst, repositioned recapture, matched no-treatment collection, Safari viewport
behavior, camera teardown, face-free persistence/reload, and ordinary-store
isolation. Those checks are pending and are not implied by synthetic fixture
QA.
