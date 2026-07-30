# Face Value Specimen Acquisition — verification

Verified against the canonical Figma nodes on 2026-07-29:

- Capture Sequence `542:99`
- Face Guide `536:24`
- Engineering Contract V2 `556:135`
- Capture Sequence page `534:2`

The checked-in images are synthetic fixture renders; they contain no face
photographs or captured user data.

## WebKit evidence

| State             | Evidence                                         |
| ----------------- | ------------------------------------------------ |
| Searching         | [searching.png](./searching.png)                 |
| Aligning          | [aligning.png](./aligning.png)                   |
| Locking           | [locking.png](./locking.png)                     |
| Scanning          | [scanning.png](./scanning.png)                   |
| Captured          | [captured.png](./captured.png)                   |
| Permission denied | [permission-denied.png](./permission-denied.png) |
| Reduced motion    | [reduced-motion.png](./reduced-motion.png)       |

The Playwright geometry assertions cover `390 × 844`, `393 × 852`,
`402 × 874`, and `430 × 932`. During active capture the acquisition chamber
uses at least 92% of the application width rather than preserving a fixed 1:2
poster. The canonical `330 × 450` guide field, `312 × 432` implied oval,
`358 × 48` rail, context bar, and camera crop remain stable between Aligning,
Locking, Scanning, and Captured. A separate Visual Viewport test contracts the
Safari-visible height to `660px` and restores it. The chassis retains full
width, the guide smoothly uses its short-viewport geometry before returning to
canonical size, the route bar and rail remain visible, and neither the page nor
the chamber scrolls.

The four authored guide arcs remain mounted for the entire ritual. Locking
draws four persistent connector paths from those arcs; no replacement ellipse
is mounted. Scanning uses the same signal-amber core, bloom, bright leading
edge, and restrained wash as the product specimen scanner. Captured holds the
guide for 150 ms, then resolves it to low opacity over the same frozen frame.
The normal scan is driven by the state machine's single 900 ms timing constant;
reduced motion replaces travel with the existing 300 ms illumination state.

The browser suite also exercises the production `NativeBrowserCameraAdapter`
behind a development-only mock camera stream. That test proves a real visible
`<video>` surface, first-frame readiness, Face Value-owned scan/capture timing,
same-bitmap freeze, one track stop, and no alert. The mock is not evidence of
physical camera behavior.

Run the complete browser suite:

```sh
npm run test:e2e -- --project=mobile-webkit
```

Regenerate this synthetic evidence set:

```sh
CAPTURE_FACE_VALUE_CAPTURE_EVIDENCE=true \
  npm run test:e2e -- --project=mobile-webkit \
  --grep "visual regression" --update-snapshots
```

## Physical iPhone checklist

Physical hardware was not available in the Codex execution environment. On an
iPhone, open the preview in portrait Safari and verify:

1. Grant camera access, then repeat after denying and re-enabling it in Safari
   settings.
2. Exercise ordinary indoor light, low light for at least eight seconds, and
   strong backlight.
3. Confirm the authored guide gives enough breathing room around forehead,
   cheeks, chin, and side silhouette. Native production capture does not claim
   automated distance, pose, or face-alignment detection.
4. Move the phone during Locking and Scanning; confirm sustained movement
   cancels calmly and an invalid bitmap is not committed.
5. Confirm no width/height popup, black live state, false unavailable state, or
   repeated restart loop appears.
6. Complete capture and confirm the same frozen frame remains visible through
   “Baseline secured / Processing specimen.”
7. Expand and collapse Safari chrome; confirm no horizontal overflow, clipped
   rail, or viewport jump.
8. Enable Reduce Motion; confirm the scan uses a short illumination with no
   traveling band.
9. Leave the route during live preview and confirm the camera activity
   indicator turns off.
10. Retry after a real startup failure, then complete the existing-photo
    fallback with a synthetic/non-sensitive test image.
