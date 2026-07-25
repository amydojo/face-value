# Face Value

> **Your shelf is full of claims. Put them on trial.**

Face Value is a skincare product trial machine. A person gives one product one explicit job, completes repeat skin scans, and receives one honest result about whether that product is earning its place.

The visible product loop is:

> **Trial → Follow-up scan → Result → Next step**

The machine keeps the evidence precise. The interface makes the next move obvious.

## Product contract

`docs/product-contract.md` is the product authority for Face Value. The governing promise is:

> **One product. One job. One honest result.**

Future design, implementation, API integration, demo, and submission work must follow that contract or amend it explicitly in the same pull request.

## Human Butter production journey

Face Value exposes one public state-machine journey:

> **Welcome → Your trials → view trial → trial in progress → follow-up scan → automatic comparison → result → next step → saved result → Past results**

Every default screen contains one human headline, one meaningful trial object, one useful piece of context, one primary action, and at most one quiet alternative. Notes, technical state, destructive controls, and alternate classifications use progressive disclosure.

Primary user-facing language is:

- Your trials
- Trial in progress
- Note
- Follow-up scan
- Ready to compare
- Another product was used
- Result
- Next step
- Save result
- Saved result
- Past results

Internal reducer, type, persistence, and architecture names may remain more technical. Those names are not presentation or accessibility vocabulary.

Result actions map explicitly to next steps:

- `KEEP IT` → `established`
- `TEST LONGER` → `paused`
- `RETRY IT ALONE` → `retry_alone`

One `SAVE_RESULT` reducer event commits the chosen next step, performs the confident reseal, generates exactly one durable saved result, and opens it automatically. Repeated activation, back navigation, reload restoration, and Past results reopening do not create duplicates.

## Production hardware language

Evidence Cassette V7 remains the internal component and physical grammar. In the primary journey the person interacts with a product trial, not a database object.

The fixed physical truth is:

- one graphite enclosure
- one shallow optical bay
- one fixed specimen dock
- one live specimen and identity layer
- one dedicated persistent smart-glass overlay
- one structural bezel
- one rigid cassette transform group
- one mechanically independent saved-result output slot

The explicit handle always means: **show me what this trial currently contains.** A visible handle is always a semantic button with a real activation path. It owns tap, Enter, Space, Escape recovery, pointer and touch drag, thresholding, cancellation, and lost-capture recovery. Gesture ownership stays scoped to the handle, so page scrolling remains available everywhere else.

The V7 result sequence remains restrained and causal: latch release, pop toward the user, mechanical pause, micro-tilt, smart-glass clear, specimen presentation, identity reveal, and confident reseal. Reduced motion reaches the same semantic state without ceremonial delay.

See `docs/evidence-cassette-v7.md`, `docs/design-contract.md`, and `docs/production-journey-integration.md`.

## MVP scope

This repository implements one responsive, fixture-backed golden path. It includes finite trial selection, one job assignment, camera or file capture, a focused note editor, repeat comparison, both second-product branches, automatic analysis, confidence preservation, the V7 result reveal, recommended and overridden next steps, exactly-once saved-result generation, Past results browsing, deletion, restoration, and recovery.

The underlying domain model remains more detailed than the visible journey. Capture quality, comparison confidence, product overlap, placement state, privacy cleanup, accessibility, and reduced-motion behavior are system responsibilities rather than separate product promises.

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
- `npm run test:e2e`: run the Playwright mobile WebKit journey matrix.
- `npm run check`: run lint, typecheck, unit and component tests, and the production build.

Full validation:

```bash
npm run check
npx playwright install --with-deps webkit
npm run test:e2e
```

## Architecture

The application uses Vite, React, strict TypeScript, one pure reducer state machine, scoped CSS Modules, Vitest, React Testing Library, and Playwright. Domain state is independent from React. Browser capabilities are isolated behind adapters for camera, analysis, persistence, haptics, and clock behavior.

The reducer remains the single navigation, comparison, recovery, classification, persistence, and saved-result boundary. React may own temporary disclosure and editing state, but it does not invent scientific state, route around reducer transitions, or duplicate result and record state.

See `docs/product-contract.md`, `docs/architecture.md`, `docs/state-model.md`, `docs/camera-contract.md`, `docs/design-contract.md`, `docs/evidence-cassette-v7.md`, and `docs/production-journey-integration.md`.

## Mock analysis disclosure

`MockOpticalAnalysisAdapter` is the only analysis implementation in the current MVP. It returns deterministic fixture scenarios. No external analysis request runs, and no fixture result is represented as a production analysis API response.

A real YouCam adapter can implement the typed `AnalysisAdapter` boundary without replacing the domain state machine. The product contract limits visible analysis to signals relevant to the one job assigned to the product.

## Camera and privacy

The browser camera adapter prefers the user-facing camera with ideal 1920×1080 constraints, retries with a general video request when preferred constraints are overconstrained, normalizes browser errors, captures an unmirrored JPEG frame at approximately 0.92 quality, and always stops tracks. The live preview is mirrored with CSS only. File input remains available when camera APIs are unsupported or denied.

Raw face images remain in component memory only. They are not written to localStorage, sent to a server, included in saved results, or exposed in exported structured artifacts. Temporary object URLs are revoked after replacement, deletion, and unmount.

## Design source of truth

- Figma file: `https://www.figma.com/design/GKiVi4YJLm9WqozwAK3ThB`
- Evidence Cassette V7 family: node `368:3295`
- Final sealed result: node `342:2752`
- Final presented result: node `343:2578`

Production preserves the approved V7 graphite instrument, shallow bay, restrained geometry, mounted identity, persistent smart glass, one small orange evidence signal, and independent paper output. CSS perspective replaces Figma depth approximations where a real physical transition requires it.

## Current limitations

- Optical analysis is deterministic fixture data.
- Context conditions are user-confirmed rather than automatically detected.
- Mobile Safari behavior is covered by Playwright WebKit with a mobile Safari-like viewport, not claimed as verified on a physical iPhone.
- Persistence is local structured demo data only.
- There is no authentication, server processing, cloud storage, analytics, OCR, barcode scanning, ingredient database, ecommerce, medical assessment, or native packaging.
