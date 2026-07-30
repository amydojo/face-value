# Camera contract

This adapter preserves the portable behavior of the Chaos Vault camera artifact while changing the preferred lens for Face Value.

1. Detect `navigator.mediaDevices.getUserMedia`.
2. Request video only with `facingMode: { ideal: "user" }`, ideal width 1920, and ideal height 1080.
3. If preferred constraints are overconstrained, retry with `{ video: true, audio: false }`.
4. Normalize exceptions to `unsupported`, `denied`, `no_camera`, `overconstrained`, or `unknown`.
5. Never expose raw DOMException text in product UI.
6. Attach the stream to a muted, inline-playing video element.
7. Stop every track after capture, navigation away, error, deletion, and unmount.
8. Draw the current video frame to canvas and return `image/jpeg` at 0.92 quality.
9. Mirror the preview with CSS only. The analysis capture is always unmirrored.
10. Revoke every temporary object URL.
11. Keep `<input accept="image/*" capture="user">` usable as the fallback.

The adapter and automated tests do not constitute physical-device verification. Device claims must be added only after real browser and hardware testing.

## Guided acquisition architecture

Production presentation and acquisition are owned by
`NativeBrowserCameraAdapter`. It requests the front camera from the
`START GUIDED CAPTURE` tap, attaches that stream to the exact Face Value
`<video>` surface the person sees, and does not report `preview-live` until the
surface is connected, visible, non-zero, and producing a current frame. Slow
permission or startup remains in explicit opening/waiting states for up to 20
seconds; it is not collapsed into a false `Camera unavailable` state.

The native path downsamples frames in memory to assess whole-frame exposure and
frame-to-frame movement. It deliberately does not claim face detection,
distance, pose, alignment, skin condition, or facial-region registration.
Face Value’s authored guide supplies positioning direction. The reducer owns
the 500 ms stable hold, lock, pause, scan, and explicit bitmap capture
boundary. Camera startup and capture timing therefore have one authority.

The exact captured browser frame remains as the private specimen preview while
the existing YouCam downstream redness analysis runs. Only metadata and the
normalized durable signal enter application state. Frame bytes, luma samples,
MediaStreams, and object URLs are cleared when they are no longer needed.

## Camera Kit contract harness

The external Camera Kit 2.5 renderer is retained only in the development route
`?camera-kit-diagnostics=1`. This harness uses the documented standard
`skincare`/`720p` configuration and reports only lifecycle stages, generic
surface type, and non-sensitive surface dimensions.

The previous production configuration selected `hdskincare`. Camera Kit’s
runtime checks that mode after camera startup and calls:

```text
alert("width:" + camera_width + ", height:" + camera_height)
```

when either camera dimension is below 1024. Physical iPhones supplied
`986 × 1920` and `960 × 1920`, causing the native alerts attached to PR #62.
The same implementation requested undocumented `moduleMode: "headless"`,
searched only descendant video nodes, hid Camera Kit’s actual iframe/canvas,
and treated a missing video as ready. A 3-second watchdog then closed the
still-starting session. Those production assumptions and the global alert
interceptor have been removed.

This was verified on 2026-07-29 against Camera Kit `2.5.1`, dynamic build
`2605111753`, in
`webenvcheckercontrollerv2-a8d7166d45e1322cfd54.bundle.js`. Perfect Corp’s
published Camera Kit reference describes `skincare`, `hdskincare`, the
resolution requirements, `YMK.isLoaded()`, and the documented init options:
<https://docs.perfectcorp.com/reference/ai_nail_vto/section/overview>.

The diagnostic adapter does not mutate vendor-owned DOM or stop vendor-owned
tracks directly. `sdk.close()` is its single teardown authority. Readiness
requires both the documented `YMK.isLoaded()` frame signal and a connected,
visible, non-zero video, canvas, or iframe renderer. Its watchdog is 20 seconds.
No Camera Kit private node ID is referenced.
