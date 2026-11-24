# FV07 — CHROMA Lab / experiments 003–005

This localhost or explicitly protected-preview research workbench is isolated from the deployed Face Value app. No production merge, automatic deployment, cloud storage, or consumer redness score. FV06 automated checks passed at aa3b5db (45348340672); physical restart was subsequently confirmed by the owner and recorded on the FV06 branch.

## Run
1. Check out experiment/fv07-chroma. Use Node 22 and run npm ci.
2. For the color target experiment alone, run npm run dev -- --strictPort. Open http://127.0.0.1:4173/research/fv07/lab.html.
3. For facial mapping, first run npm run prepare:local-optics to prepare the pinned same-origin model/WASM assets.
4. Run node --test research/fv07/*.test.mjs. Browser smoke: npx playwright install chromium, then node research/fv07/lab-smoke.mjs (with port 4173 free).
5. Stop the server after use. Do not expose this workbench publicly. The separate preview build is permitted only for experiment/fv07-chroma in the authenticated Optics Lab project, never production.

## Experiment 003: color-reference calibration
The synthetic target has 7 fit patches (3 neutral levels, 4 chromatic patches) and 5 separately sampled holdout patches. Compare raw, one neutral gain, neutral ramp affine and multichannel affine. Holdout results report coverage, mean absolute a* error, max absolute a* error and mean Delta E76; no automatic winning-model selection. A degenerate fit or clipped patch cannot produce a corrected value. Full multichannel affine is solved from the fitting patches alone; matrix conditioning is only screened heuristically. The browser fixture uses 8-bit quantized values, so error is not exactly zero.
Physical targets require documented color reference values, illumination and capture geometry. The operator may edit normalized sample centers/radii in the manifest. Nonoverlapping sampling boxes and disjoint patch IDs are required. Reference provenance is user asserted, not verified. Color correction is not approved for skin based on this experiment.

## Experiment 004: candidate facial mapping
Use the existing pinned local MediaPipe loader and FV06 face geometry helper. Candidate image-left cheek, image-right cheek and forehead ellipses are anchored to eye corners, nose, upper forehead and chin in aspect-correct pixel coordinates. The pose gate, minimum eye distance, in-frame checks and clipping/opacity filter are exploratory. Candidate regions require manual review; this is not skin segmentation and does not automatically identify makeup, hair, shadows or occlusion. The preview pauses for capture/detection, but temporal alignment still needs verification. No images or landmarks are exported. Camera stops on page hide/visibility loss. Physical ROI placement and varied skin appearances must be evaluated before use.

## Experiment 005: regional measurements and repeatability
Camera-encoded a* is a research descriptor under the assumed sRGB interpretation, not calibrated visible redness. Each region may be recorded once per fresh manually reviewed capture. At least three captures per region and condition are necessary for descriptive mean, sample SD and range. Duplicate captures and unreviewed records abstain. No calibrated uncertainty or repeatability coefficient is asserted; no across-day treatment or skin-change inference. Reference-patch corrections are not applied to facial measurements yet because color eligibility and reference alignment are unverified.
Numeric exports include only research reports and controlled condition labels; session data is in memory and can be cleared. No persistent storage.

## Validation
Intermediate remote research runs 45350877065 and 45351046585 passed. The new browser smoke workflow exercises the synthetic target, all four correction methods, report export, empty-data abstention, clearing, and local-only requests. Exact final-head results must be inspected separately. Physical camera runs, model-based placement, reference target accuracy, device diversity and measurement uncertainty remain unverified.

## Experiment 006: integrated synthetic drift challenge
Run `node --input-type=module -e "import {integratedDrift} from './research/fv07/integrated-drift.mjs'; console.table(integratedDrift().drift)"`. The fixture combines three known conditions (identity, channel gain, nonlinear tone), three repeat captures each, three candidate regions and 12 independent color-reference patches. The underlying regional colors are fixed; only the simulated image pipeline and small quantization perturbations change. Compare within-condition SD against between-condition apparent a* shifts. This illustrates why repeatability alone cannot establish color validity. The integrated test expects 27 numeric observations and six between-condition comparisons, and keeps all outputs ineligible for skin measurement. Physical evidence is still required.

## Protected mobile candidate
A distinct preview-only build uses the research HTML entrypoint rather than the production app. Vercel project authentication must cover all deployments. Use the rear camera for the physical reference and front camera for candidate facial mapping; neither has yet been physically validated. Position patches by selecting their IDs and tapping the captured image, checking the overlaid ellipses against the actual matte target. The synthetic target is useful for software checks only. Record repeated reference frames separately; no calibration is applied to face data. The ordinary production build excludes the research HTML and its bundle. Keep the original FV06 deployment URL and its browser-local data unchanged.
