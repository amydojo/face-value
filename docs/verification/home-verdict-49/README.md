# Home and verdict verification — issue #49

Captured in Playwright WebKit with the repository's iPhone device profile on July 28, 2026.

| Evidence | Viewport | What it verifies |
| --- | --- | --- |
| `01-home-latest-verdict-390.png` | 390 × 844 | Home hierarchy and canonical partially revealed record labeled `RESULT` |
| `02-home-narrow-320.png` | 320 × 700 | Narrowest supported width, `RESULT` paper label, cassette fit, and zero horizontal overflow |
| `03-verdict-ready.png` | 390 × 844 | `VERDICT READY / The result is in.` |
| `04-revealing-result.png` | 390 × 844 | Restrained revealing state and factual progress copy |
| `05-evidence-recorded-done-spacing.png` | 430 × 932 | One `EVIDENCE RECORDED` heading, result identity, 26px result-to-DONE pause, 11px DONE-to-VIEW EVIDENCE gap |
| `06-previous-trials.png` | 430 × 932 | Previous Trials destination and matching saved verdict |
| `07-home-reduced-motion.png` | 430 × 932 | Fully comprehensible `RESULT` latest-verdict home with reduced motion |
| `08-saving-result-390.png` | 390 × 844 | `SAVING RESULT / Saving your result.` and one `RECORD STATUS / SAVING` firmware treatment |
| `09-result-ready-430.png` | 430 × 932 | Fully dispensed actionable paper with `RESULT READY / Take your evidence record.` |

The copy-state mobile matrix covers 320, 390, and 430px; the broader home matrix also
covers 375px and long product copy. This completion pass recaptured only the affected
home, collected, reduced-motion, saving, and result-ready evidence. Reproduce these
artifacts with:

```sh
CAPTURE_HOME_VERDICT_EVIDENCE=true npx playwright test e2e/home-verdict.spec.ts
```

Linux visual baselines were captured from the actual Ubuntu WebKit render in
[CI run 30337940189](https://github.com/amydojo/face-value/actions/runs/30337940189).

The `Demo controls` disclosure in the Previous Trials capture is enabled only by the Playwright fixture environment.
