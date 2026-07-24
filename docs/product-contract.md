# Face Value Product Contract

**Status:** Frozen product direction

**Version:** 1.0

**Effective date:** July 23, 2026

This document is the product authority for the Face Value experience. Figma, implementation, API integration, copy, demos, and submission materials must follow this contract unless the contract is deliberately amended.

## 1. Product definition

Face Value is a skincare product trial machine.

It helps a person test one skincare product against one explicit job, then uses repeat skin scans and context aware comparison to determine whether that product is earning its place.

### Core promise

> One product. One job. One honest verdict.

### Public hook

> Your shelf is full of claims. Put them on trial.

### Human problem

People accumulate skincare products without a reliable way to tell which product is responsible for visible change, which product needs more time, and which product is merely occupying shelf space.

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

   Primary action: Start a product trial

2. **Assign one job**

   Prompt: What is this supposed to change?

   Supported MVP jobs:

   * Improve hydration
   * Calm redness
   * Smooth texture
   * Reduce breakouts
   * Fade dark spots

3. **Capture the starting point**

   Prompt: Take your starting scan

   Supporting instruction: Use the same lighting and angle when you check again.

4. **Active trial**

   The product is placed in the Evidence Fridge and labeled On trial.

   The user sees the assigned job and the next useful check date.

5. **Run the check**

   Prompt: Let us see if it is earning its place.

   After capture, ask only:

   > Did anything interfere with this trial?

   MVP answers:

   * Nothing changed
   * I added another product
   * My skin was unusually irritated
   * I did not use it consistently
   * Something else changed

6. **Reveal the verdict**

   The user receives one verdict, one explanation, and one next action. An Evidence Record is generated automatically after the result.

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

Default action: Re shelve it

The verdict must never exceed the confidence supported by the available evidence.

## 5. Product laws

### Law 1: One product receives one explicit job

Face Value does not evaluate whether a product is generally good. It evaluates whether the product appears to be performing the job the user assigned.

### Law 2: Complexity appears as confidence, not work

The system may contain sophisticated state, comparison, disturbance, and confidence logic. The user should experience that sophistication as a trustworthy result, not as procedural homework.

### Law 3: One screen has one dominant action

Every primary screen should make the next step obvious. Competing primary actions are a product defect.

### Law 4: Evidence is scoped to the assigned job

The interface does not display a wall of unrelated skin scores. It surfaces only the signals needed to evaluate the selected job.

### Law 5: Disturbance lowers certainty rather than creating blame

Adding another product, inconsistent use, irritation, or mismatched capture conditions must reduce attribution confidence. These conditions must never be framed as user failure.

### Law 6: Face Value does not diagnose skin

Face Value evaluates product trial evidence. It does not diagnose disease, grade attractiveness, prescribe treatment, or claim medical clearance.

### Law 7: The Evidence Fridge is the container, not the explanation

The fridge metaphor makes the trial tangible, memorable, and delightful. It must never make the core task harder to understand.

### Law 8: Completion produces an artifact automatically

Evidence Records are generated as a consequence of completing a verdict. The user should not perform a separate record generation task.

### Law 9: Explain the car before the engine

Public communication begins with the human problem, magical action, and outcome. Technical architecture follows only after the user understands why the product matters.

## 6. User language and internal language

The following concepts remain valid engineering or design language but should not be required user vocabulary.

| Internal concept | User facing expression |
| --- | --- |
| Capture Contract | Match your first scan |
| Progress Mode | Here is what the trial found |
| Disturbance branch | Did anything interfere with this trial? |
| Placement sealing | Keep it or Re shelve it |
| Evidence Record generation | Automatic result artifact |
| Optical comparison confidence | How sure Face Value is |
| Longitudinal attribution | Is this product earning its place? |

Internal names may remain in code when they accurately describe domain behavior. Visible copy must follow the user facing expressions unless a stronger phrase is approved through product review.

## 7. What the system handles invisibly

The product may manage the following without making them separate user tasks:

* Capture quality and camera guidance
* Baseline and follow up comparability
* Relevant skin signal selection
* Analysis response normalization
* Trial timing
* Disturbance persistence
* Confidence limits
* Result generation
* Placement animation
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

### Evidence Fridge

The Evidence Fridge is the physical metaphor for products being actively tested, retained, retried, or removed. It should make the product feel like a small machine rather than a generic dashboard.

### On trial state

A product placed in the fridge displays its assigned job and next useful check date.

### Verdict

The verdict is the primary payoff. It must be understandable without opening technical details.

### Evidence Record

The Evidence Record is the durable, face free artifact produced after a verdict. It preserves the product, job, duration, result, confidence, disturbance context, and next action.

## 10. Progressive disclosure

The default result should show:

1. The verdict
2. A plain language explanation
3. One next action

The user may then open Why this verdict? to inspect:

* Relevant signal changes
* Comparison quality
* Trial duration
* Reported disturbances
* Confidence level
* Privacy and analysis notes

Technical detail must remain available for trust without blocking comprehension.

## 11. Non goals for the MVP

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

## 12. Demo contract

The canonical demo should follow one product investigation.

1. The user selects a hydration serum.
2. The user assigns Improve hydration.
3. The user captures a starting scan.
4. The serum enters the Evidence Fridge as On trial.
5. The user returns for a follow up scan.
6. Face Value reveals Earning its place.
7. The user chooses Keep using it.
8. An Evidence Record emerges automatically.
9. A brief alternate state shows that an overlapping product produces Evidence got messy rather than false certainty.

The demo must prove both the magical action and the trust boundary. It should not tour every screen or explain every internal state.

## 13. Acceptance test for future work

Before a new feature, screen, term, metric, or interaction is accepted, it must pass all of the following questions.

1. Does it help the user understand what is being tested, what changed, or what to do now?
2. Does it preserve one product, one job, and one honest verdict?
3. Can the system handle it invisibly instead?
4. Does it make the product easier to understand within five seconds?
5. Does it preserve uncertainty rather than manufacture certainty?
6. Does it strengthen the product trial machine rather than turn Face Value into a generic skincare platform?

A no on questions 1, 2, 5, or 6 blocks the change.

## 14. Change control

This contract is intentionally narrow.

Changes to the core promise, visible loop, verdict set, product laws, or medical boundary require an explicit update to this document in the same pull request as the affected design or implementation.

Implementation may evolve. The handle stays outside the machine.
