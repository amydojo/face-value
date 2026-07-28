# Face Value Demo Lab

Issue: [#55](https://github.com/amydojo/face-value/issues/55)

The Demo Lab is a protected internal route for opening real Face Value screens
from canonical typed fixtures. It is not itself a security boundary and is not
part of consumer navigation.

## Access

### Protected production domain

The deployed `/demo` route is protected by the existing server-side YouCam
engineering session:

1. Open `/youcam-spike` on the same production domain and browser.
2. Exchange the protected engineering token for the existing signed session.
3. Open or bookmark `/demo`.

The server validates the short-lived `Secure`, `HttpOnly`, `SameSite=Strict`
cookie before it serves the application shell at `/demo`. The cookie is scoped
to the same origin so it can protect both the provider API and this route. An
unauthorized `/demo` request redirects to the ordinary consumer app. The raw
token is cleared after exchange and is not stored in browser storage or placed
in the client bundle.

The production bundle switch is not the security boundary. Vercel routes
`/demo` through the signed-session check before the Vite SPA fallback, and
normal consumer navigation contains no Demo Lab link.

The session lasts 30 minutes and is specific to the browser and device where it
was opened. Repeat the `/youcam-spike` exchange when it expires.

### Local development

Local development still requires both `import.meta.env.DEV` and
`VITE_SHOW_DEMO_CONTROLS=true`:

```sh
VITE_SHOW_DEMO_CONTROLS=true npm run dev
```

Then open `http://127.0.0.1:4173/demo`.

## State flow

```text
canonical redness fixture
→ typed PhaseBFaceValueState
→ one-shot preview seed or versioned demo envelope
→ existing hydration and persistence validation
→ production route
→ production component
```

Demo components do not contain evaluator logic or copies of Home, Previous
Trials, cassette, Evidence Recorded, or saved-result markup.

## Modes

### Preview state

- Uses a one-shot `sessionStorage` seed.
- Does not read, write, clear, or merge ordinary trial persistence.
- Removes the seed after the production app mounts.
- Returns to ordinary state on reload.

### Load demo journey

- Requires an explicit replacement confirmation.
- Uses a versioned envelope at `face-value:demo-lab:journey:v1`.
- Records `origin: face-value-demo-lab`.
- Serializes through the existing structured-state persistence adapter.
- Hydrates through the existing structured-state validator.
- Persists demo continuity without touching
  `face-value:structured-demo:v1`.
- Marks every injected saved record with `demoOriginated: true`.

`Clear demo data` removes the isolated demo envelope and one-shot preview seed
only. It does not remove ordinary saved trials.

## Supported starting points

- Trial pending
- Follow-up ready
- Verdict ready
- Evidence Recorded
- Home with saved result
- Previous Trials
- New trial
- Product registered
- Baseline ready
- Baseline locked
- Comparison processing
- Cassette revealed
- Evidence Record summary
- Evidence Record reasoning expanded
- Evidence Record full technical record expanded

`New trial` opens the production First Run empty-case projection.
`Baseline locked` remains the production completion screen with its `Done`
action. `Trial pending` opens `waiting_for_followup` with a registered product,
accepted baseline, no follow-up evidence, and `demoTimelineAdvanced: false`.
Its explicit fixture clock is anchored to the persisted baseline timestamp, so
the pending action and day count remain ineligible and byte-stable across
reloads regardless of wall-clock time. `Follow-up ready` uses the same
production loaded-machine geometry with the existing eligibility override and
real follow-up capture event.

## Canonical result fixtures

- Clear favorable change — fixture A — `keep`
- Early favorable change — fixture C — `test_longer`
- No clear change — fixture B — `not_proving_job`
- Product overlap — fixture D — `retry_alone`
- Invalid comparison — fixture G — `test_longer`
- Worsening — fixture E — `not_proving_job` with `check_required`
- Safety interruption — fixture F — `safety_interruption`

The UI cannot accept an arbitrary authored verdict.

## Camera boundary

Fixture launches are visibly labeled `SYNTHETIC DEMO DATA`. They contain
metadata and canonical snapshots, never image payloads, and do not claim to
come from a physical capture.

`Run real-camera journey` clears any one-shot preview seed and opens the
ordinary production route without injecting capture results. Existing ordinary
trial persistence remains intact.

## Evidence Record integration

The Demo Lab opens the merged production Evidence Record in three deterministic
presentation states:

- Summary with both disclosures collapsed
- Plain-language reasoning expanded
- Full evidence record and technical metadata expanded

All three states share the same canonical fixture construction and immutable
saved `RednessEvaluationSnapshot`. `evidenceRecordDemoAdapter.ts` maps the
selected starting point to the production component's initial disclosure state;
it does not build an `EvidenceRecordViewModel`, evaluate a score, or alter a
saved result.

Disclosure state remains separate from `demoFixtureState.ts`. The production
`EvidenceRecord` continues to construct its view model from the saved record
through `evidenceRecordViewModelFromRecord`.
