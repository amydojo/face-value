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
