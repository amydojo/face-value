# Human Butter × Evidence Machine integration contract

**Status:** Active implementation contract

**Issue:** #38

**Baseline:** `8a494cc177b289e37cd8c5861591de2d252ba357`

## Objective

Move the stabilized Evidence Machine from the isolated `/evidence-machine` route into the real Human Butter production journey without creating a second source of durable trial truth.

The immediate production slice is:

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

The Evidence Machine may locally own only mechanical presentation phases such as:

- actuator pressed
- latch releasing
- door opening
- artifact edge emerging
- controlled feed
- alignment pause
- record presented
- record collecting

Transient mechanical phases are never persisted as a second trial model.

## Required adapter boundary

Production integration must use an explicit controlled boundary equivalent to:

```ts
deriveEvidenceMachineState(appState)
resolveEvidenceMachineAction(appState)
dispatchEvidenceMachineAction(action)
```

The production machine receives real values from `FaceValueApplication`, including:

- product identity
- assigned job
- analysis result
- confidence
- selected next step
- durable saved result

Do not mount `EvidenceTrialState` as a parallel app-wide store.

## SAVE_RESULT release contract

When the machine is save-ready:

1. the actuator acknowledges the press within one animation frame
2. duplicate activation is locked
3. the existing guarded `SAVE_RESULT` transition runs
4. the transition returns or exposes one durable saved-result id
5. dispensing begins only after durable creation succeeds
6. the same id drives dispensed, collected, detailed, and archived presentations
7. failure restores save-ready with the user decision preserved
8. no animation callback may create another record

## Action ownership

The stable ownership sequence is:

```text
page → machine → artifact → page
```

- **page:** choose or confirm the next step
- **machine:** press SAVE RESULT and wait during production
- **artifact:** collect the partially dispensed record
- **page:** view detail, share/save where supported, or return to Past Results

There may never be a page primary, machine actuator, and artifact action competing simultaneously.

## Production replacement boundary

Replace the old terminal flow with:

```text
real result
→ real next-step decision
→ Evidence Machine actuator
→ record dispensing
→ explicit collection
→ same durable artifact
→ evidence detail / Past Results
```

The canonical root journey may not use:

- demo-only Hydrating Drops data
- a fixture verdict in place of the current analysis result
- a parallel archive state
- a hard-coded Evidence Record
- a second persistence key for the production journey
- premature route navigation before collection

## Required production-root test

Add one mobile WebKit path through the real application root:

```text
open Your trials
→ select the fixture trial
→ reach the real result
→ accept the recommended next step
→ press SAVE RESULT on the machine
→ observe one record dispense
→ collect it
→ open evidence detail
→ return to Past Results
→ reopen the same record
```

The test must prove:

- product, job, result, confidence, and next step remain consistent
- no route change occurs before collection
- exactly one record id exists
- rapid double press creates no duplicate
- refresh during presentation restores the presented artifact
- browser back preserves the collected state
- reduced motion preserves production and collection
- the old static saved-result path is no longer reachable in the canonical journey

## Scope

### In scope

- Result through Past Results production integration
- controlled machine adapter
- exactly-once save and release contract
- production-root tests
- documentation updates required by the product contract

### Out of scope

- migration of earlier trial screens
- real YouCam integration
- visual-system refinement from #34
- new chassis or motion concepts
- authentication, cloud persistence, or server architecture

## Completion gate

This integration is complete only when:

- the real Human Butter result and next-step decision feed the canonical machine
- `SAVE_RESULT` creates one durable record before dispensing begins
- the dispensed, collected, detailed, and archived object share one record id
- the Human Butter reducer remains the only durable application truth
- production-root mobile WebKit tests pass
- exact-head CI passes
- an exact-head Vercel preview reaches Ready
