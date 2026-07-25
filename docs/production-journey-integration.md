# Human Butter production journey integration

## Canonical journey

The public application has one production route and one state-machine journey:

`welcome → Your trials → trial selection → trial in progress → follow-up scan → automatic comparison → result → next step → confident reseal → saved result → Past results`

The standalone fixture route remains removed. Production result data always comes from the selected specimen, assigned job, analysis result, comparison, confidence, product-overlap state, note, and captures already owned by `FaceValueState`.

A persisted `review_due` trial re-enters the reducer through `OPEN_REVIEW_DUE`. When a follow-up scan exists it resumes automatic analysis. When a comparable analysis result exists it resumes the V7 result. React does not reconstruct either state locally.

## Human Butter language boundary

The domain remains precise while the primary journey uses direct product language.

| Internal or detailed term | Primary journey |
| --- | --- |
| Evidence Index | Your trials |
| Evidence cassette | Product trial or trial |
| Active observation | Trial in progress |
| Lightweight trace | Note |
| Visible signal | What you noticed |
| Comparable follow-up | Follow-up scan |
| Review due | Ready to compare |
| Disturbance | Another product was used |
| Interference | Two products shared this trial |
| Lower-confidence overlap | The result will be less certain |
| Verdict | Result |
| Disposition | Next step |
| Commit disposition | Save result |
| Evidence archive | Past results |
| Evidence Record | Saved result or trial result |

Code, types, reducer events, persisted structures, architecture documentation, and detailed saved-result fields may retain technical names where they improve correctness. Default copy and accessible names do not require the person to understand those names.

## One-screen rule

Every default screen contains:

1. one human headline
2. one meaningful trial object
3. one useful piece of context
4. one primary action
5. at most one quiet alternative

Notes, raw technical state, destructive actions, explanatory detail, and alternate next-step classifications use accessible progressive disclosure. Read-only information is not boxed merely to look official.

## Shared trial-object modes

The reusable internal interaction contract remains:

```ts
type CassetteMode =
  | 'index'
  | 'active'
  | 'review-due'
  | 'verdict'
  | 'classified';
```

Mode changes content, status, accessible name, and destination. It does not change the physical grammar.

- `index`: view the selected trial.
- `active`: open or close the current trial summary.
- `review-due`: begin or restore result review through real reducer state.
- `verdict`: reveal or close the V7 result.
- `classified`: open the preserved saved result.

A visible handle always means: **show me what this trial currently contains.** A handle-shaped affordance is omitted when no meaningful action exists.

## Automatic comparison

A valid accepted follow-up scan enters `analysis`. `FaceValueApplication` observes that reducer state and invokes the existing `AnalysisAdapter` once for the accepted follow-up capture. The reducer receives `ANALYSIS_STARTED` and either `ANALYSIS_SUCCEEDED` or `ANALYSIS_FAILED`.

There is no production button for running comparison or entering result review. Development fixture controls remain development and test only.

## Result to next-step mapping

Result actions are mapped exhaustively by `placementForVerdict` before the next-step screen opens:

| Result action | Domain placement |
| --- | --- |
| `KEEP IT` | `established` |
| `TEST LONGER` | `paused` |
| `RETRY IT ALONE` | `retry_alone` |

A retained overlap always maps to `retry_alone`, even when an upstream adapter returns a stronger recommendation. Unknown recommendations throw an explicit error rather than silently defaulting.

The recommended next step is shown automatically. The full classification list remains hidden until the person chooses **Choose a different next step**.

## Save, reseal, and record boundary

One `SAVE_RESULT` activation performs one reducer-owned transaction:

1. preserve the recommended or overridden placement
2. mark the trial complete and classification sealed
3. generate the deterministic durable result
4. insert it into Past results only when its identifier is not already present
5. leave the placement screen in the classified state for the confident reseal
6. open that same saved result automatically

The saved result preserves product, specimen identifier, assigned job, finding, non-finding, confidence, comparison state, product-overlap context, note, baseline metadata, follow-up metadata, selected next step, claim boundary, timestamp, and `includesFaceImage: false`.

Repeated activation, back navigation, reload restoration, and Past results reopening do not create another record. Reduced motion performs the same semantic sequence without the ceremonial delay.

Legacy `SEAL_PLACEMENT` and `GENERATE_RECORD` events remain explicit compatibility paths for older persisted sessions and focused reducer recovery tests. Production UI does not expose them as separate mandatory actions.

## Gesture ownership

`CassetteHandle` is the only drag owner. It uses pointer capture on the explicit handle surface, rejects accidental movement below five pixels, activates only after a 28-pixel horizontal-dominant gesture, and cleans up on pointer up, cancellation, or lost capture.

The handle uses `touch-action: none`; surrounding surfaces retain normal page scrolling. Tap, Enter, and Space activate the same semantic action. Escape closes expanded content or returns through the existing reducer parent. No whole-card click target substitutes for the handle.

## Focus and disclosure

The note editor asks **What did you notice?** Opening it moves focus to the input. Saving or cancelling collapses the editor and restores focus to the Add note or Edit note trigger.

See why, Trial details, and Choose a different next step expose state with native disclosure semantics, contextual labels, and keyboard access. Nothing important relies on color alone.

## Smart-glass layering

The DOM order is:

`optical bay → live specimen and identity → dedicated smart-glass overlay → structural bezel`

Blur, tint, reflection, and clearing belong only to the smart-glass layer. Product identity remains live HTML text, full resolution, and free from inherited filters. In `presented` and reduced-motion states, the glass backdrop filter resolves to `none` and specimen identity resolves to full opacity.

## Safe-area and system chrome

The application shell owns top safe-area spacing through `env(safe-area-inset-top)`. `ScreenHeader` renders only the Face Value brand and screen code. It does not simulate time, signal, battery, browser, or operating-system chrome.

## Fixture policy

Deterministic analysis scenarios remain available only through the development and test fixture control. There is no public fixture result route and no production-like hardcoded result outside the state machine.

## Verification contract

CI runs dependency installation, lint, strict typecheck, unit and component tests, production build, Playwright WebKit installation, the existing E2E suite, and one deterministic complete mobile Human Butter journey.

The canonical test begins at `/` and proves:

- Your trials and trial selection
- handle-owned inspection and trial-summary disclosure
- focused note editing and focus return
- another-product consequence and both resolution paths
- automatic comparison after an accepted follow-up scan
- V7 closed and revealed result states
- explicit result-to-next-step mapping
- hidden-by-default classification override
- one SAVE RESULT boundary
- confident reseal and automatic saved-result opening
- exactly one Past results entry after repeated activation and reload
- tap, Enter, Space, pointer drag, cancellation, lost capture, Escape, and reduced motion
- handle drag does not scroll the page while outside surfaces remain scrollable
- no runtime or console errors

Playwright WebKit with a mobile Safari-like viewport is browser verification. It is not proof of testing on a physical iPhone.
