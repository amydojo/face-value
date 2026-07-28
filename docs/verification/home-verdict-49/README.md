# Home and verdict verification — issue #49

Captured in Playwright WebKit with the repository's iPhone device profile on July 27, 2026.

| Evidence | Viewport | What it verifies |
| --- | --- | --- |
| `01-home-latest-verdict-390.png` | 390 × 844 | Home hierarchy, canonical partially revealed cassette, latest verdict, primary action, Previous Trials row |
| `02-home-narrow-320.png` | 320 × 700 | Narrowest supported width, cassette fit, record clipping, action fit, zero horizontal overflow |
| `03-verdict-ready.png` | 390 × 844 | `VERDICT READY / The result is in.` |
| `04-revealing-result.png` | 390 × 844 | Restrained revealing state and factual progress copy |
| `05-evidence-recorded-done-spacing.png` | 430 × 932 | Recorded copy, result identity, 26px result-to-DONE pause, 11px DONE-to-VIEW EVIDENCE gap |
| `06-previous-trials.png` | 430 × 932 | Previous Trials destination and matching saved verdict |
| `07-home-reduced-motion.png` | 430 × 932 | Fully comprehensible latest-verdict home with reduced motion |

The automated mobile matrix also covers 320, 375, 390, and 430px widths with long product copy. Reproduce these artifacts with:

```sh
CAPTURE_HOME_VERDICT_EVIDENCE=true npx playwright test e2e/home-verdict.spec.ts
```

The `Demo controls` disclosure in the Previous Trials capture is enabled only by the Playwright fixture environment.
