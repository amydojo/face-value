# Face Value Product Contract

**Status:** Frozen product direction

**Version:** 1.1

**Effective date:** July 24, 2026

This document is the product authority for the Face Value experience. Figma, implementation, API integration, copy, demos, and submission materials must follow this contract unless the contract is deliberately amended.

## 1. Product definition

Face Value is a skincare product trial machine.

It helps a person test one skincare product against one explicit job, then uses repeat skin scans and context aware comparison to determine whether that product is earning its place.

### Core promise

> One product. One job. One honest verdict.

### Public hook

> Your shelf is full of claims. Put them on trial.

The public hook describes the human problem. It does not prescribe furniture as the interface metaphor.

### Human problem

People accumulate skincare products without a reliable way to tell which product is responsible for visible change, which product needs more time, and which product is merely occupying space in the routine.

### Desired outcome

The user leaves each completed check with one understandable verdict and one proportionate next action.

## 2. The visible product loop

The user should experience three mental moments.

### Trial

The user chooses one product and assigns it one job.

The interface answers:

> What are we testing?

### Check in

The user completes a comparable follow up scan and reports only context the system cannot observe.

The interface answers:

> What changed?

### Verdict

Face Value explains what the evidence supports and what the user should do next.

The interface answers:

> What should I do now?

The complete visible loop is:

> Trial → Check in → Verdict

Any additional system state must support this loop without becoming a separate mental burden for the user.

## 3. Golden path

The primary product journey must remain understandable as six moments.

1. **Start**

   Prompt: Which product are we putting on trial?

   Primary action: Open Evidence Index

2. **Assign one job**

   Prompt: What is this supposed to change?

   Supported MVP jobs include hydration, redness, texture, breakouts, and dark spots.

3. **Capture the starting point**

   Prompt: Take your starting scan

   Supporting instruction: Use the same lighting and angle when you check again.

4. **Active trial**

   The specimen is sealed in an active observation cassette. The user sees its accession identity, assigned job, evidence state, and next useful check date.

5. **Run the check**

   Prompt: Let us see if it is earning its place.

   After capture, ask only what may have interfered with the observation. Another product, irritation, inconsistent use, changed conditions, or other relevant context lowers attribution confidence without blaming the user.

6. **Reveal the verdict**

   Evidence Cassette V7 performs the ceremonial reveal. The user receives one verdict, one explanation, and one next action. The user commits an evidence disposition, then an independent Evidence Record emerges.

## 4. Verdict system

Face Value may return four primary user facing verdicts.

### Earning its place

Use when relevant skin signals improved under reasonably comparable conditions.

Default action: Keep using it

### Too early to tell

Use when the trial is incomplete, the interval is insufficient, or the signal is promising but not yet strong enough.

Default action: Continue the trial

### Evidence got messy

Use when overlap, inconsistent use, irritation, capture mismatch, or another disturbance prevents clean attribution.

Default action: Retry it alone

### Not proving its job

Use when the required observation window has passed and the relevant evidence does not support meaningful progress on the assigned job.

Default action: Release or pause it

The verdict must never exceed the confidence supported by the available evidence.

## 5. Product laws

### Law 1: One product receives one explicit job

Face Value does not evaluate whether a product is generally good. It evaluates whether the product appears to be performing the job the user assigned.

### Law 2: Complexity appears as confidence, not work

The system may contain sophisticated state, comparison, disturbance, and confidence logic. The user should experience that sophistication as a trustworthy result, not procedural homework.

### Law 3: One screen has one dominant action

Every primary screen should make the next step obvious. Competing primary actions are a product defect.

### Law 4: Evidence is scoped to the assigned job

The interface does not display a wall of unrelated skin scores. It surfaces only the signals needed to evaluate the selected job.

### Law 5: Disturbance lowers certainty rather than creating blame

Adding another product, inconsistent use, irritation, or mismatched capture conditions must reduce attribution confidence. These conditions must never be framed as user failure.

### Law 6: Face Value does not diagnose skin

Face Value evaluates product trial evidence. It does not diagnose disease, grade attractiveness, prescribe treatment, or claim medical clearance.

### Law 7: Evidence Cassette V7 is the container, not the explanation

The cassette system makes the trial tangible, memorable, and precise. It must never make the core task harder to understand.

The phone behaves as a personal evidence instrument, not a refrigerator, oven, furniture unit, deep room, or card carousel.

### Law 8: Completion produces a durable artifact

Evidence Records are produced as a consequence of a completed verdict and committed disposition. The record is mechanically independent from cassette motion.

### Law 9: Explain the car before the engine

Public communication begins with the human problem, magical action, and outcome. Technical architecture follows only after the user understands why the product matters.

## 6. User language and internal language

| Internal concept | User facing expression |
| --- | --- |
| Capture Contract | Match your first scan |
| Progress Mode | Here is what the trial found |
| Disturbance branch | Did anything interfere with this trial? |
| Placement state | Evidence disposition |
| Placement sealing | Commit disposition |
| Evidence Record generation | Evidence Record ready |
| Optical comparison confidence | How sure Face Value is |
| Longitudinal attribution | Is this product earning its place? |
| Persisted `cabinet` stage | Evidence Index |
| Persisted drawer events and index | Cassette selection |
| Persisted `cooling` placement | Outside the active observation window |

Internal names may remain in code when changing them creates unnecessary storage or migration risk. They must not appear in visible copy, accessibility labels, analytics attributes, current tests, or canonical presentation documentation.

## 7. What the system handles invisibly

The product may manage the following without making them separate user tasks:

* Capture quality and camera guidance
* Baseline and follow up comparability
* Relevant skin signal selection
* Analysis response normalization
* Trial timing
* Disturbance persistence
* Confidence limits
* Evidence disposition state
* Evidence Record creation
* Privacy cleanup and image deletion
* Reduced motion completion
* Accessibility announcements and focus behavior

## 8. YouCam integration contract

YouCam is the optical evidence provider. Face Value remains the product reasoning and interaction layer.

The integration must map each assigned job to a narrow set of relevant signals.

| Assigned job | Primary analysis signals |
| --- | --- |
| Improve hydration | Moisture and texture |
| Calm redness | Redness |
| Smooth texture | Texture and pores |
| Reduce breakouts | Acne and oiliness |
| Fade dark spots | Spots and radiance |

The user should not receive every available API score by default.

YouCam may observe visible skin signals. Face Value determines how those signals relate to the assigned product job, trial timing, disturbances, comparison confidence, and next action.

A YouCam result must never override a known disturbance or upgrade confidence beyond what the trial conditions support.

The application must provide clear consent, processing disclosure, failure recovery, and image lifecycle behavior before production use.

## 9. Signature product objects

### Evidence instrument

The instrument is the fixed consumer hardware frame. It contains one shallow optical bay, one specimen dock, persistent smart glass, mounted identity, one rigid cassette group, and an independent output slot.

### Evidence Cassette

A cassette is the indexed observation object for one product and one assigned job. It may be dormant, indexed, selected, sealed, active, disturbed, review due, presented, classified, or archived.

### Evidence Index

The Evidence Index is a status register for specimen cassettes. It is not a dashboard of generic cards and not a rack rendered with theatrical perspective.

### Verdict

The verdict is the primary payoff. Evidence Cassette V7 preserves handle press, latch release, cassette pop, mechanical pause, restrained micro tilt, settle, smart glass clear, specimen presentation, identity reveal, and confident reseal.

### Evidence Record

The Evidence Record is the durable, face free artifact produced after a verdict. It preserves the product, job, duration, result, confidence, disturbance context, and next action. It emerges from an output mechanism independent from the cassette.

## 10. Physical truth

The production hardware system always preserves:

1. One fixed enclosure.
2. One shallow optical bay.
3. One rigid cassette transform group.
4. One persistent glass layer.
5. One fixed specimen dock.
6. One mounted identity system.
7. One independent output slot.

The cassette may read as indexed, selected, sealed, released, presented, classified, or archived.

It must never read as pulled furniture, a hinged door, a filing unit, an oven tray, a floating card, or a deep architectural room.

## 11. Progressive disclosure

The default result should show:

1. The verdict.
2. A plain language explanation.
3. One next action.

The user may then open Why This Verdict to inspect relevant signal changes, comparison quality, trial duration, disturbances, confidence, privacy, and analysis notes.

Technical detail must remain available for trust without blocking comprehension.

## 12. Non goals for the MVP

The MVP is not:

* A general skin diagnosis tool
* A beauty score
* A full routine optimizer
* An ingredient compatibility database
* A product recommendation marketplace
* An ecommerce funnel
* A provider treatment clearance system
* A social before and after feed
* A dashboard containing every available skin metric
* A substitute for medical care

These boundaries protect the clarity and credibility of the product trial loop.

## 13. Demo contract

The canonical demo should follow one product investigation.

1. The user opens the Evidence Index.
2. The user selects one cassette and assigns one job.
3. The user captures a starting scan.
4. The specimen becomes an active observation cassette.
5. The user returns for a follow up scan.
6. Face Value reveals Earning its place through Evidence Cassette V7.
7. The user chooses Keep using it and commits the evidence disposition.
8. An independent Evidence Record emerges.
9. A brief alternate state shows that an overlapping cassette identity produces Evidence got messy rather than false certainty.

The demo must prove both the magical action and the trust boundary. It should not tour every screen or explain every internal state.

## 14. Acceptance test for future work

Before a new feature, screen, term, metric, or interaction is accepted, it must pass all of the following questions.

1. Does it help the user understand what is being tested, what changed, or what to do now?
2. Does it preserve one product, one job, and one honest verdict?
3. Can the system handle it invisibly instead?
4. Does it make the product easier to understand within five seconds?
5. Does it preserve uncertainty rather than manufacture certainty?
6. Does it strengthen the product trial machine rather than turn Face Value into a generic skincare platform?
7. Does it obey the Evidence Cassette V7 physical truth?

A no on questions 1, 2, 5, 6, or 7 blocks the change.

## 15. Change control

This contract is intentionally narrow.

Changes to the core promise, visible loop, verdict set, product laws, medical boundary, or production hardware grammar require an explicit update to this document in the same pull request as the affected design or implementation.

Implementation may evolve. The human problem remains outside the machine.
