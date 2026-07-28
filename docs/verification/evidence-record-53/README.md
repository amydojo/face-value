# Evidence Record progressive-disclosure verification

These ten browser captures document the Evidence Record states requested by issue #53:

1. Summary at 390 × 844
2. Summary at 320 × 568 with a long product name
3. “Why Face Value reached this result” expanded
4. “Full evidence record” expanded
5. Clear favorable result
6. No clear change
7. Retry alone
8. Safety interruption
9. Legacy result
10. Reduced-motion state

The captures are generated from persisted, immutable `RednessEvaluationSnapshot` fixtures with:

```sh
CAPTURE_EVIDENCE_RECORD=true npx playwright test e2e/evidence-record.spec.ts
```

The test also verifies the complete Previous Trials → saved result → disclosure → back → reopen
journey, exact snapshot stability across reload, mobile overflow, keyboard operation, accessible
names, and the absence of runtime, console, and 5xx errors.
