# Evidence Cassette V7 production journey integration

## Canonical journey

The public application has one production route and one state-machine journey:

`welcome → Evidence Index → cassette selection → active observation → follow-up comparison → verdict reveal → disposition → confident reseal → Evidence Record`

The standalone `/verdict` fixture route is removed. Production verdict data always comes from the selected specimen, assigned job, analysis result, comparison, confidence, and disturbance fields already owned by `FaceValueState`.

A persisted `review_due` cassette re-enters the reducer through `OPEN_REVIEW_DUE`. When a follow-up capture exists it resumes analysis. When a comparable analysis result exists it resumes the V7 verdict. React does not reconstruct either state locally.

## Shared cassette modes

The reusable interaction contract is:

```ts
type CassetteMode =
  | 'index'
  | 'active'
  | 'review-due'
  | 'verdict'
  | 'classified';
```

Mode changes content, status, accessible name, and destination. It does not change the physical grammar: the handle remains centered, horizontal intent is deliberate, the latch is authoritative, the cassette opens with restrained depth, and closure is confident.

- `index`: pull or tap opens the selected specimen.
- `active`: pull or tap exposes the current observation summary.
- `review-due`: pull or tap starts or restores comparison review.
- `verdict`: pull, tap, Enter, or Space runs the V7 reveal sequence.
- `classified`: pull or tap opens the committed Evidence Record.

## Verdict to disposition mapping

Verdict outcomes are mapped by the exhaustive `placementForVerdict` helper before the placement stage opens:

| Verdict action | Domain placement |
| --- | --- |
| `KEEP IT` | `established` |
| `TEST LONGER` | `paused` |
| `RETRY IT ALONE` | `retry_alone` |

A retained overlap always maps to `retry_alone`, even when an upstream adapter returns a stronger recommendation. Unknown recommendations are not silently defaulted.

## Gesture ownership

`CassetteHandle` is the only drag owner. It uses pointer capture on the explicit 60 by 44 pixel handle surface, rejects accidental movement below five pixels, activates only after a 28 pixel horizontal-dominant gesture, and cleans up on pointer up, cancellation, or lost capture.

The handle uses `touch-action: none`; surrounding surfaces retain normal page scrolling. Tap, Enter, and Space activate the same semantic action. Escape closes an expanded cassette or returns through the existing reducer parent without leaking to a second navigation handler.

## Smart-glass layering

The DOM order is:

`optical bay → live specimen and identity → dedicated smart-glass overlay → structural bezel`

Blur, tint, reflection, and clearing belong only to the smart-glass layer. Product identity remains live HTML text, full resolution, and free from inherited filters. At rest the glass may soften the view slightly without erasing identity. In `presented` and reduced-motion states, the glass backdrop filter resolves to `none` and specimen identity resolves to full opacity with no transform or filter.

## Safe-area and system chrome

The application shell owns top safe-area spacing through `env(safe-area-inset-top)`. `ScreenHeader` renders only the Face Value brand and accession or screen code. It does not simulate time, signal, battery, browser, or operating-system chrome.

## Record generation boundary

Disposition selection changes only placement. `SEAL_PLACEMENT` commits classification and performs the semantic reseal. `GENERATE_RECORD` is accepted only for a committed placement with an analysis result and assigned job.

The generated record preserves specimen, accession, product, job, comparison, finding, non-finding, confidence, disturbance, final placement, recommendation, claim boundary, timestamp, and the invariant `includesFaceImage: false`.

Record insertion is idempotent for the deterministic record identifier, preventing repeated activation from adding a duplicate archive entry.

## Fixture policy

Deterministic analysis scenarios remain available only through the development and test fixture control. There is no public fixture verdict route and no production-like hardcoded specimen or analysis object outside the state machine.

## Verification contract

The repository validation stack is lint, strict typecheck, 47 unit and component tests, production build, Playwright WebKit installation, and the complete mobile WebKit E2E suite. CI enforces the structured Vitest report and uploads both Vitest and Playwright evidence artifacts.

The canonical WebKit test must begin at `/`, never `/verdict`, and capture index, active, sealed verdict, presented verdict, classified/resealed, and Evidence Record states. It asserts fake system chrome is absent, the handle owns drag without scrolling the page, scrolling remains available elsewhere, identity is crisp, keyboard and reduced-motion paths work, disposition mapping is correct, and exactly one record is archived.

Playwright WebKit with an iPhone device profile is browser emulation. It is not proof of testing on a physical iPhone.
