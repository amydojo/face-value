# Face Value camera contract

**Status:** Current camera authority  
**Effective date:** July 30, 2026  
**Implementation baseline:** `main` after PR #62 (`e0173ee`)

## 1. Production boundary

Production acquisition is owned by `NativeBrowserCameraAdapter`.

It must:

1. start only from an explicit user gesture
2. detect `navigator.mediaDevices.getUserMedia`
3. request a front-facing video stream with preferred high-resolution constraints
4. retry with general video constraints when preferred constraints are overconstrained
5. normalize errors to stable product categories
6. attach the stream to the exact muted inline-playing `<video>` surface the person sees
7. report preview readiness only when that surface is connected, visible, non-zero, and producing a current frame
8. capture the exact current visible frame as an unmirrored JPEG
9. mirror preview presentation with CSS only
10. stop every track on success, failure, cancellation, navigation, retry, and unmount
11. revoke every temporary object URL
12. retain an existing-photo input as a recoverable fallback

Raw DOM exception text must not appear in product UI.

## 2. Acquisition signal boundary

The native path downsamples current frames in memory to assess:

- whole-frame exposure
- frame-to-frame movement
- current-frame availability
- stable hold

It deliberately does not claim:

- face detection
- face bounds
- distance measurement
- frontal-pose measurement
- landmarks
- facial registration
- skin-tone classification
- skin condition or diagnosis

The authored four-arc guide supplies positioning direction. It is not a biometric overlay and must not be described as automated face geometry.

## 3. Current acquisition sequence

The reducer-owned sequence is:

```text
Searching
→ Aligning
→ Locking
→ Scanning
→ Captured
```

Camera startup and capture timing have one authority.

- slow permission or startup remains in explicit opening/waiting state
- the stable hold is reducer-owned
- losing valid exposure or stillness cancels lock/scan calmly
- one scan timing constant controls normal motion
- reduced motion preserves the same state order with a short illumination state
- the exact captured bitmap remains as the private preview into YouCam processing

Only capture metadata and the normalized durable signal enter application state.

## 4. Image lifecycle

Temporary resources may exist only inside the active capture/analysis boundary:

- `MediaStream`
- video frame
- canvas or bitmap
- captured `Blob`
- private object URL
- luma/movement samples

They must be cleared when no longer needed. No raw face image enters reducer state, local storage, logs, analytics, snapshots, or committed verification artifacts.

## 5. Existing-photo fallback

`<input accept="image/*" capture="user">` remains available when camera APIs are unsupported, denied, or fail after recovery.

The fallback must:

- use a clear front-facing supported image
- preserve the same frozen analysis protocol
- disclose any evidence limitation
- avoid duplicating one file to simulate a future multi-frame burst
- release the selected image after analysis or cancellation

#63 must define an explicit burst-compatible fallback policy rather than silently treating one uploaded image as three measurements.

## 6. Camera Kit diagnostic harness

The external Perfect Corp Camera Kit 2.5 renderer is retained only in development with:

```text
?camera-kit-diagnostics=1
```

The harness uses the documented Camera Kit surface and reports only privacy-safe lifecycle state and renderer dimensions.

Current official AI Skin Analysis v2.1 documentation, including JavaScript Camera Kit 2.5, is:

`https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.1`

The diagnostic adapter:

- does not mutate vendor-owned DOM beyond documented integration needs
- does not stop vendor-owned tracks directly
- uses `sdk.close()` as teardown authority
- requires documented `YMK.isLoaded()` plus a connected visible non-zero renderer
- does not depend on private vendor node IDs
- uses a bounded startup watchdog

## 7. Why Camera Kit is not production capture

The former production configuration selected `hdskincare` and depended on vendor renderer assumptions that failed on physical iPhone Safari.

Observed during PR #62 investigation:

- physical camera dimensions triggered vendor resolution alerts
- the renderer could be an iframe/canvas rather than the expected descendant video
- an empty mount could be mistaken for live preview
- undocumented initialization fields were being passed
- a short watchdog could close a still-starting session

PR #62 removed those assumptions and moved production to the exact first-party video surface. Camera Kit remains useful as an engineering contract harness, not the current product camera.

## 8. Verification boundary

Automated adapter and Playwright tests prove only their simulated environment. They do not constitute physical-device verification.

Current automated proof includes:

- first-frame readiness
- visible video binding
- whole-frame exposure and movement handling
- stable hold and state cancellation
- same-bitmap freeze
- track teardown
- no vendor alert
- dynamic visual viewport behavior
- reduced motion
- privacy-safe screenshots

A physical-device claim must record:

- exact commit SHA
- exact deployment
- device model
- iOS and Safari version
- permission recovery
- ordinary, low, and backlit conditions
- movement during lock and scan
- Safari chrome expansion/contraction
- route-exit camera shutdown
- existing-photo fallback
- unresolved limitations

The physical observations that motivated PR #62 are recorded, but a final exact-head merged-production baseline and follow-up pass remains a release gate.

## 9. Planned burst extension

#63 may extend the active native session to capture three distinct current frames before teardown.

It must preserve:

- one user gesture and one continuous ritual
- current-frame boundaries rather than score/image duplication
- bounded attempts
- reducer-owned generation identity
- one abort authority
- cleanup of every frame after analysis
- no fabricated pose or registration evidence
- unchanged production camera geometry

See `production-journey-integration.md`, `architecture.md`, and `source-of-truth-manifest.md`.