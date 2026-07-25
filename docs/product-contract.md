# Face Value Product Contract

**Status:** Frozen product direction

**Version:** 1.2

**Effective date:** July 24, 2026

This document is the product authority for the Face Value experience. Figma, implementation, API integration, copy, demos, and submission materials must follow this contract unless it is deliberately amended in the same pull request.

## 1. Product definition

Face Value is a skincare product trial machine.

It helps a person test one skincare product against one explicit job, then uses repeat skin scans and context-aware comparison to determine whether that product is earning its place.

### Core promise

> One product. One job. One honest result.

### Public hook

> Your shelf is full of claims. Put them on trial.

### Human problem

People accumulate skincare products without a reliable way to tell which product is responsible for visible change, which product needs more time, and which product is merely occupying space in the routine.

### Desired outcome

The person leaves each completed trial with one understandable result, one proportionate next step, and one durable saved result.

## 2. Human Butter principle

> The machine keeps the evidence precise. The interface makes the next move obvious.

One screen asks one question. The trial object performs the transition. The page supplies only the consequence.

Every default screen contains:

1. one human headline
2. one meaningful product-trial object
3. one useful piece of context
4. one primary action
5. at most one quiet alternative

Everything else belongs in Details, an overflow or disclosure, a focused editor, the final saved result, or internal state.

## 3. Visible product loop

The person should experience four mental moments.

### Trial

Choose one product and give it one job.

> What are we testing?

### Follow-up scan

Return under similar conditions and report only context the system cannot observe.

> What changed?

### Result

Face Value explains what the comparison supports and what it does not support.

> What happened, and what does it mean?

### Next step

Accept the recommended action or deliberately override it.

> What should I do now?

The complete visible loop is:

> Trial → Follow-up scan → Result → Next step

Additional system state must support this loop without becoming procedural homework.

## 4. Canonical journey

The primary journey is:

`welcome → Your trials → view trial → trial in progress → add or edit note → follow-up scan → another-product decision when needed → automatic comparison → reveal result → accept recommended next step → Save result → confident reseal → saved result → Past results`

### Your trials

Prioritize the trial that needs attention. Show one prominent trial object, product name, readiness or day context, and one concise summary. The handle is the primary way to view the trial.

### Trial selection

Previous and next controls move between products. The handle inspects the selected trial. Do not duplicate inspection with a separate button or instruction paragraph.

### Trial in progress

Default content is:

- **Still observing.**
- the trial object
- one date or readiness sentence
- the current note when present
- **TAKE FOLLOW UP SCAN** when meaningful
- **Edit note** or **Add note** as the quiet action

Raw state, destructive actions, another-product controls, and technical details stay behind disclosure.

### Note editing

The focused editor asks **What did you notice?** Its primary action is **SAVE NOTE** and its quiet alternative is **Cancel**. The note collapses back to one readable line after saving.

### Another product used

Explain the consequence once:

> Hydrating Drops entered this trial.
>
> That makes it harder to know which product caused any change.

Primary action removes the second product. The quiet alternative retains both and accepts a less certain result. Technical attribution explanation is optional detail.

### Automatic comparison

Accepting a valid follow-up scan is the comparison request. Do not require separate production actions to run comparison or enter result review.

### Result

Evidence Cassette V7 performs the restrained reveal. The screen answers:

1. What happened?
2. What does it mean?
3. What should I do next?

The default action accepts the recommended next step. **See why** reveals confidence, context, and claim boundaries.

### Next step

The result action already determines the recommended classification. Show it automatically with one explanation and **SAVE RESULT**. The full classification list remains hidden until **Choose a different next step** is opened.

### Saved result

One **SAVE RESULT** activation commits classification, performs the confident reseal, generates exactly one durable result, and opens it automatically. The person is not asked to commit, generate, and open the same decision separately.

## 5. Result system

Face Value may return four primary result patterns.

### Earning its place

Use when relevant signals improved under reasonably comparable conditions.

Default action: **KEEP IT**

Domain placement: `established`

### Too early to tell

Use when the interval or signal is not strong enough.

Default action: **TEST LONGER**

Domain placement: `paused`

### Test it alone

Use when product overlap or another condition prevents clean attribution.

Default action: **RETRY IT ALONE**

Domain placement: `retry_alone`

### Not proving its job

Use when the relevant window has passed and the evidence does not support meaningful progress on the assigned job.

Default action: pause or release through an explicit next step.

A result must never exceed the confidence supported by the available evidence. Unknown result-to-placement mappings are explicit errors, never silent defaults.

## 6. Product laws

### Law 1: One product receives one explicit job

Face Value does not judge whether a product is generally good. It evaluates whether the product appears to be performing the assigned job.

### Law 2: Complexity appears as confidence, not work

The system may contain sophisticated comparison, overlap, and confidence logic. The person experiences that sophistication as a trustworthy result, not an evidence database to operate.

### Law 3: One screen has one dominant action

Competing primary actions are a product defect.

### Law 4: Evidence is scoped to the assigned job

Do not display a wall of unrelated skin scores.

### Law 5: Another product lowers certainty rather than creating blame

Overlap, inconsistent use, irritation, or mismatched capture conditions reduce attribution confidence. They are never framed as user failure.

### Law 6: Face Value does not diagnose skin

Face Value evaluates product-trial evidence. It does not diagnose disease, grade attractiveness, prescribe treatment, or claim medical clearance.

### Law 7: Evidence Cassette V7 is the container, not the explanation

The internal cassette system makes the trial tangible and precise. The primary journey speaks about the product trial, note, scan, result, and next step.

### Law 8: Completion produces one durable artifact

A completed result produces exactly one saved result as a consequence of **SAVE RESULT**. It preserves the decision and evidence context without storing a face image.

### Law 9: Explain the car before the engine

Public communication begins with the human problem, magical action, and outcome. Technical architecture follows only after the product is understood.

## 7. User language and internal language

| Internal or detailed concept | Primary user-facing expression |
| --- | --- |
| Evidence Index | Your trials |
| Evidence cassette | Product trial or trial |
| Active observation | Trial in progress |
| Lightweight trace | Note |
| Visible signal | What you noticed |
| Comparable follow-up | Follow-up scan |
| Review due | Ready to compare |
| Disturbance | Another product was used |
| Interference | Two products shared this trial |
| Lower-confidence overlap | The result will be less certain |
| Verdict | Result |
| Disposition | Next step |
| Commit disposition | Save result |
| Evidence archive | Past results |
| Evidence Record | Saved result or trial result |
| Optical comparison confidence | How sure Face Value is |
| Longitudinal attribution | Is this product earning its place? |

Technical names may remain in code, types, reducer events, persisted structures, architecture documentation, and detailed saved-result fields where changing them creates migration risk or reduces precision. They must not leak into default copy or accessible names.

The voice is direct, calm, intelligent, and evidence-first. It is not cute, chatty, sentimental, punitive, or generic wellness copy.

## 8. Progressive disclosure policy

Default screens do not expose every available state at equal weight.

Use progressive disclosure for:

- note editing
- trial details
- another-product explanation
- destructive actions
- raw observation, comparison, and confidence state
- result reasoning
- alternate next-step classification
- demo controls

A border communicates editable input, active selection, or focused interaction. Read-only information is not boxed merely to appear official.

## 9. Universal handle meaning

A visible handle always means:

> Show me what this trial currently contains.

Required destinations:

- Your trials → view selected trial
- trial selection → inspect selected trial
- trial in progress → open or close trial summary
- ready to compare → begin result review through real reducer state
- result → perform the V7 reveal
- saved result → open the preserved result

Every visible handle is a semantic button with a contextual name. It supports tap, pointer drag, touch, Enter, Space, cancellation, lost pointer capture, Escape where relevant, and reduced motion. The handle owns its gesture; page scrolling remains available outside it. Do not use whole-card click targets as a workaround. Do not render a handle-shaped affordance without a meaningful action.

## 10. Save and exactly-once contract

One `SAVE_RESULT` transaction preserves:

- selected product and specimen identity
- assigned job
- baseline and follow-up metadata
- note
- finding and non-finding
- confidence
- comparison state
- another-product context
- selected next step
- claim boundary
- timestamp
- Past results placement
- `includesFaceImage: false`

Repeated activation, back navigation, reload restoration, and Past results reopening must preserve exactly-once behavior.

## 11. What the system handles invisibly

- capture quality and camera guidance
- baseline and follow-up comparability
- relevant signal selection
- analysis normalization
- trial timing
- another-product persistence
- confidence limits
- result-to-next-step mapping
- classification and saved-result creation
- privacy cleanup and image deletion
- reduced-motion completion
- accessibility announcements and focus behavior

## 12. YouCam integration contract

YouCam is the optical evidence provider. Face Value remains the reasoning and interaction layer.

| Assigned job | Primary analysis signals |
| --- | --- |
| Improve hydration | Moisture and texture |
| Calm redness | Redness |
| Smooth texture | Texture and pores |
| Reduce breakouts | Acne and oiliness |
| Fade dark spots | Spots and radiance |

Do not show every available API score by default. A YouCam result must never override known product overlap or upgrade confidence beyond what trial conditions support. Production integration requires clear consent, processing disclosure, failure recovery, and image-lifecycle behavior.

## 13. Physical truth

The production hardware system always preserves:

1. one fixed enclosure
2. one shallow optical bay
3. one rigid transform group
4. one persistent smart-glass layer
5. one fixed specimen dock
6. one mounted identity system
7. one independent output slot

The result reveal preserves latch release, pop toward the user, mechanical pause, restrained micro-tilt, settle, smart-glass clear, specimen presentation, identity reveal, and confident reseal.

It must never read as pulled furniture, a hinged door, a filing unit, an oven tray, a floating card, a fake operating system, or a deep architectural room.

## 14. Accessibility contract

Maintain or improve:

- semantic buttons and contextual accessible names
- visible focus and stage focus transfer
- screen-reader announcements
- `aria-expanded` and `aria-controls`
- keyboard, tap, touch, and pointer access
- no drag-only interaction
- reduced-motion parity
- Escape and back recovery
- note-editor focus entry and return
- accessible result reasoning and next-step override
- no information that relies on color alone

## 15. Non-goals

The MVP is not:

- a general skin diagnosis tool
- a beauty score
- a full routine optimizer
- an ingredient compatibility database
- a product recommendation marketplace
- an ecommerce funnel
- a provider treatment-clearance system
- a social before-and-after feed
- a dashboard containing every available skin metric
- a substitute for medical care

## 16. Demo contract

The canonical demo proves one complete product investigation:

1. open Your trials
2. select one trial and assign one job
3. capture a baseline
4. add or edit a note
5. take a follow-up scan
6. resolve or retain another product when present
7. let comparison run automatically
8. reveal the result through the real handle
9. accept the recommended next step
10. save once
11. watch the confident reseal
12. open the saved result
13. reopen the same result from Past results

The demo proves the magical action and trust boundary. It does not tour every internal state.

## 17. Acceptance test for future work

Before a new feature, screen, term, metric, or interaction is accepted, ask:

1. Does it help the person understand what is being tested, what changed, or what to do now?
2. Does it preserve one product, one job, and one honest result?
3. Can the system handle it invisibly instead?
4. Does it make the product understandable within five seconds?
5. Does it preserve uncertainty rather than manufacture certainty?
6. Does it strengthen the product-trial machine rather than turn Face Value into a generic skincare platform?
7. Does it obey the V7 physical truth?
8. Does it maintain one primary action and universal handle meaning?
9. Does it preserve exactly-once saved-result behavior?

A no on questions 1, 2, 5, 6, 7, 8, or 9 blocks the change.

## 18. Change control

Changes to the core promise, visible loop, result set, product laws, medical boundary, Human Butter language boundary, or hardware grammar require an explicit update to this document in the same pull request as the affected design or implementation.

Implementation may evolve. The human problem remains outside the machine.
