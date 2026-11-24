# FV07 — CHROMA / experiment 001

Status: offline research kickoff only. Based on FV06 candidate aa3b5db; FV06 exact-head CI and physical Safari restart were still open when this work began. Do not merge into main, modify the protected lab deployment, or present this as a skin measurement.

## Question
Can a known color reference reduce apparent visible-color variation under a controlled, explicitly modeled image perturbation?

## Reproduction
From the repository root:
- `node --test research/fv07/chroma.test.mjs`
- `node --input-type=module -e "import {experiment} from './research/fv07/chroma.mjs'; console.table(experiment().rows)"`

The module is outside the app source tree; no camera, storage, network, UI or production imports. The fixture uses normalized encoded sRGB, its standard transfer function, D65 XYZ and CIE L*a*b* conversion. Three arbitrary synthetic patches and one neutral patch are subjected to known diagonal gains in linear RGB. The neutral correction inverts those gains under the same idealized model. This is a numerical sanity check, not evidence that phone cameras are calibrated or that arbitrary illumination can be corrected with a single neutral target.

Initial in-memory execution of the implementation functions: nine fixture cases; the simulated channel-gain condition shifted a* by +8.553, +6.584 and +4.389 across patches; the uniform dimming condition shifted a* by −2.148, −1.911 and −1.131. Corrected error rounded to six decimals was zero in all nine cases by construction. Known reference-color and boundary checks passed in that execution. Repository Node test run remains to be verified. No participant data or raw FV06 diagnostic export is included.

## Next experiment
1. Run the committed Node tests and inspect exact-head FV06 CI before integrating anything.
2. Use a documented, matte neutral/color reference under stable diffuse light; a sheet of paper is not a calibrated standard. Record target provenance, expected values, camera and lighting conditions, clipping and repeat data. Use synthetic/non-face fixtures first.
3. Measure drift on multiple patches across lighting/device changes; compare uncorrected, simple neutral gain and other justified models against known references. Do not fit and evaluate on identical held-out patches or infer camera color space from unknown video metadata.
4. Quantify within-condition repeatability, reference error and failure/abstention. Unknown color management, missing reference, severe clipping or poor reference coverage must prevent calibrated claims.
5. Only after reference-target feasibility, explore anatomically stable cheek/forehead ROIs with explicit consent, diverse measured skin colors, and independent reference/holdout protocol per the FV06 handoff.

No consumer-facing score, diagnostic claim, inflammation inference or efficacy claim. FV06 geometry eligibility is not color eligibility. Any future optical contract changes require explicit versioning. No automatic deployment for this branch.
