# Local optical comparability (experiment 01)

**Status:** technical feasibility prototype. Experiment 02 added the real on-device model and
same-origin assets; experiment 04 turned the diagnostic page into a hand-held-first guided capture
(see [Guided capture](#guided-capture-experiment-04)). Not connected to the redness evaluator,
verdicts, the Oracle, the Evidence Record, persistence or YouCam. Metrics
`fv-local-optics-metrics-0.1`; tolerances `fv-local-optics-tolerances-0.1-unvalidated` (unchanged
by experiment 04); guide `fv-guided-capture-guide-0.1-unvalidated`.

**Question:** can Face Value measure, on the person's own iPhone and without a provider, whether
two face captures were taken under comparable conditions?

## Where it lives

- Route: `/experiments/local-optics`. It is compiled only into development builds or builds with
  `VITE_LOCAL_OPTICS_EXPERIMENT=true`, as a separate chunk.
- Code: `src/features/local-optics/`
  - `opticsMetrics.ts`: pure, versioned measurements and the comparison
  - `landmarkSource.ts`: same-origin MediaPipe Face Landmarker loader with a model integrity check
  - `local-optics-assets.json`: pinned runtime and model, with hashes
  - `opticsSession.ts`: camera, frame sampling, live readings and cleanup
  - `guidance.ts`: the live guide (one instruction, hysteresis, stability window, baseline
    matching) and the minimal baseline template
  - `LocalOptics.tsx`: the guided capture flow; `GuideOverlay.tsx`: the alignment overlay;
    `LabPanel.tsx`: every number and diagnostic, collapsed by default; `scanMetrics.ts`: the
    in-memory usability log
- Tests: four unit test files (`src/test/local-optics-*.test.ts`) and three Chromium specs:
  `e2e/local-optics.spec.ts` (no model), `e2e/local-optics-inference.spec.ts` (real model) and
  `e2e/local-optics-usability.spec.ts` (exploratory usability measures). Shared pieces:
  `e2e/local-optics-harness.ts` and `e2e/local-optics-videos.ts`, which builds the camera videos
  with ffmpeg. The specs skip in WebKit CI and when the assets are not prepared.

## Privacy and network behaviour

- **Frames:** each capture draws 12 frames into an in-memory canvas, downscaled to at most
  360 px on the long side. Only numbers leave the capture function. The last frame is kept in
  memory for the Lab thumbnail and released when the scan ends (Done, Cancel or a new scan), on
  unmount and on `pagehide`; the Lab then says so. Live guidance draws each reading into one
  reused 160 px canvas for face brightness, and keeps only the previous reading's landmarks to
  measure speed; the next reading replaces them, and stopping the camera clears them.
- **Baseline:** a follow-up is guided by a template of ten rounded numbers (orientation, face
  centre, eye-corner distance, roll, yaw, pitch, face brightness, side shading). It holds no
  landmarks, contours, facial proportions, pixels or device identifiers. The baseline
  measurement kept for the comparison drops face-box height and edge margin, which together with
  size and position would describe facial proportions. Both live in the tab's memory only and
  are gone on reload.
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

## Guided capture (experiment 04)

The default screen is a capture chamber in Face Value's dark capture language: the live camera,
an alignment outline, one instruction, a light / alignment / stillness rail, and one action. Every
number lives in the **Lab** panel below it, collapsed by default.

Screens: [before](../verification/guided-capture/before.png),
[after](../verification/guided-capture/after.png) and
[after at 320 × 568](../verification/guided-capture/after-320x568.png). They were rendered in
Chromium from the experiment build with the generated camera videos, not on an iPhone.

**Flow.** **Start scan** opens the camera and, at the same time and only then, loads the model
(lazy initialisation). The guide shows one instruction at a time. When framing, light and
stillness have held for the stability window, it captures the 12-frame burst on its own. The
actuator button captures manually at any time. Every burst, automatic or manual, still goes
through `measureCapture`'s unchanged gates:

- **A refused burst** is never kept. A notice says why ("Too much movement"), and the guide
  starts again.
- **After three refused automatic bursts in a row,** auto-capture pauses and a help card offers
  a tip and a way to resume.
- **An accepted first burst** becomes the baseline. The next scan is a follow-up guided to the
  baseline's outline, then compared with `compareCaptures` and its unchanged tolerances.
- **The result** reads "Matches your baseline", "Doesn't match your baseline" (with up to two
  plain reasons) or "Couldn't confirm a match". Each carries the line "Experimental check. Not a
  validated comparison."

**One instruction, no flicker.** Each check has a hysteresis band: a value must clear an inner
limit to pass and leave an outer limit to fail. A new instruction must be the top problem for
450 ms before it shows, and a shown instruction stays at least 900 ms. The exceptions are a lost
face (after 700 ms), a second face and a rotated phone, which show at once. The priority order
is:

1. Cut off or too close
2. Too far
3. Off centre
4. Head roll
5. Yaw
6. Pitch
7. Glare
8. Too dark
9. Light differs from the baseline
10. Side light differs from the baseline
11. Hold still

**Stability window.** An automatic burst needs at least 800 ms and at least 5 consecutive
readings in which every check passes, with "Hold still" already on screen. One failing reading
restarts the window. The stillness check uses the median of the last three landmark speeds, so
a single jittery model reading neither passes nor breaks it.

**Stillness predicts the existing motion gate.** `measureCapture` rejects more than 0.02
interocular units of landmark movement per *analysed frame*. That is a speed limit of
0.02 ÷ frame interval, which depends on the device. The guide therefore reads the expected burst
frame interval (the last burst's measured interval, or the live reading cost) and asks for 65 %
of that speed to enter and 85 % to stay. It never relaxes the gate.

**Guide targets** (exploratory framing targets, not gates; size is eye-corner distance over the
frame's short side):

| Check | First scan: enter / leave | Follow-up: enter / leave |
|---|---|---|
| Size | 0.22–0.40 / 0.20–0.43 | within 6 % / 9 % of the baseline |
| Centre | x within 0.07 / 0.10 of the middle; y 0.36–0.60 / 0.33–0.63 | within 0.039 / 0.054 of the baseline |
| Edge margin | ≥ 0.04 / ≥ 0.02 (any landmark outside the frame fails the gate) | same |
| Roll | ≤ 4° / 6° | within 3.5° / 4.5° of the baseline |
| Yaw (model estimate) | ≤ 10° / 14° | within 6° / 7.2° of the baseline |
| Pitch (model estimate) | ≤ 20° / 25° (extremes only) | within 6° / 7.2° of the baseline |
| Glare (clipped face pixels) | ≤ 1.5 % / 2 % (the gate is 2 %) | same |
| Face brightness | ≥ 45 / 38 (8-bit luma) | within 10.5 % / 13.5 % of the baseline |
| Side shading | not checked | within 0.07 / 0.09 of the baseline |

Follow-up limits are fractions of the comparison tolerances: 60–75 % to enter, 90 % to stay.

**The outline.** On a first scan the outline sits at the nearest acceptable framing to the face,
so it closes around the face as soon as the framing is acceptable. On a follow-up it is the
baseline's outline. Both shapes are generic ellipses sized from the eye-corner distance; neither
traces the person's face. A chevron points toward the outline when position is the instruction.

**Robustness.**

| Situation | Behaviour |
|---|---|
| Camera denied | "Camera access is off", with the Safari route to the setting, and **Try again** |
| No camera, unsupported browser, insecure page | A plain explanation for each |
| Model fails (integrity, 404) | "The face guide couldn't load", the camera released, and **Try again**; the Lab shows the reason |
| App in the background | Camera and any burst stop; **Resume scan** continues the same scan, and the model stays loaded |
| iOS ends the camera | "Camera interrupted" and **Resume scan** |
| Phone rotates | The guide resets. A burst whose frame size changes is refused ("The phone turned"). A follow-up in the other orientation is asked to rotate. |
| Cancel | Possible at any point, including mid-burst; returns to the start with the camera released |
| Cannot get there | After 25 s without a capture, a help card with a tip chosen from the recent problem (`?helpAfter=<s>` shortens this for device tests) |
| Reduced motion | No transitions, entrance animations or easing on the overlay |

Instructions are announced politely to screen readers and are always visual text; the rail
marks state with text and a check mark as well as colour.

### Revision 04.1: friction from the first iPhone run

The first real-iPhone run had 2 of 2 automatic captures accepted, with no refused bursts. The
baseline took 7.2 s and the follow-up 1.6 s; bursts ran at 22 ms per analysed frame. The person
preferred automatic capture. The friction was in the wording and in getting results out of the
Lab. Revision 04.1 changes only these; no threshold, gate, tolerance or stability requirement
changed.

- **Guidance wording.**
  - "Hold your phone at eye level" became "Point the front camera at your face".
  - "Center your face" now says "Follow the arrow", matching the on-screen chevron.
  - Moving too much reads "Hold steady". Aligned and about to capture reads "Hold it there,
    capturing automatically"; before, both said "Hold still".
- **The instruction follows the current condition.** The 900 ms minimum display now applies
  only while the shown problem is still present. Once it clears, the next instruction appears
  after the 450 ms dwell alone.
- **Aligned → capture is visible.** While the hold window fills, the chamber gets an amber frame
  and the instruction turns amber. During the burst the frame thickens and the caption counts
  "Capturing · n of 12". The frame disappears at once when the capture ends. Reduced motion
  removes the easing.
- **One-tap test report.** **Copy test report** is the first thing in the Lab. It copies one JSON
  report (`fv-guided-test-report-0.1`) containing:
  - versions;
  - the device path: delegate, model initialisation time, frame size, burst frame intervals;
  - the usability summary and every scan record;
  - every follow-up comparison of the tab, recorded automatically with no label or "Add pair"
    step.

  It holds numbers and state names only: no images, landmarks, baseline template, user agent or
  device identifiers. Everything else in the Lab sits under a collapsed **Diagnostics and
  details**.

**Interactions to get a usable test report** (usability numbers plus the paired measurements),
counted from the result screen at 390 × 844 on each build:

| | 04 (`5acc2f0`) | 04.1 |
|---|---|---|
| Taps | Lab, Add pair to log, Copy log, Copy usability log (plus a label field, optional): 4–5 | Lab, Copy test report: 2 |
| Scrolling | About 1,800 px to the pair controls, then more to the usability log (Lab about 3,100 px tall) | None: the button is on screen after tapping Lab (Lab collapsed to about 445 px) |
| Separate copies and pastes | 2 | 1 |

[Screens, 04 vs 04.1](../verification/guided-capture/04-vs-04.1.png).

### Usability measures (exploratory, simulated)

Measured with `e2e/local-optics-usability.spec.ts`: the real model in Chromium on a 2-core
machine with software rendering, about 250 ms per analysed frame. The "person" is a public-domain
portrait moved by a script. The numbers below are what the scripted runs measured, not human
usability results, and no gate was tuned to them. The raw report is in
[`docs/verification/guided-capture/`](../verification/guided-capture/).

- **Realtime runs:** the clip plays at normal speed. They measure flow, timing, corrections and
  recovery.
- **Dilated runs:** the clip is slowed 8×, so the motion between analysed frames (~250 ms here)
  equals a phone analysing every ~32 ms. Burst pass/fail is representative; durations are not.

| Measure | Result (second run, current code) |
|---|---|
| Completion, automatic | 12 of 12 scans accepted: steady, off-centre start, and calm and active hand-held. 0 of 1 on a shaking phone and 0 of 1 held too far away, by design; the help card appeared in both. |
| Unnecessary rejections | 0 of 12 automatic bursts rejected, in both runs |
| Time from **Start scan** to accepted, baseline | 12.3 s (steady), 14.0 s (off-centre start). This includes about 3 s of first-inference warm-up before the first face reading. |
| Time from **Start scan** to accepted, follow-up | 5.8–6.0 s (steady). 13.6 s from an off-centre start that the clip holds for 6 s. |
| Time from alignment to accepted | 4.5–4.9 s typical, of which about 3 s is the 12-frame burst on this machine. One active hand-held follow-up took 11.8 s. |
| Corrections requested | Steady 0–2; off-centre 2 (centre, then hold still); calm hand-held 0–1; active hand-held 1–2 |
| Hand-held movement tolerance (landmark motion per analysed frame, gate 0.02) | Calm 0.006–0.010; active 0.006–0.015 (all pass); shaking 0.075–0.094 (all refused) |
| Recovery | Backgrounded mid-scan, then **Resume scan**: accepted 6.2 s after resuming. The functional spec also covers background mid-burst and the OS ending the camera. |
| Cancellation | Cancel while guiding and mid-burst both return to the start with the camera released; the cancelled burst is never evaluated (functional spec) |
| Automatic vs manual | A tap 0.3 s after the guide appeared was accepted 6 of 6 times on calm and active hand-held clips, in 3.6–3.9 s, and every one matched the baseline. Automatic capture took 5.6–16.9 s for the same clips. On a shaking phone, manual taps were refused 2 of 2 for motion. |

**What this says.** The guide never fired into a failing burst, never captured a shaking phone,
and corrected framing before capturing. For a calm hand, though, waiting for the stability window
cost seconds without preventing a single rejection in these simulations. A median filter on
speed (added after the first run) cut the wait: steady follow-ups went from 7.5 to 5.9 s and the
calm hand-held baseline from 15.1 to 8.0 s, still with 0 rejections. Whether the wait pays for
itself on a real phone, with real hands and auto exposure, is the main question for the iPhone
test. The fixture has no head rotation, expression or exposure change, so yaw, pitch and
light guidance are exercised only by unit tests.

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
- **The motion gate depends on device speed.** It is defined per analysed frame, not per second,
  so the same hand movement measures larger on a slower device or a slower delegate. A burst on a
  phone analysing every ~33 ms tolerates about eight times the movement of one analysing every
  ~260 ms. The guide predicts this and each burst logs its frame interval, but comparability of
  motion gating across devices is unresolved.
- **The guide's limits are framing targets, not evidence.** Brightness guidance uses a 160 px
  live sample on camera-processed pixels. Darkness has no gate; the guide's darkness limit is new
  and unvalidated.
- **The help timer, retry count and stability window are UX choices,** not measurements.
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

**Model provenance.** Google's host was unreachable from the original build environment, so the
model bytes first came from an npm package that redistributes the official files
(`ptmaker-vision-models@1.0.0`), accepted because their size and SHA-256 match an independent
public record of Google's URL
([kylept/browser-model-mirrors](https://github.com/kylept/browser-model-mirrors)). Since then,
the Vercel preview build downloaded the model from Google's URL itself and it matched the same
SHA-256. That is still not a Google-signed hash. Google's repository publishes SHA-256 values only for
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
| Guided capture flow, real model | Chromium, real model, generated camera videos: automatic baseline and follow-up, background mid-guide and mid-burst, OS-ended camera, cancel mid-burst, `pagehide`, no face, two faces, model integrity failure and recovery, CPU delegate | PASS (Chromium) |
| Guided capture failure paths without a model | Denied permission and recovery, withheld model, reduced motion, 320 × 568 layout | PASS (Chromium) |
| Guide logic | Unit tests: firing only after a sustained window, no flicker at thresholds, priority, baseline matching, the template's contents | PASS (simulated) |
| Guided capture usability | Scripted runs; see [Usability measures](#usability-measures-exploratory-simulated) | Measured (simulated, not human) |
| WebKit and iOS Safari | — | **NOT TESTED** (WebKit download hosts unreachable; no device) |
| Repeatability on a real face | — | **NOT TESTED**. Every Chromium "capture" is a still image, so between-capture differences are trivially zero. |

**Limitation found in testing:** the Face Landmarker uses a short-range face detector. Faces about
80 px wide in a 640 × 480 frame (12 % of its width) were not detected, while head-and-shoulders
framing was. Distance changes in the protocol below must stay within selfie range.

## Running it on an iPhone

Safari grants the camera only over HTTPS. There are two routes.

### Protected lab deployment on Vercel (preferred)

`vercel.json` builds through `scripts/vercel-build.mjs`:

- **This branch in the `face-value-optics-lab` project** (or a preview of this branch) runs
  `npm run prepare:local-optics` and builds with `VITE_LOCAL_OPTICS_EXPERIMENT=true`. The prepare
  step downloads the model from Google's URL and refuses it unless the SHA-256 matches. If the
  builder cannot reach Google, the build fails rather than shipping a page without a model.
- **Production and every other branch** run the unchanged `npm run build`. A clean-checkout
  production build is byte-identical to `main@766c76c`.

See [Preview deployment](#preview-deployment). Safari must be logged in to Vercel.

### Local HTTPS dev server

1. Run `npm ci`, then `npm run prepare:local-optics`.
2. Create a certificate the phone trusts, for example with `mkcert <laptop-LAN-IP>`. Install
   mkcert's root CA on the iPhone and enable full trust for it.
3. Start the server with
   `FV_DEV_HTTPS_CERT=<cert.pem> FV_DEV_HTTPS_KEY=<key.pem> npx vite --host 0.0.0.0`.
4. Open `https://<laptop-LAN-IP>:4173/experiments/local-optics`.

### On the phone: Safari checks

**Lab → Device diagnostics** reports each of these. Record them once per device:

1. **Secure context** reads `yes`.
2. **Camera permission:** Safari prompts on **Start scan**. Afterwards the panel reads
   `granted`, or `not exposed by this browser`.
3. **Front camera and orientation:** `Facing mode` should be `user`. `Frame` should read
   `… portrait` when the phone is upright.
4. **Model initialisation:** `Delegate in use` reads `GPU`, or `CPU (GPU failed: …)`, with the
   initialisation time. Reload with `?delegate=cpu` to measure the CPU path for comparison.
5. **Background:** switch apps mid-scan and come back. The scan shows **Scan paused**
   (`Background pauses` goes up), and **Resume scan** continues without re-downloading the
   model. If iOS ends the camera itself, the screen reads **Camera interrupted**.
6. **Network:** in Safari Web Inspector (Mac, Develop menu), check that the request list
   matches the inventory below.

### Real iPhone usability checklist (guided capture)

Do these on the phone, holding it naturally, without reading the Lab first. After the session,
tap **Lab**, then **Copy test report**, and paste the JSON into a note. It holds the usability log
and every follow-up comparison, as numbers and state names only.

1. **Cold start.** Open the page and tap **Start scan**. Note whether you understood what to do
   without reading anything, and how long the face guide took to appear (`guideReadyMs`,
   `firstFaceMs`).
2. **Natural baseline.** Hold the phone naturally, facing you, and let it capture on its
   own. Note the time to the result (`acceptedMs`), each instruction you saw (`instructions`),
   and whether any instruction felt wrong or flickered.
3. **Follow-up.** Tap **Scan follow-up**, put the phone down for a few seconds, pick it up again
   and match the outline. Note whether the outline was easy to match and whether the result says
   it matches.
4. **Manual shutter.** Start another follow-up and tap the button immediately. Compare its
   result and `bursts[].landmarkMotion` with the automatic ones.
5. **Movement tolerance.** Start a scan while walking slowly or talking. The guide should say
   **Hold still** and not capture. Then stand still and check that it recovers.
6. **Hard conditions.** Try a scan with a bright window behind you, then one in a dim room. Note
   the instruction shown and whether the help card appeared.
7. **Interruptions.** Mid-scan, lock the phone, then unlock it and tap **Resume scan**. Repeat
   with an app switch, and with a FaceTime or phone call if you can.
8. **Rotation.** Mid-scan, turn the phone sideways and back.
9. **Cancel.** Cancel mid-scan and mid-capture. The camera indicator (green dot) should go off at
   once.
10. **Permission denied.** In Safari's Website Settings, set Camera to Deny, tap **Start scan**,
    follow the on-screen route back to Allow, and tap **Try again**.
11. **Device facts.** Record `bursts[].frameIntervalMs` (the time between analysed frames on this
    phone) and **Lab → Device diagnostics**. The motion gate's strictness depends on the frame
    interval.
12. **Accessibility.** Turn on Reduce Motion and repeat a scan. Try a scan with VoiceOver on; the
    instruction should be read out as it changes.

### Network inventory

Observed in Chromium on the production-style preview build, for a full session: load, camera,
model, two captures and export.

| Request | Size |
|---|---|
| `GET /experiments/local-optics` and the app shell, CSS and favicon | about 0.8 MB |
| `GET /assets/LocalOptics-*.js`, `vision_bundle-*.js` (MediaPipe 0.10.35) | 166 KB |
| `GET /local-optics-assets/…/face_landmarker.task` | 3.76 MB |
| `GET /local-optics-assets/…/wasm/vision_wasm_internal.js` and `.wasm` (SIMD) | 11.5 MB |

That is all ten requests: same-origin GETs only, with no POST and no `/api` call. Pixels and
landmarks never leave the tab. On a Vercel preview, the Vercel toolbar may add requests to
`vercel.live` unless it is disabled for the branch. Safari may also pick the non-SIMD runtime.

## iPhone test protocol (privacy-preserving)

- **Recording:** scan a baseline, then a follow-up. Open **Lab**, type the pair's label in
  **Pair label** and tap **Add pair to log**. Start over with a new baseline for the next pair.
  When the session is done, tap **Copy log** and paste the JSON into a note.
- **What the log holds:** numbers only: comparison rows, gates, frame sizes, face counts and
  camera settings without device identifiers. It never holds images or landmarks, nothing is
  saved, and nothing is sent.
- **What never to keep:** screenshots of the snapshots.
- **Setup:** same phone, same session, phone in the same position for every baseline. Keep
  faces at selfie distance, because the detector is short-range.

| Block | Labels | Change between baseline and comparison |
|---|---|---|
| A. Repeat | `A01` to `A10` | None: recapture immediately |
| B. Head orientation | `B-yaw-1..3`, `B-pitch-1..3` | Turn the head about 15° to one side; tilt it about 10° down |
| C. Distance | `C-dist-1..3` | Move the phone about 10 cm further away (still within arm's length) |
| D. Lighting | `D-lamp-1..3`, `D-window-1..3` | Switch one lamp off; move from window light to room light |
| E. Background | `E-bg-1..3` | Same light, different wall behind you |

**Reading the results:**

- Block A estimates repeat noise for each property.
- A property is informative only if its Block B to E differences exceed the Block A spread.
- Background (E) should move only the scene-colour estimate. If brightness moves too, auto
  exposure is reacting to the background.
- Nothing is a tolerance until this has been repeated across people and devices.

## Preview deployment

The experiment is deployed to a separate Vercel project, `face-value-optics-lab`:

- **Protection:** Vercel Authentication covers all deployments.
- **Environment:** no provider credentials. The only variable is
  `VERCEL_PREVIEW_FEEDBACK_ENABLED=0`, and the toolbar is off.
- **Isolation:** `vercel.json` disables Git deployments for this branch, so pushing it never
  builds in the `face-value` project. Lab deployments are created explicitly from a commit.
- **Build gate:** `scripts/vercel-build.mjs` builds the experiment for a preview of this branch,
  or for this branch in the lab project. Every other build is the standard build.

Redeploying a new commit needs the project owner's go-ahead. Do not merge the experiment.

## Next smallest experiment

1. Deploy the guided capture to the lab project (needs the owner's go-ahead).
2. On one iPhone, run the Safari checks and the guided-capture usability checklist.
3. Run the protocol, Block A first, and export the numeric and usability logs.
