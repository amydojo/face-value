# Human Butter × Evidence Machine integration contract

**Status:** Implemented and verified in PR #39

**Issue:** #38

**Baseline:** `8a494cc177b289e37cd8c5861591de2d252ba357`

**Verified head:** `7e078d83b5e55c6ccb71c7386f1237438296e41e`

## Objective

Move the stabilized Evidence Machine from the isolated `/evidence-machine` route into the real Human Butter production journey without creating a second source of durable trial truth.

The production slice is:

```text
Result
→ accept or override the next step
→ SAVE READY
→ press the amber SAVE RESULT actuator
→ commit the decision exactly once
→ manufacture and dispense the Evidence Record
→ collect the same artifact
→ open evidence detail
→ reopen the same record from Past Results
```

## Canonical decision

The Evidence Record is generated only after the person has accepted or deliberately overridden the next step.

The artifact contains the next step. Therefore `SAVE_RESULT` is the causal durable event that:

1. commits the chosen next step
2. creates or returns exactly one durable saved-result identifier
3. arms the release controller with that record
4. permits the physical dispensing sequence to begin

The machine does not generate a record merely because analysis exists.

## State ownership

### Durable application truth

The existing Human Butter reducer remains the only durable authority for:

- selected product
- assigned job
- baseline and follow-up scans
- comparison and confidence
- another-product context
- recommendation
- selected next step
- saved-result creation
- Past Results
- restoration and recovery

### Transient machine truth

The Evidence Machine locally owns only mechanical presentation phases:

- actuator pressed
- latch releasing
- door opening
- artifact edge emerging
- controlled feed
- alignment pause
- record presented
- record collecting

Transient mechanical phases are never persisted as a second trial model.

## Controlled adapter boundary

`humanButterMachineAdapter.ts` translates the durable application state into the machine contract and maps the existing durable record into the collectible artifact presentation.

The production machine receives real values from the Human Butter state, including:

- product identity
- assigned job
- analysis result
- confidence
- selected next step
- durable saved result

`EvidenceTrialState` is not mounted as a parallel app-wide store.

## SAVE_RESULT release contract

When the machine is save-ready:

1. the actuator acknowledges the press within one animation frame
2. duplicate activation is locked
3. the existing guarded `SAVE_RESULT` transition runs
4. the transition exposes one durable saved-result id
5. dispensing begins only after durable creation succeeds
6. the same id drives dispensed, collected, detailed, and archived presentations
7. refresh restores the stable presented artifact
8. no animation callback creates another record

## Action ownership

The stable ownership sequence is:

```text
page → machine → artifact → page
```

- **page:** choose or confirm the next step
- **machine:** press SAVE RESULT and wait during production
- **artifact:** collect the partially dispensed record
- **page:** view detail or return to Past Results

There is no competing page primary, machine actuator, and artifact action.

## Production replacement

The canonical root journey now uses:

```text
real result
→ real next-step decision
→ Evidence Machine actuator
→ record dispensing
→ explicit collection
→ same durable artifact
→ evidence detail / Past Results
```

It does not use demo-only product data, a fixture verdict in place of the current result, a parallel archive, a hard-coded record, a second production persistence key, or premature navigation before collection.

## Verification

GitHub Actions run `30224937000` passed on the verified head:

- lint
- strict TypeScript
- unit and component tests
- production build
- mobile WebKit end-to-end suite
- Playwright evidence upload

The production-root tests prove:

- real product, job, result, confidence, and next step continuity
- exactly one durable record id
- rapid double-press protection
- refresh during presentation
- explicit collection before navigation
- same-record detail and Past Results reopening
- reduced-motion production and collection
- no runtime or console errors

## Hosting note

Vercel created a Ready preview for the branch foundation. Exact-head preview requests after that were rejected by the external Hobby daily build-rate limit, not by an application build error. The exact final production bundle was built and retained by CI and exercised by the passing production-like WebKit suite.

## Follow-up scope

Not included:

- migration of earlier trial screens
- removal of the standalone machine regression route
- real YouCam integration
- visual-system refinement from #34
- authentication, cloud persistence, or server architecture
