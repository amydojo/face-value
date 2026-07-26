# Evidence Machine signature release

This bundle replaces route-specific cassette truth with one production path built from:

- `EvidenceTrialState` for durable trial evidence
- `transitionTrial(state, event)` for every durable mutation
- `resolveMachineConfiguration(state)` for hardware state and action ownership
- `EvidenceMachine` for the one canonical chassis, actuator, door, glass, slot, and artifact stage
- `EvidenceRecordArtifact` for the same dispensed and collected object

## Stable action ownership

| Stable state | Owner | Primary behavior |
| --- | --- | --- |
| Landing | page | Start one product trial |
| Registration | page | Register the selected product |
| Job selection | page | Assign the selected job |
| Baseline required | machine | Start baseline capture |
| Capture contract / camera | page | Confirm conditions and record one frame |
| Baseline recorded | page | Begin the trial |
| Trial active | none | Wait for follow-up readiness |
| Follow-up required | machine | Start follow-up capture |
| Processing | none | Comparison runs with latch locked |
| Processing error | machine | Retry preserved processing |
| Verdict ready | machine | Release the Evidence Record |
| Record presented | artifact | Collect the physical object |
| Record collected | page | Open detail, save, share, archive, or choose disposition |

`assertSinglePrimaryAction` fails development and test contracts that expose competing machine, artifact, and page primaries.

## Release controller

Transient motion is not persisted. The controller uses:

1. `actuator-pressed`
2. `latch-releasing`
3. `record-dispensing`
4. `record-presented`
5. `record-collecting`
6. `record-collected`
7. `release-error`

The durable trial model stores only the generated record, presented state, collected state, and error recovery state.

The door remains closed during the immediate actuator response. It then translates toward the viewer before rotating from its upper hinge. The artifact begins behind the door in a dark physical slot, exposes its dark substrate edge first, feeds to 40%, pauses once for alignment, and stops at approximately 70% presentation.

## Recovery

- interrupted capture returns to the matching required scan state
- interrupted reveal without a record returns to `verdict-ready`
- generated but uncollected records restore as `record-presented`
- collected records restore as `record-collected`
- release errors preserve product, job, scans, verdict, and any already generated record
- processing retry and release retry are idempotent

Only durable evidence is stored under `face-value:evidence-machine:v2`. Raw image bytes and transient transforms are never persisted.

## Interaction audit

Production controls have one of four outcomes:

- mutate visible trial state
- open a visible capture or detail layer
- start visible asynchronous work
- remain explicitly disabled until prerequisites are met

The production router no longer mounts the legacy route-specific cassette flow. Existing legacy modules remain outside the production graph as migration fixtures until their historical tests are retired separately; they cannot create parallel runtime truth.

## Accessibility

- the actionable lower door is one native button
- the actuator is decorative within that button and hidden from assistive technology
- the presented artifact becomes one native collection button
- tap, Enter, Space, and a short upward drag collect the record
- live regions announce verdict readiness, record release, and collection
- detail is structured under Observed, Not established, Context, Confidence, and Next step
- reduced motion keeps the causal states while removing the alignment pause and compressing timings
