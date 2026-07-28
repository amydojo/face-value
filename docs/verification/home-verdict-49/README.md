# Home and verdict verification — issue #49

Captured in Playwright WebKit with the repository's iPhone device profile on July 28, 2026.

| Evidence | Viewport | What it verifies |
| --- | --- | --- |
| `01-home-latest-verdict-390.png` | 390 × 844 | Home hierarchy, diffused smoked-glass specimen, readable product/confidence, and explicit `VIEW TRIAL →` action |
| `02-home-narrow-320.png` | 320 × 700 | Narrowest supported Home width, smoked-glass readability, `RESULT` paper label, cassette fit, and zero horizontal overflow |
| `03-verdict-ready.png` | 390 × 844 | `VERDICT READY / The result is in.` |
| `04-revealing-result.png` | 390 × 844 | Restrained revealing state and factual progress copy |
| `05-evidence-recorded-done-spacing.png` | 430 × 932 | Quieter single `EVIDENCE RECORDED` status, result identity, 26px result-to-DONE pause, and 11px DONE-to-VIEW EVIDENCE gap |
| `06-previous-trials.png` | 430 × 932 | Compact graphite-and-paper Previous Trials case-file index, exact result continuity, and no deployed Demo controls |
| `07-home-reduced-motion.png` | 430 × 932 | Fully comprehensible smoked-glass `RESULT` latest-verdict Home with unchanged reduced-motion behavior |
| `08-saving-result-390.png` | 390 × 844 | `SAVING RESULT / Saving your result.` and one `RECORD STATUS / SAVING` firmware treatment |
| `09-result-ready-430.png` | 430 × 932 | Fully dispensed actionable paper with `RESULT READY / Take your evidence record.` |
| `10-home-paper-focused-390.png` | 390 × 844 | Full-paper keyboard target with a visible evidence-orange focus ring and explicit `VIEW TRIAL →` action |
| `11-previous-trials-narrow-320.png` | 320 × 700 | Narrowest archive width, compact pressable cards, deliberate wrapping, and zero horizontal overflow |

The final product-surface matrix covers 320, 390, and 430px; the broader Home matrix
also covers 375px and long product copy. This completion pass recaptured only the
affected Home, archive, collected, and reduced-motion evidence. Capture mode runs with
the deployed configuration (`import.meta.env.DEV === false`), so internal Demo controls
are neither rendered, focusable, nor announced. Reproduce these artifacts with:

```sh
CAPTURE_HOME_VERDICT_EVIDENCE=true npx playwright test e2e/home-verdict.spec.ts
```

Linux visual baselines will be refreshed from the final exact-head Ubuntu WebKit CI
render before the pull request leaves draft.
