# Local optical comparability (experiment 01)

**Status:** technical feasibility prototype. Not connected to the redness evaluator, verdicts,
the Oracle, the Evidence Record, persistence or YouCam. Metrics `fv-local-optics-metrics-0.1`;
tolerances `fv-local-optics-tolerances-0.1-unvalidated`.

**Question:** can Face Value measure, on the person's own iPhone and without a provider, whether
two face captures were taken under comparable conditions?

## Where it lives

- Route: `/experiments/local-optics`. It is included only in development builds or builds with
  `VITE_LOCAL_OPTICS_EXPERIMENT=true`, and it loads as a separate chunk.
- Code: `src/features/local-optics/`
  - `opticsMetrics.ts`: pure, versioned measurements and the comparison
  - `landmarkSource.ts`: the MediaPipe Face Landmarker loader
  - `opticsSession.ts`: camera, frame sampling and cleanup
  - `LocalOptics.tsx`: the diagnostic view
- Tests: `src/test/local-optics-metrics.test.ts`, `src/test/local-optics-session.test.ts` and
  `e2e/local-optics.spec.ts` (Chromium only).

## Privacy

- **Frames:** each capture draws 12 frames into an in-memory canvas, downscaled to at most
  360 px on the long side. Only numbers leave the capture function. The last frame is kept in
  memory for the diagnostic thumbnail and is cleared on reset, on unmount and on `pagehide`.
- **What is never done:** no upload, no storage, no data URLs or blobs, and no analytics.
- **Model download:** loading landmarks downloads model code and weights. By default these come
  from pinned third-party URLs (`@mediapipe/tasks-vision@0.10.14` on jsDelivr, and the model on
  Google storage). Set `VITE_LOCAL_OPTICS_ASSET_BASE` to a same-origin folder to self-host them.
  No camera frame is sent either way.

## Capability matrix

| Property | Status | How |
|---|---|---|
| Face presence and count | Measured | The landmark model runs on every frame with `numFaces: 2`, so a second face is detected and rejected rather than ignored. No model means unknown, not zero. |
| Head roll | Measured | Angle of the outer-eye line (landmarks 33 and 263) in pixels. |
| Head yaw and pitch | Model estimate | Euler angles from the model's facial transformation matrix. The sign convention has not been verified on a device. Only between-capture differences are compared. |
| Apparent face size | Measured | Outer-eye distance as a share of frame width, plus face-box height. |
| Crop position and margins | Measured | Landmark bounding box and the smallest edge margin. Any landmark outside the frame rejects the capture. |
| Motion during capture | Measured | RMS landmark movement per frame (interocular units), plus whole-frame pixel change. |
| Face brightness, spread, clipping | Measured (relative) | Luma of camera-processed sRGB pixels inside the face box. Auto exposure is active, so this is not illuminance. |
| Side shading | Measured (proxy) | Image-left versus image-right face brightness. It is not a light-direction estimate. |
| Scene colour outside the face | Estimate | Mean rg-chromaticity outside an expanded face box (neck and clothing below are excluded). It moves with background content and auto white balance. It is shown without a tolerance verdict. |
| Colour cast | Unavailable | Needs a neutral reference target in frame. Skin pixels are never used for colour. |
| Illuminance, colour temperature | Unavailable | The browser gives no photometric access. |
| Exposure, white balance, ISO | Reported only if exposed | `MediaStreamTrack.getSettings()` values are listed per capture, with device identifiers removed. |

## Capture gates and comparison

**A capture is rejected for any of these:**

- `landmark_model_unavailable`
- `no_face`
- `multiple_faces`
- `unstable_face_count`
- `face_out_of_frame`
- `motion`, when RMS movement exceeds 0.02 interocular units per frame
- `clipped_highlights`, when more than 2 % of face pixels are clipped
- `too_few_frames`

**Two captures compare as:**

- `not_comparable` when either capture was rejected or any checked property is outside its
  experimental tolerance;
- `insufficient_evidence` when a required property was not measured on both captures;
- otherwise `within_experimental_tolerances`, which covers the measured properties only.

Colour cast is always listed as not assessed. A property measured on only one side is never
within tolerance, and an estimate never receives a tolerance verdict.

**Experimental tolerances** (exploratory, unvalidated, and not derived from YouCam):

- roll 5°
- yaw 8°
- pitch 8°
- apparent size ±10 %
- face centre 0.06 of frame
- face brightness ±15 %
- side shading 0.10

## Scientific limitations

- No property here is validated against ground truth, and no tolerance is validated. "Within
  experimental tolerance" means within an exploratory number, not comparable for evidence
  purposes.
- Brightness and shading are measured on pixels after the camera's auto exposure, tone mapping
  and white balance. Two captures can match in pixels under different light, or differ in
  pixels under the same light.
- The scene colour estimate depends on what is behind the person. A different background
  changes it without any change in light.
- Yaw and pitch come from a model's head-pose estimate. Their accuracy on iPhone front cameras,
  across skin tones and with glasses has not been measured.
- The face box is a rectangle, so face brightness includes a little background at the corners.
- No clinical claim of any kind is made, and nothing here describes skin.

## Verification status

| Evidence | Covers | Status |
|---|---|---|
| Unit tests with geometric landmark sets and synthetic pixels | Arithmetic and the honesty rules: missing face, multiple faces, pose, crop, motion, lighting limits, colour exclusion, comparison | Simulated, passing |
| Unit tests with fake browser objects | Track stop, model close, cancelled frame, released canvases, late camera and model after dispose | Simulated, passing |
| Playwright with Chromium's synthetic camera | Real `getUserMedia`, frames, canvas pixels, the honest model-unavailable path, no storage, no non-GET requests, camera release on `pagehide` | Real browser APIs with a synthetic picture, passing in Chromium |
| MediaPipe Face Landmarker in a browser | Landmarks on a real face | **Not verified.** The model hosts were unreachable from the build environment. |
| Physical iPhone | Anything | **Not verified** |

## Running it on an iPhone

Safari allows the camera only in a secure context. Two ways to run it:

- Serve a build with `VITE_LOCAL_OPTICS_EXPERIMENT=true` over HTTPS. A deployment-disabled
  preview needs explicit approval.
- Run the dev server over HTTPS on the local network.

Then open `/experiments/local-optics`, tap **Start camera** and **Load face landmarks**, and
capture a baseline and a comparison.

## Next smallest experiment

On one iPhone, take 10 baseline/comparison pairs with nothing changed and 10 with one deliberate
change each:

- a 15° head turn
- a step back
- one lamp switched off
- a different background

Record the per-property differences. This answers whether the measured differences separate the
deliberate changes from repeat noise. It is the minimum before any tolerance can be proposed.
