# Face Value Product Contract

**Status:** Current product authority  
**Version:** 2.1

**Effective date:** July 31, 2026

**Implementation base:** `main` at merged PR #67
(`330f51975f162a2c15784114d7a448492973fcad`)

**Current change:** issue #63

This document governs the current Face Value product experience. Product, API, scientific, design, demo, and submission changes must follow it or amend it explicitly in the same pull request.

Issue #63 is implemented by this change. Issues #64 and #65 remain future
work.

## 1. Product definition

Face Value is a longitudinal skincare product trial machine.

It helps a person test one registered product against one explicit job, preserve a comparable baseline and follow-up, and receive one evidence-bounded result about whether the product is earning its place.

### Core promise

> **One product. One job. One honest result.**

### Public hook

> **Your shelf is full of claims. Put them on trial.**

### Current supported job

> **Reduce visible redness**

No other skin concern is currently supported by the production evaluator. Hydration, acne, texture, pores, oiliness, radiance, spots, skin age, attractiveness, or a universal skin score may not be presented as current Face Value result domains.

## 2. Human problem

People spend weeks using skincare products while normal skin fluctuation, capture variation, inconsistent use, irritation, and competing routine changes make the result difficult to interpret.

Face Value does not solve this by producing more scores. It structures one product trial, preserves uncertainty, and refuses claims the collected evidence did not earn.

## 3. Product principle

> **The machine keeps the evidence precise. The interface makes the next move obvious.**

One screen has one dominant purpose. Technical complexity appears as trustworthy boundaries, not as homework or a wall of metrics.

Every default screen should contain:

1. one clear state or question
2. one meaningful trial object or acquisition field
3. one useful piece of context
4. one primary action
5. at most one quiet alternative

Technical provenance, raw arrays, rule traces, alternate actions, destructive controls, and internal tools use progressive disclosure.

## 4. Current journeys

### First trial

```text
welcome / empty instrument
→ product registration
→ specimen identity preview
→ register and load
→ assigned job confirmed
→ guided baseline capture
→ optional baseline capture context
→ baseline locked
→ trial pending
```

The first-time journey does not force a new person through an empty archive or generic dashboard before registration.

### Returning trial

```text
Home
→ trial pending or follow-up ready
→ guided follow-up capture
→ optional follow-up capture context
→ deterministic comparison
→ sealed Oracle result
→ reveal
→ accept or deliberately change the recommended next step
→ explicit Evidence Record collection
→ Home / Previous Trials
```

### Current Home

Home has two broad states:

- active trial continuity: specimen, timeline, follow-up status, and Previous Trials
- no active trial: latest verdict when available, Start a new trial, and Previous Trials

The archive label is **Previous Trials**. Older internal and historical docs may contain `Past Results`; that is not current default product vocabulary.

## 5. Capture contract

The current production camera is the visible first-party browser video surface.

The person experiences:

```text
Searching
→ Aligning
→ Locking
→ Scanning
→ Scan complete
→ active three-measurement analysis
→ Measurements confirmed
```

Face Value currently evaluates whole-frame exposure and movement locally. It does not claim native facial landmark detection, pose measurement, skin-tone classification, disease detection, or facial-region registration.

**Scan complete / You can relax.** remains readable for at least 1.8 seconds
even when analysis advances in the background. Ordinary analysis keeps
**Analyzing your scan / Checking three measurements for consistency.** stable,
and every visible position is bounded by genuine accepted work. The sparse
amber activity field is a decorative system cue, not a measured facial map.

The external Perfect Corp Camera Kit renderer is a development diagnostic harness only. It is not the production acquisition surface.

Raw image bytes remain memory-only and are discarded after analysis or cancellation.

## 6. Evidence contract

### Deciding signal

Only YouCam Skin Analysis v2.1 `hd_redness.raw_score` may decide whether the assigned redness job moved favorably.

Higher raw scores represent a more favorable or less severe visible-redness condition. They are not an amount of redness and are not a percentage.

### Current evidence volume

An ordinary trial stores:

- one complete baseline burst with exactly three accepted raw-score observations
- one complete follow-up burst with exactly three accepted raw-score observations
- a unique frame identifier and normalized durable signal for each accepted observation
- face-free capture-gate evidence for each accepted observation
- face-free rejected-attempt evidence, when applicable
- the provider attempt count for each accepted observation
- one frozen protocol
- optional capture context
- one immutable redness evaluation snapshot after comparison

Each period allows at most five capture attempts. The three accepted frames must
be distinct decoded frames from one camera session, pass the available exposure
and movement gates, and receive independent provider requests. One failed
provider request is retried once on the same frame; a second failure fails the
whole burst. Provider requests are sequential.

The reducer commits a period atomically only after three valid analyzed
observations exist. The canonical evaluator receives the actual accepted arrays
and rejected-frame evidence and exclusively calculates medians, direction
agreement, delta, evidence quality, and result. A median is never stored as a
synthetic provider signal.

The system must name missing evidence rather than fabricate adherence,
tolerance, patient anchors, masks, registration, segmentation, cross-session
pose, crop, face-size, color-cast, skin-tone, or provider model metadata.

### Current operating boundaries

- detectable boundary: 5 raw-score points
- strong boundary: 10 raw-score points
- source: `provisional_fixture`
- provisional: `true`

These are Face Value prototype operating boundaries. They are not clinical significance thresholds and do not prove product efficacy.

Every current provisional result preserves the limitation that production thresholds require repeat-scan calibration.

## 7. Result system

The canonical evaluator preserves independent dimensions:

- effect classification
- measurement quality
- attribution quality
- evidence quality
- safety status
- recommended action

The current action set is exactly:

| Canonical action      | Product meaning                                                      |
| --------------------- | -------------------------------------------------------------------- |
| `keep`                | the evidence supports continuing the product for the assigned job    |
| `test_longer`         | the trial needs more time or stronger evidence                       |
| `retry_alone`         | another product or major change blocks clean attribution             |
| `not_proving_job`     | the completed trial does not support the assigned job                |
| `safety_interruption` | reported or objective safety evidence interrupts ordinary evaluation |

The deciding raw-score result cannot be rescued by unrelated skin metrics. A favorable raw-score movement cannot override an attribution blocker or safety interruption.

## 8. Oracle completion contract

The result remains sealed until the person activates the reveal. Finding,
score, delta, confidence, evidence status, recommendation, next step, and
limitations remain unavailable before reveal. The registered product identity
was already known and stays visibly loaded, labeled, and locked without
exposing any result field.

The Oracle uses one mounted machine and one pure mechanical reducer:

```text
sealed
→ opening
→ transmitting
→ verdict_revealed
→ committing
→ dispensing
→ collected
→ done
```

Reveal and motion do not create scientific state. The active Oracle specimen
uses the complete canonical registered product identity, including strength
and volume when present, and remains the same `IdentityLockSpecimen` through
sealed, reveal, saving, dispensing, and collection.

A recommendation is accepted or deliberately changed before collection. The durable Evidence Record is created exactly once at the reducer-owned collection boundary. Only `ORACLE_DONE` returns to Home.

The retired product description of a separate mandatory next-step screen followed by `SAVE RESULT` is historical. Legacy event names may remain for persisted-state compatibility, but they are not the current visible completion contract.

## 9. Evidence Record

A completed Evidence Record preserves, where available:

- registered product ID, accession, brand, product name, strength, and volume
- assigned job
- baseline and follow-up timestamps and face-free metadata
- normalized raw scores and delta
- threshold source, version, provisional status, and configuration hash
- effect, measurement, attribution, evidence, safety, and action fields
- missing evidence and limitations
- rule identifiers and audit trace
- selected next step
- `includesFaceImage: false`

Canonical records render product and result from their saved immutable
snapshot. Home, Previous Trials, detail, and reload do not substitute active,
demo, verdict-copy, or generic product identity and do not re-evaluate the
result under future engine upgrades.

Legacy records remain readable without being upgraded as though they contained evidence that was never collected.

## 10. Claim boundaries

Allowed current descriptions include:

- longitudinal skincare product trial
- repeated baseline and follow-up workflow
- YouCam-powered visible-redness measurement
- deterministic and versioned evidence rules
- provisional operating boundaries
- explicit uncertainty and limitations
- designed for repeatability calibration

Forbidden current claims include:

- clinically validated
- clinically proven product efficacy
- dermatologist proven
- medical-grade accuracy
- diagnosis of rosacea, dermatitis, allergy, inflammation, or barrier damage
- treatment, cure, or prescription advice
- safe for your skin
- validated for all skin tones
- percentage efficacy derived from raw-score movement

## 11. Privacy and security

Durable state must never contain:

- face image bytes
- `File` or `Blob` values
- base64, data URLs, or object URLs
- signed provider upload URLs
- provider task identifiers
- API credentials or authorization headers
- raw provider payloads
- medical diagnoses inferred from capture

`YOUCAM_API_KEY` remains server-only. The engineering token and signed cookie protect hackathon and internal tooling; they do not constitute a consumer account system.

## 12. Language

Primary product language is:

- Start a new trial
- Register and load
- Baseline
- Trial in progress
- Follow-up ready
- Follow-up scan
- Result
- Recommendation
- Evidence Record
- Previous Trials

Internal reducer, migration, scientific, and adapter names may remain precise in code and technical detail. They must not create a second visible product vocabulary.

## 13. Phase C status

### #63 — Evidence Burst (current)

Three independently analyzed frames per baseline and follow-up, median aggregation, direction agreement, bounded attempts, rejection evidence, and face-free burst persistence.

### #64 — Trial Truth (planned)

Explicit adherence, tolerance, symptoms, and participant-observed redness direction mapped into the existing canonical evaluator.

### #65 — Preliminary Calibration Harness (planned)

A protected internal repeatability instrument that produces exploratory estimates and a technical report. It must not silently promote a small hackathon sample into a production-approved threshold or clinical claim.

Each merged PR must update the current evidence-volume section, state model, journey, README, authority index, and tests.

## 14. Non-goals

The current product is not:

- a skin diagnosis tool
- a beauty or attractiveness score
- a complete routine optimizer
- an ingredient database
- a product marketplace
- a dermatologist dashboard
- a clinical trial platform
- a substitute for medical care
- a multi-concern score wall
- an LLM-generated verdict system
- a permanent face-image archive

## 15. Demo contract

The canonical hackathon demo should prove one complete product investigation:

1. register one real product
2. assign Reduce visible redness
3. complete a real guided baseline capture
4. show trial continuity and follow-up eligibility
5. complete a matched follow-up capture
6. run the real deterministic evidence path
7. reveal one honest result through the Oracle
8. expose the result boundary and technical evidence
9. collect exactly one Evidence Record
10. reopen the same record from Previous Trials

The demo explains the human problem and magical action before technical architecture. It does not tour every internal state or imply clinical validation.
