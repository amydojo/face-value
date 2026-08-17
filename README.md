# Face Value

> Your shelf is full of claims. Put them on trial.

Face Value is a longitudinal skincare trial system that uses YouCam Skin Analysis to compare baseline and follow-up visible-redness evidence, then produces an evidence-bounded recommendation about whether a product is earning its place. The current hackathon protocol is intentionally narrow: one product, one job, visible redness, with deterministic evaluation and explicit evidence limits.

## Judge Quick Start

### Try the hosted project

**Production:** https://face-value-seven.vercel.app

Face Value is designed mobile-first. For the intended experience, use a phone or a mobile-sized browser viewport.

### Recommended judge walkthrough

1. Register one skincare product.
2. Assign **Reduce visible redness** as its job.
3. Capture and inspect the baseline behavior.
4. Continue through the eligible follow-up flow.
5. Inspect the verdict and recommendation.
6. Open the **Evidence Record**.
7. Open the **Technical Record** for the underlying measurement and evaluation details.

The ordinary production journey preserves the trial's real follow-up eligibility rules. Face Value also contains a protected **Demo Lab** for zero-credit inspection of later journey states. Demo Lab fixtures are synthetic, visibly labeled as synthetic, and never represent genuine provider-backed evidence. The deployed `/demo` route requires the protected engineering session; local Demo Lab controls require `VITE_SHOW_DEMO_CONTROLS=true`.

## YouCam Integration

Face Value integrates **YouCam Skin Analysis v2.1** through server-side routes.

For each ordinary baseline and follow-up period, the current acquisition flow collects **three distinct decoded frames and three independent YouCam analyses**. Each accepted frame is uploaded and analyzed independently. The primary optical signal for the visible-redness protocol is `hd_redness.raw_score`.

YouCam supplies the skin measurement. Face Value owns the longitudinal trial state, frozen comparison protocol, comparability checks, deterministic evaluation, saved result, and Evidence Record.

**YouCam measures the skin. Face Value judges the trial.**

No provider score is presented as a diagnosis or as proof of clinical product efficacy.

## How Face Value Works

```text
product registration
→ baseline
→ trial period
→ follow-up
→ comparability / deterministic evaluation
→ verdict
→ Evidence Record
```

The production capture surface uses `NativeBrowserCameraAdapter`. Saved results appear under **Previous Trials**.

## Local Setup

The repository uses npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`npm run dev` starts the Vite frontend at `http://127.0.0.1:4173`.

Environment variables are documented in [`.env.example`](.env.example):

- `YOUCAM_API_KEY`: server-only YouCam bearer credential. A genuine provider-backed run requires a valid value.
- `YOUCAM_SPIKE_TOKEN`: protected engineering token used to establish the signed server session required by the current YouCam provider routes and protected Demo Lab.
- `VITE_SHOW_DEMO_CONTROLS`: optional local-only switch for synthetic Demo Lab controls.
- `VITE_CAMERA_KIT_MODE`: guided-capture compatibility selector. Production resolves to the first-party native browser camera path; the external Camera Kit renderer is diagnostic only.

Do not place real credentials in the README or commit local environment files. The repository ignores `.env` and `.env*` files.

The YouCam endpoints are Vercel serverless routes. `npm run dev` runs the Vite frontend; a genuine provider-backed local run also needs a Vercel-compatible serverless runtime with the server environment variables configured.

### Local synthetic Demo Lab

```bash
VITE_SHOW_DEMO_CONTROLS=true npm run dev
```

Then open `http://127.0.0.1:4173/demo`. Synthetic states are for product and evidence-flow inspection only; they do not spend provider credits and do not claim physical capture provenance.

## Validation

These commands exist in `package.json`:

```bash
npm run check
npm run test:e2e
```

`npm run check` runs linting, strict TypeScript, unit/component tests, redness-architecture verification, documentation verification, the production build, and the client privacy scan. End-to-end coverage uses Playwright; CI installs WebKit before `npm run test:e2e`.

Useful focused commands include:

```bash
npm run lint
npm run typecheck
npm run test
npm run verify:redness-architecture
npm run verify:docs
npm run build
npm run verify:privacy
```

## Privacy

- Raw face images are temporary and memory-only during acquisition and provider transfer.
- Raw face images are not persisted in saved trials, Previous Trials, or Evidence Records.
- Durable evidence excludes image bytes, signed upload URLs, provider task identifiers, authorization headers, and raw provider payloads.
- `YOUCAM_API_KEY` remains server-side.
- The protected engineering token is exchanged for a short-lived signed `Secure`, `HttpOnly`, `SameSite=Strict` cookie; it is not consumer authentication.

## Limitations

- The current hackathon protocol focuses on visible redness.
- The production 5 / 10 raw-score operating boundaries remain provisional Face Value thresholds, not clinical significance thresholds.
- Cross-session pose, registration, segmentation, crop, face-size, color-cast, and skin-tone properties are not currently measured as comparison-quality signals.
- Face Value is not diagnostic.
- Face Value does not establish clinical product efficacy.

## Architecture and deeper documentation

Start with the canonical repository docs rather than treating README history as implementation authority:

- [Documentation authority index](docs/README.md)
- [Product contract](docs/product-contract.md)
- [Architecture](docs/architecture.md)
- [State model](docs/state-model.md)
- [Camera contract](docs/camera-contract.md)
- [Redness evidence engine](docs/redness-evidence-engine-v1.md)
- [Demo Lab](docs/demo-lab.md)
- [Source-of-truth manifest](docs/source-of-truth-manifest.md)

For traceability, the evidence-engine lineage is **#63 → #64 → #65**; issue #65 was implemented from base `f95b051f6c562919c23da0d08728fff124d27d48`. A historical `CreditInsufficiency` provider-quota incident remains documented in the calibration evidence record; it is not represented here as a current judge-path requirement.

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE).
