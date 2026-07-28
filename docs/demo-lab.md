# Face Value Demo Lab

Issue: [#55](https://github.com/amydojo/face-value/issues/55)

The Demo Lab is a development-only internal route for opening real Face Value
screens from canonical typed fixtures. It is not a security boundary and is not
part of consumer navigation.

## Access

The `/demo` route renders only when both conditions are true:

- `import.meta.env.DEV`
- `VITE_SHOW_DEMO_CONTROLS=true`

Vite production builds set `import.meta.env.DEV` to `false`. The Demo Lab route,
storage keys, controls, synthetic-data banner, and copy are tree-shaken from
ordinary Vercel previews and production bundles. Do not weaken this gate to
make a Vercel preview expose the lab.

Local use:

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
- Current production saved-result route

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

## Deferred Evidence Record integration

The progressive-disclosure Evidence Record redesign is being developed
separately and is not present on the base branch. These typed integration
targets intentionally remain disconnected:

- Evidence Record summary
- Evidence Record reasoning expanded
- Evidence Record full technical record expanded

The Demo Lab can currently open the existing production saved-result route
through `evidenceRecordDemoAdapter.ts`. It does not import, duplicate,
special-case, or visually snapshot the legacy Evidence Record.

Required integration sequence:

1. Merge the Evidence Record redesign.
2. Update `agent/demo-lab` from the new `main`.
3. Connect the new presentation adapter and disclosure state through the
   existing typed Demo Lab launch boundary.
4. Re-run unit, architecture, privacy, build, browser, and visual checks.
5. Only then mark the Demo Lab pull request ready for review.

This branch will require a rebase or merge from `main` after the redesign
lands. The files most likely to need reconciliation are:

- `src/features/FaceValueApplication.tsx`
- `src/features/demo-lab/evidenceRecordDemoAdapter.ts`
- `src/features/demo-lab/demoFixtureState.ts`
- Evidence Record tests added by the redesign

The Demo Lab branch does not modify the current
`src/features/evidence-record/EvidenceRecord.tsx`.
