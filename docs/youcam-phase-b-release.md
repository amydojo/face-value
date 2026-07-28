# YouCam Phase B release evidence

> Historical Phase B release record. Phase B.5 replaces the fixture-first
> consumer flow and result copy. See `docs/youcam-phase-b5-release.md`.

Phase B is ready to ship after the exact-head automated and deployment gates pass.

## Product truth

- YouCam measures the capture.
- Face Value owns protocol, comparison, confidence, result, next step, Evidence Record, and restoration.
- For YouCam `hd_redness`, a higher `raw_score` means a more favorable redness-related skin condition. It is not an amount of redness.
- Calibration remains `pending`; confidence cannot exceed `possible` and no noise threshold is committed.

## Live matched verification

A genuine same-session matched pair completed on July 27, 2026:

- baseline: `94.96`
- follow-up: `95.69`
- delta: approximately `+0.73`
- direction: `favorable`
- result: `Favorable direction detected`
- next step: `Test longer / Paused`

The result reached Evidence Machine release, collection, Evidence Record detail, Past Results, and browser refresh restoration. The durable record remained face-free.

## Consumer polish

- Result copy explicitly explains score polarity.
- Scan variation and the uncalibrated noise boundary remain behind the existing `See why` detail.
- Saved trial windows use human-readable local dates and times.
- Archive deletion controls are absent unless an engineer explicitly sets `VITE_SHOW_DEMO_CONTROLS=true`.

Relates to #40 and closes #43 when merged through PR #44.
