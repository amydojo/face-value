# Face Value

> **Your shelf is full of claims. Put them on trial.**

Face Value is a skincare product trial machine. A person gives one product one explicit job, completes repeat skin scans, and receives one honest verdict about whether that product is earning its place.

The visible product loop is:

> **Trial → Check in → Verdict**

The system preserves uncertainty, accounts for interference, and never grades the face or manufactures cause and effect certainty.

## Product contract

`docs/product-contract.md` is the product authority for Face Value. It freezes the human problem, core promise, visible loop, verdict system, user language, YouCam integration boundary, non goals, and acceptance test for future work.

The governing promise is:

> **One product. One job. One honest verdict.**

Future design, implementation, API integration, demo, and submission work must follow that contract or amend it explicitly in the same pull request.

## MVP scope

This repository implements one responsive, fixture backed golden path through the Evidence Fridge. The current application includes finite product browsing, one job assignment, camera or file capture, stable observation, repeat comparison, both second product interference branches, confidence preservation, verdict presentation, re shelving, visible placement motion, automatic Evidence Record generation, archive browsing, deletion, and return to the cabinet.

The underlying domain model remains more detailed than the visible user journey. Capture quality, comparison confidence, disturbance handling, placement state, privacy cleanup, accessibility, and reduced motion behavior are system responsibilities rather than separate product promises.

## Local setup

```bash
npm install
npm run dev
```

Scripts:

* `npm run dev`: start the mobile web app.
* `npm run lint`: run ESLint.
* `npm run typecheck`: run strict TypeScript project checks.
* `npm run test`: run unit and component tests.
* `npm run build`: typecheck and create the production bundle.
* `npm run test:e2e`: run the Playwright golden path matrix.
* `npm run check`: run lint, typecheck, unit and component tests, and the production build.

Full validation:

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

## Architecture

The application uses Vite, React, strict TypeScript, a pure reducer state machine, scoped CSS Modules, Vitest, React Testing Library, and Playwright. Domain state is independent from React. Browser capabilities are isolated behind adapters for camera, analysis, persistence, haptics, and clock behavior.

See `docs/product-contract.md`, `docs/architecture.md`, `docs/state-model.md`, `docs/camera-contract.md`, and `docs/design-contract.md`.

## Mock analysis disclosure

`MockOpticalAnalysisAdapter` is the only analysis implementation in the current MVP. It returns deterministic fixture scenarios and is visibly identified in the product as simulated optical comparison. No external analysis request runs, and no fixture result is represented as a production analysis API response.

A real YouCam adapter can implement the typed `AnalysisAdapter` boundary without replacing the domain state machine. The product contract limits visible analysis to the signals relevant to the one job assigned to the product.

## Camera and privacy

The browser camera adapter prefers the user facing camera with ideal 1920×1080 constraints, retries with a general video request when preferred constraints are overconstrained, normalizes browser errors, captures an unmirrored JPEG frame at approximately 0.92 quality, and always stops tracks. The live preview is mirrored with CSS only. File input remains available when camera APIs are unsupported or denied.

Raw face images remain in component memory only. They are not written to localStorage, sent to a server, included in Evidence Records, or exposed in exported structured artifacts. Temporary object URLs are revoked after replacement, deletion, and unmount.

## Design source of truth

* Figma file: `https://www.figma.com/design/GKiVi4YJLm9WqozwAK3ThB`
* Canonical flow: Figma node `120:798`
* Two products active: Figma node `120:980`
* Motion and engineering handoff: Figma node `90:77`
* Responsive validation: Figma node `137:1663`

The implementation uses the final Premium Drawer Cabinet system only: warm pale civic exterior, matte black enamel interior, restrained metal structure, one infrastructure orange signal, finite indexed drawers, conserved product specimens, Trace Rail, verdict experience, and pale Evidence Records.

The Evidence Fridge is the signature container for the trial. It is not the explanation of the product.

## Chaos Vault provenance

Camera behavior is a clean room adaptation of `amydojo/undone-tools/chaos-vault/departments/camera.html` and its demo behavior. The Face Value adaptation deliberately changes the preferred camera from environment facing to user facing and keeps everything downstream of image capture outside the donor boundary. Only the portable browser camera behavior survives. Donor scoring, branding, recommendations, and old analysis models are excluded.

## Current limitations

* Optical analysis is deterministic fixture data.
* Context conditions are user confirmed rather than automatically detected.
* Device camera behavior is covered by adapter tests and browser automation, not claimed as verified on physical devices.
* Persistence is local structured demo data only.
* There is no authentication, server processing, cloud storage, analytics, OCR, barcode scanning, ingredient database, ecommerce, medical assessment, or native packaging.
