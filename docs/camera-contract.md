# Face Value camera contract

**Status:** Current camera authority  
**Effective date:** July 30, 2026  
**Implementation base:** `main` at merged PR #67
(`330f51975f162a2c15784114d7a448492973fcad`)

**Current change:** issue #63

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
8. capture three exact current visible frames as unmirrored JPEGs
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
On the native frame-quality path, the alignment rail therefore remains pending;
only the measured exposure and movement rails may be marked as passing.

## 3. Current acquisition sequence

The reducer-owned sequence is:

```text
Searching
→ Aligning
→ Locking
→ Scanning
→ 3 Measurements Accepted
→ Processing
```

Camera startup and capture timing have one authority.

- slow permission or startup remains in explicit opening/waiting state
- the stable hold is reducer-owned
- losing valid exposure or stillness cancels lock/scan calmly
- one scan timing constant controls normal motion
- reduced motion preserves the same state order with a short illumination state
- a restrained three-position indicator advances only for an accepted current frame
- recoverable capture rejection acquires a replacement automatically
- the same camera session remains alive through the short burst
- the final captured bitmap may remain as the private preview into YouCam processing

Every burst requires three accepted frames and permits at most five capture
attempts. `requestVideoFrameCallback` supplies decoded-frame identity when the
browser supports it. The fallback accepts a frame only after `video.currentTime`
advances through an animation-frame observation. Elapsed time alone never
proves that a new frame exists. Duplicate frame identifiers are rejected.

The available whole-frame exposure and movement gates run again before every
accepted frame. The product does not ask the person to deliberately reposition
between frames.

Only face-free capture metadata and normalized durable signals enter
application state.

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

One existing photo cannot prove three distinct current decoded frames. The
fallback therefore discloses that limitation, performs no provider analysis,
commits no period evidence, and releases the selected file immediately. It is
never duplicated or reinterpreted as a burst.

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
- three distinct decoded-frame boundaries
- fresh exposure and movement gates before each accepted frame
- a hard five-attempt acquisition ceiling
- duplicate frame-identifier rejection
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

## 9. Current burst extension

Issue #63 extends the active native session to capture three distinct current
frames before teardown.

It preserves:

- one user gesture and one continuous ritual
- current-frame boundaries rather than score/image duplication
- bounded attempts
- reducer-owned generation identity
- one abort authority
- cleanup of every frame after analysis
- no fabricated pose or registration evidence
- unchanged production camera geometry

Automated and desktop-browser proof does not establish physical-iPhone
acceptance. The exact-head hardware checklist additionally requires proof of
three distinct accepted frame events, three genuine provider analyses for both
periods, retry and route-exit teardown, Safari viewport behavior, and
face-free reload continuity.

See `production-journey-integration.md`, `architecture.md`, and `source-of-truth-manifest.md`.
