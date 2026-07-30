# Face Value specimen acquisition verification

**Implementation baseline:** PR #62 merge `e0173ee`  
**Automated fixture status:** Passed  
**Final physical-iPhone release status:** Pending explicit exact-head record

Verified against the canonical Figma nodes on July 29, 2026:

- Capture Sequence `542:99`
- Face Guide `536:24`
- Engineering Contract V2 `556:135`
- Capture Sequence page `534:2`

The checked-in images are synthetic fixture renders. They contain no face photographs or captured user data.

## WebKit evidence

| State | Evidence |
| --- | --- |
| Searching | [searching.png](./searching.png) |
| Aligning | [aligning.png](./aligning.png) |
| Locking | [locking.png](./locking.png) |
| Scanning | [scanning.png](./scanning.png) |
| Captured | [captured.png](./captured.png) |
| Permission denied | [permission-denied.png](./permission-denied.png) |
| Reduced motion | [reduced-motion.png](./reduced-motion.png) |

The Playwright geometry assertions cover `390 × 844`, `393 × 852`, `402 × 874`, and `430 × 932`.

During active capture:

- the chamber uses at least 92 percent of application width
- the canonical guide field, implied oval, action rail, context bar, and crop remain stable between Aligning, Locking, Scanning, and Captured
- a visual-viewport test contracts the Safari-visible height to 660 pixels and restores it
- the chassis retains full width
- short-viewport behavior scales the guide field instead of shrinking the complete chamber
- route bar and action rail remain visible
- neither page nor chamber introduces unintended scrolling

The four guide arcs remain mounted for the complete ritual. Locking draws persistent connector paths from those arcs rather than mounting a replacement ellipse. Scanning uses the shared amber optical plane, bloom, and leading edge. Captured holds the guide briefly and resolves it to low emphasis over the same frozen frame.

The normal scan uses the state machine’s single timing constant. Reduced motion replaces travel with a shorter illumination state without skipping Captured or processing continuity.

## Native adapter automated proof

The browser suite exercises `NativeBrowserCameraAdapter` behind a development-only mock camera stream.

That test proves in the simulated environment:

- one real visible `<video>` surface
- current-frame readiness
- Face Value-owned lock and scan timing
- same-bitmap freeze
- one track stop
- no vendor resolution alert
- cancellation and route teardown

The mock is not evidence of physical camera behavior, real-face framing, or provider accuracy.

Run the complete browser suite:

```sh
npm run test:e2e -- --project=mobile-webkit
```

Regenerate the privacy-safe visual set:

```sh
CAPTURE_FACE_VALUE_CAPTURE_EVIDENCE=true \
  npm run test:e2e -- --project=mobile-webkit \
  --grep "visual regression" --update-snapshots
```

## Physical evidence already observed

Physical iPhone observations during PR #62 exposed the vendor Camera Kit failures that caused the production native-camera correction, including resolution alerts, renderer/readiness assumptions, Safari viewport problems, and startup failure behavior.

Those observations justify the architecture correction. They do not substitute for a final exact-head acceptance pass of the merged production baseline and follow-up journey.

## Final physical-iPhone release checklist

On an exact deployed commit, record:

1. commit SHA and deployment ID or URL
2. iPhone model, iOS version, and Safari version
3. camera permission grant
4. denial and recovery after re-enabling permission
5. ordinary indoor light
6. low light for at least eight seconds
7. strong backlight
8. subject framing and guide breathing room
9. movement during Locking and Scanning
10. no invalid bitmap committed after lock loss
11. no width/height popup
12. no black false-live state
13. no false unavailable state
14. no repeated restart loop
15. same captured frame through processing continuity
16. Safari chrome expansion and contraction
17. Reduce Motion
18. route-exit camera activity shutdown
19. real startup failure and retry
20. existing-photo fallback with a non-sensitive test image
21. baseline provider completion
22. follow-up provider completion
23. face-free persistence and reload continuity

For #63, the final checklist must also prove three distinct accepted frame events and three genuine provider analyses for baseline and follow-up.

## Current outcome

Automated acquisition, responsive WebKit, reduced motion, privacy-safe visual evidence, and native-adapter contract tests pass for the PR #62 implementation.

The final exact-head physical-iPhone golden-path acceptance remains open and must be recorded before hackathon release. No physical acceptance claim should be inferred from the synthetic screenshots.