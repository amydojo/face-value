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

| State                    | Evidence                                                   |
| ------------------------ | ---------------------------------------------------------- |
| Searching                | [searching.png](./searching.png)                           |
| Aligning                 | [aligning.png](./aligning.png)                             |
| Locking                  | [locking.png](./locking.png)                               |
| Scanning                 | [scanning.png](./scanning.png)                             |
| Captured                 | [captured.png](./captured.png)                             |
| Scan complete dwell      | [scan-complete-dwell.png](./scan-complete-dwell.png)       |
| Analysis · measurement 1 | [analysis-measurement-1.png](./analysis-measurement-1.png) |
| Analysis · measurement 2 | [analysis-measurement-2.png](./analysis-measurement-2.png) |
| Analysis · slow response | [analysis-slow-response.png](./analysis-slow-response.png) |
| Measurements confirmed   | [measurements-confirmed.png](./measurements-confirmed.png) |
| Permission denied        | [permission-denied.png](./permission-denied.png)           |
| Reduced motion           | [reduced-motion.png](./reduced-motion.png)                 |

The Playwright geometry assertions cover widths of 320, 375, 390, 402, and
430 CSS pixels, including `390 × 844` and `430 × 932`.

During active capture:

- the chamber uses at least 92 percent of application width
- the canonical guide field, implied oval, action rail, context bar, and crop remain stable between Aligning, Locking, Scanning, and Captured
- a visual-viewport test contracts the Safari-visible height to 660 pixels and restores it
- the chassis retains full width
- short-viewport behavior scales the guide field instead of shrinking the complete chamber
- route bar and action rail remain visible
- neither page nor chamber introduces unintended scrolling
- the primary analysis stack stays above the quality rail and separate from the
  Demo Lab banner
- the decorative analysis field remains clipped to the responsive guide

The four guide arcs remain mounted for the complete ritual. Locking draws persistent connector paths from those arcs rather than mounting a replacement ellipse. Scanning uses the shared amber optical plane, bloom, and leading edge. Captured holds the guide briefly and resolves it to low emphasis over the same frozen frame.

The normal scan uses the state machine’s single timing constant. Reduced motion replaces travel with a shorter illumination state without skipping Captured or processing continuity.

The focused PR #68 correction adds a minimum 1.8-second **Scan complete / You
can relax.** dwell while provider work continues, stable analysis copy,
truthful 1/2/3 progress with a 700-millisecond minimum visible position, a
six-second tertiary slow-response line, and an approximately 800-millisecond
confirmation presentation after durable commit. The sparse amber SVG field is
decorative and `aria-hidden`; it reads no pixels and does not claim to show
redness or facial geometry. Reduced motion keeps all copy and timing while
removing settle, pulse, and traveling point activity.

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

For #63 and the focused PR #68 correction, the final checklist must also prove
three distinct accepted frame events and three genuine provider analyses for
baseline and follow-up; readable dwell and progress behavior; restrained
activity-field presentation; and registered-specimen continuity through Oracle,
saved record, Home, history, and reload.

## Current outcome

PR #62's automated acquisition baseline remains established. The focused PR
#68 correction has automated responsive WebKit, reduced-motion, privacy-safe
visual, analysis-wait, and specimen-continuity coverage; its exact command
results and preview are recorded in the draft PR handoff.

The final exact-head physical-iPhone golden-path acceptance remains open and must be recorded before hackathon release. No physical acceptance claim should be inferred from the synthetic screenshots.
