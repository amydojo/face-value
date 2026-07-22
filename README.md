# Face Value

Face Value is a personal skincare evidence system. It helps a person determine whether a skincare product has earned a place in their routine without grading the face or manufacturing cause-and-effect certainty.

## MVP scope

This repository implements one responsive, fixture-backed golden path through the Evidence Fridge: finite drawer browsing, product job assignment, Capture Contract, camera or file capture, stable observation, Trace Rail, both second-product disturbance branches, simulated follow-up comparison, Progress Mode, re-shelving, visible placement sealing, Evidence Record generation, archive browsing, deletion, and return to the cabinet.

## Local setup

```bash
npm install
npm run dev
```

Scripts:

- `npm run dev`: start the mobile web app.
- `npm run lint`: run ESLint.
- `npm run typecheck`: run strict TypeScript project checks.
- `npm run test`: run unit and component tests.
- `npm run build`: typecheck and create the production bundle.
- `npm run test:e2e`: run the Playwright golden-path matrix.
- `npm run check`: run lint, typecheck, unit/component tests, and the production build.

Full validation:

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

## Architecture

The application uses Vite, React, strict TypeScript, a pure reducer state machine, scoped CSS Modules, Vitest, React Testing Library, and Playwright. Domain state is independent from React. Browser capabilities are isolated behind adapters for camera, analysis, persistence, haptics, and clock behavior.

See `docs/architecture.md`, `docs/state-model.md`, `docs/camera-contract.md`, and `docs/design-contract.md`.

## Mock-analysis disclosure

`MockOpticalAnalysisAdapter` is the only analysis implementation in this MVP. It returns deterministic fixture scenarios and is visibly identified in the product as simulated optical comparison. No external analysis request runs, and no fixture result is represented as a production analysis API response. A real adapter can later implement the typed `AnalysisAdapter` boundary without changing product UI or domain transitions.

## Camera and privacy

The browser-camera adapter prefers the user-facing camera with ideal 1920×1080 constraints, retries with a general video request when preferred constraints are overconstrained, normalizes browser errors, captures an unmirrored JPEG frame at approximately 0.92 quality, and always stops tracks. The live preview is mirrored with CSS only. File input remains available when camera APIs are unsupported or denied.

Raw face images remain in component memory only. They are not written to localStorage, sent to a server, included in Evidence Records, or exposed in exported structured artifacts. Temporary object URLs are revoked after replacement, deletion, and unmount.

## Design source of truth

- Figma file: `https://www.figma.com/design/GKiVi4YJLm9WqozwAK3ThB`
- Canonical flow: Figma node `120:798`
- Two products active: Figma node `120:980`
- Motion and engineering handoff: Figma node `90:77`
- Responsive validation: Figma node `137:1663`

The implementation uses the final Premium Drawer Cabinet system only: warm pale civic exterior, matte-black enamel interior, restrained metal structure, one infrastructure-orange signal, finite indexed drawers, conserved product specimens, Trace Rail, Progress Mode, and pale Evidence Records.

## Chaos Vault provenance

Camera behavior is a clean-room adaptation of `amydojo/undone-tools/chaos-vault/departments/camera.html` and its demo behavior. The Face Value adaptation deliberately changes the preferred camera from environment-facing to user-facing and keeps everything downstream of image capture outside the donor boundary. Only the portable browser camera behavior survives; donor scoring, branding, recommendations, and old analysis models are excluded.

## Current limitations

- Optical analysis is deterministic fixture data.
- Context conditions are user-confirmed rather than automatically detected.
- Device camera behavior is covered by adapter tests and browser automation, not claimed as verified on physical devices.
- Persistence is local structured demo data only.
- There is no authentication, server processing, cloud storage, analytics, OCR, barcode scanning, ingredient database, ecommerce, medical assessment, or native packaging.
