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
`402 × 874`, and `430 × 932`. They verify one stable 390 × 780 chassis, a
330 × 450 guide field at `(30, 132)`, a 312 × 432 oval, a 358 × 48 quality
rail, and an unchanged crop and guide across all five phases.

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
3. Move too close, too far, and partially outside each side of the guide.
4. Turn and tilt the head, then move once during Locking and once during
   Scanning.
5. Confirm the guide never moves, the invalid lock/scan cancels calmly, and an
   invalid bitmap is not committed.
6. Complete capture and confirm the same frozen frame remains visible through
   “Baseline secured / Processing specimen.”
7. Expand and collapse Safari chrome; confirm no horizontal overflow, clipped
   rail, or viewport jump.
8. Enable Reduce Motion; confirm the scan uses a short illumination with no
   traveling band.
9. Leave the route during live preview and confirm the camera activity
   indicator turns off.
10. Complete the existing-photo fallback with a synthetic/non-sensitive test
    image.
