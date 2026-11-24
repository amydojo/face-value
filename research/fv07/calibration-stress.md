# FV07 — calibration stress experiment 002

Offline synthetic research only. No real camera data, no participant data, no consumer output. Run `node --test research/fv07/*.test.mjs` and `node --input-type=module -e "import {stressExperiment} from './research/fv07/calibration-stress.mjs'; console.table(stressExperiment().summary)"`.

## Design
Six arbitrary held-out colored patches, three neutral fitting levels, six deterministic perturbations, three methods (raw, single neutral gain, per-channel affine ramp). 108 method/case rows; report coverage as well as mean/max absolute a* error and mean Delta E76. The fitting targets and evaluation patches are separate. All assumed encoded sRGB/D65; gain/offset/mixing applied in linear RGB. No physical calibration claim. Exact simulated saturation is preserved as 0 or 1; clipped inputs abstain.

## Results (mean absolute a* error, six evaluated patches per method unless noted)
| Perturbation | Raw | Neutral | Ramp |
|---|---:|---:|---:|
| Identity | 0 | 0 | 0 |
| Diagonal gain | 6.638 | 0 | 0 |
| Gain + offset | 5.348 | 2.214 | 0 |
| Nonlinear tone | 2.113 | 2.957 | 3.009 |
| Channel mixing | 0.437 | 0.437 | 0.437 |
| Severe clipping | 15.203 (4/6) | 0 (4/6) | unavailable (0/6) |

Zeros are rounded and reflect recovery under deliberately matched mathematical models, not physical accuracy. Nonlinear tone correction worsened a* error despite reducing overall Delta E76; the ramp maximum absolute a* error was 9.551. Neutral patches cannot identify this channel mixing, whose mean Delta E76 remains 6.785. In the clipping case the surviving neutral-corrected patches are not evidence of recovery of clipped samples; the ramp rejects the clipped reference set. Never compare error metrics without their coverage.

Local Node execution of copied repository source and tests: 8/8 passed, no skips. Exact GitHub CI remains to be verified. FV06 closeout automated run 45348340672 passed both jobs; physical restart is still open in its evidence record.

## Implications
Do not select a correction solely because the reference looks gray. Colored holdout patches and channel-specific error are necessary. Next use a physical matte reference with documented values, repeat captures, fixed geometry and lighting, and evaluate model mismatch on held-out patches. A paper sheet or screen-displayed chart is not a calibrated physical reference. Keep all results research-only and preserve the existing FV06 deployment.
