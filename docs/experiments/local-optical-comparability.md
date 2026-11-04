# Local optical comparability (experiment 01)

**Status:** technical feasibility prototype (experiment 02: real on-device model, same-origin assets). Not connected to the redness evaluator, verdicts,
the Oracle, the Evidence Record, persistence or YouCam. Metrics `fv-local-optics-metrics-0.1`;
tolerances `fv-local-optics-tolerances-0.1-unvalidated`.

**Question:** can Face Value measure, on the person's own iPhone and without a provider, whether
two face captures were taken under comparable conditions?

## Where it lives

- Route: `/experiments/local-optics`. It is compiled only into development builds or builds with
  `VITE_LOCAL_OPTICS_EXPERIMENT=true`, as a separate chunk.
- Code: `src/features/local-optics/`
  - `opticsMetrics.ts`: pure, versioned measurements and the comparison
  - `landmarkSource.ts`: same-origin MediaPipe Face Landmarker loader with a model integrity check
  - `local-optics-assets.json`: pinned runtime and model, with hashes
  - `opticsSession.ts`: camera, frame sampling and cleanup
  - `LocalOptics.tsx`: the diagnostic view
- Tests: three unit test files (`src/test/local-optics-*.test.ts`) and two Chromium specs:
  `e2e/local-optics.spec.ts` and `e2e/local-optics-inference.spec.ts` (real model). The specs skip
  in WebKit CI and when the assets are not prepared.

## Privacy and network behaviour

- **Frames:** each capture draws 12 frames into an in-memory canvas, downscaled to at most
  360 px on the long side. Only numbers leave the capture function. The last frame is kept in
  memory for the diagnostic thumbnail and is cleared on reset, on unmount and on `pagehide`. The
  live readout keeps nothing: each model reading replaces the last.
- **What is never done:** no upload, no storage, no data URLs or blobs, and no analytics.
- **Same-origin only:** the MediaPipe runtime and model are static files on the same site (see
  [Assets](#assets)). Measured in Chromium with the real model loaded: every request went to the
  page's own origin and every request was a GET.
- **Why MediaPipe is pinned below 1.0:** `@mediapipe/tasks-vision` 1.0.0 and later create a
  metrics logger in every task. It POSTs usage and performance data to
  `https://odml.pa.googleapis.com/v1/log` every 60 seconds, and Google's README asks apps to
  obtain user consent. Release 0.10.35 contains no such endpoint, and a unit test fails if the
  installed runtime ever does. Upgrading needs a consent decision first.
- **Not verified:** network behaviour in iOS Safari.

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

## Assets

The runtime and model live in `public/local-optics-assets/mediapipe-tasks-vision-0.10.35/`.
`npm run prepare:local-optics` creates them; the output is git-ignored. Every file is checked
against [`local-optics-assets.json`](../../src/features/local-optics/local-optics-assets.json),
and the browser checks the model's SHA-256 again before handing it to MediaPipe.

| Asset | Source | Licence | Integrity |
|---|---|---|---|
| WASM runtime (SIMD and non-SIMD, 4 files, about 22 MB) | `@mediapipe/tasks-vision@0.10.35`, an exact dependency | Apache-2.0 | npm registry `sha512-HOvadwVR…/egg==` in `package-lock.json`; per-file SHA-256 in the manifest |
| `face_landmarker.task` (`float16/1`, 3,758,596 bytes) | Google's published URL in the manifest | Apache-2.0 | SHA-256 `64184e22…c9ff` |

**Model provenance.** Google's host was unreachable from the build environment, so the model
bytes came from an npm package that redistributes the official files (`ptmaker-vision-models@1.0.0`).
They were accepted only because their size and SHA-256 match an independent public record of
Google's URL
([kylept/browser-model-mirrors](https://github.com/kylept/browser-model-mirrors)). That is strong
corroboration, but not a Google-signed hash. Google's repository publishes SHA-256 values only for
its test-data model files, and none of those is this file. In any environment that can reach
Google, `npm run prepare:local-optics` downloads from Google directly and enforces the same hash.

**Builds.** A production build that does not opt in contains no experiment code and no MediaPipe.
Only prepare assets for experiment builds: anything under `public/` is copied into every build
made from that checkout.

## Verification status

| Check | Evidence | Result |
|---|---|---|
| Real MediaPipe initialisation and inference | Chromium, real Vite dev server (React StrictMode), the real runtime and model, licensed still images played in as the camera | **PASS**. One face: live `faces 1`, roll 2.8°, yaw 0.7°, pitch 15.9°, size 0.088. No face: 0. Two faces: 2. GPU delegate. |
| Model failure handling | Corrupted model (integrity refused, no WASM requested) and missing model (404) | PASS |
| Camera shutdown and model cleanup | `pagehide` ends every camera track and drops the model; a new session initialises again and detects the face | PASS (Chromium) |
| StrictMode remount | Dev build: exactly one live camera track after start | PASS (Chromium) |
| Measurement arithmetic and honesty rules | Unit tests with synthetic landmarks and pixels | PASS (simulated) |
| Resource handling | Unit tests with fake browser objects | PASS (simulated) |
| Asset packaging | Unit tests: a tampered or missing model is refused; the runtime matches its pins | PASS |
| WebKit and iOS Safari | — | **NOT TESTED** (WebKit download hosts unreachable; no device) |
| Repeatability on a real face | — | **NOT TESTED**. Every Chromium "capture" is a still image, so between-capture differences are trivially zero. |

**Limitation found in testing:** the Face Landmarker uses a short-range face detector. Faces about
80 px wide in a 640 × 480 frame (12 % of its width) were not detected, while head-and-shoulders
framing was. Distance changes in the protocol below must stay within selfie range.

## Running it on an iPhone

Safari grants the camera only over HTTPS.

1. Run `npm ci`, then `npm run prepare:local-optics`.
2. Create a certificate the phone trusts, for example with
   `mkcert <laptop-LAN-IP>`. Install mkcert's root CA on the iPhone and enable full trust for it.
3. Start the dev server with
   `FV_DEV_HTTPS_CERT=<cert.pem> FV_DEV_HTTPS_KEY=<key.pem> npx vite --host 0.0.0.0`.
4. Open `https://<laptop-LAN-IP>:4173/experiments/local-optics` in Safari.
5. Tap **Start camera**, then **Load face landmarks**. The live line should read `faces 1` with
   changing values.

The dev server serves the page, the model and the WASM (as `application/wasm`) over TLS. This
was checked with a self-signed certificate; it has not been run on a phone.

## iPhone test protocol (privacy-preserving)

- **What to write down:** for each pair, write down only what the comparison table shows: the
  `vs exp. tolerance` column and the Δ values for roll, yaw, pitch, apparent size, horizontal
  position, face brightness and side shading.
- **What never to keep:** no screenshots of the snapshots, and nothing saved by the app.
- **Same phone, same session.** Hold the phone in the same position for every baseline.

| Block | Pairs | Change between baseline and comparison |
|---|---|---|
| A. Repeat | 10 | None: recapture immediately |
| B. Orientation | 3 + 3 | Turn the head about 15° to one side; tilt it about 10° down |
| C. Distance | 3 | Move the phone about 10 cm further away (stay within arm's length) |
| D. Lighting | 3 + 3 | Switch one lamp off; move from window light to room light |
| E. Background | 3 | Same light, different wall behind you |

**Reading the results:**

- Block A estimates repeat noise for each property.
- A property is informative only if its Block B to E differences exceed the Block A spread.
- Background (E) should move only the scene-colour estimate. If brightness moves too, auto
  exposure is reacting to the background.
- Nothing is a tolerance until this has been repeated across people and devices.

## Next smallest experiment

Run the protocol above on one iPhone in Safari. First confirm that the model initialises on
device (the status line names the delegate) and that the live readout tracks head turns.
