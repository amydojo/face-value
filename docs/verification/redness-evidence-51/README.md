# Canonical redness evidence verification

Issue: [#51](https://github.com/amydojo/face-value/issues/51)

These images are deterministic WebKit captures from the seven canonical
redness fixtures and the existing PR #50 result surface. They contain fixture
data only; no face image or raw provider payload is included.

## Captures

| File | State verified |
| --- | --- |
| `01-directional-test-longer.png` | Directional improvement → `test_longer` |
| `02-clear-improvement-keep.png` | Strong improvement → `keep` |
| `03-clean-null-not-proving.png` | Clean null → `not_proving_job` |
| `04-product-overlap-retry-alone.png` | Attribution blocker → `retry_alone` |
| `05-invalid-capture-unreadable.png` | Favorable delta with invalid capture → not-readable `test_longer` |
| `06-safety-interruption.png` | Worsening with symptoms → `safety_interruption` |
| `07-evidence-detail-provisional-metadata.png` | Audit detail, threshold source/version/hash, engine/API/model versions, limitations, and missing evidence |

Regenerate them with:

```sh
CAPTURE_REDNESS_EVIDENCE=true npx playwright test e2e/redness-evidence.spec.ts --project=mobile-webkit
```

## Verified command matrix

- `npm ci --no-audit --no-fund`
- `npm run lint`
- `npm run typecheck`
- strict standalone TypeScript check over `src/domain/evidence/redness/*.ts`
- `npm run test` — 16 files, 125 tests
- `npm run verify:redness-architecture` — 63 production source files
- `npm run build` — 84 modules
- `npm run verify:privacy` — 3 built files
- `PLAYWRIGHT_PORT=4176 npm run test:e2e` — 32 passed, 1 opt-in capture test skipped
- `git diff --check`

An additional live 390 × 844 browser pass covered baseline, elapsed trial,
follow-up, evaluation, reveal, collection, Home latest verdict, Previous
Trials, and reopening the saved result. It found zero horizontal overflow and
no console errors. The same persisted finding and canonical action appeared
throughout.

The threshold configuration shown here is intentionally provisional. The full
Redness Calibration Harness is not implemented in this change.
