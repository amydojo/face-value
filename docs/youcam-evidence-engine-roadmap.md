# Face Value evidence engine roadmap

**Status:** Current execution roadmap  
**Effective date:** July 30, 2026  
**Implementation baseline:** `main` after PR #62 (`e0173ee`)

This roadmap distinguishes completed repository behavior from the remaining dependency-ordered hackathon work. Historical implementation detail remains available in merged PRs and `youcam-phase-b5-implementation.md`.

## Completed foundation

### Phase A — secure live provider proof

Completed in PR #42.

Delivered:

- server-only `YOUCAM_API_KEY`
- protected upload-slot, task creation, and polling routes
- typed provider boundary
- `hd_redness.raw_score` normalization
- bounded polling and error translation
- privacy verification
- physical iPhone provider proof through the protected spike route

### Phase B — matched longitudinal integration

Completed through the merged Phase B work.

Delivered:

- frozen baseline protocol
- accepted baseline and follow-up durable signals
- local protocol mismatch rejection
- Face Value-owned comparison
- reducer-owned persistence and recovery
- one genuine provider-backed longitudinal path
- face-free Evidence Record continuity

The retired sign-only comparison is no longer the production scientific engine.

### Canonical redness engine

Completed in PR #52 and supporting PRs.

Delivered:

- versioned redness evidence types
- deterministic evaluator
- separate effect, measurement, attribution, evidence, safety, and action dimensions
- provisional 5/10 operating thresholds
- immutable `RednessEvaluationSnapshot`
- audit trace and claim-safe interpretation
- architecture guards against `ui_score`, UI-side verdict logic, and duplicate engines

### Evidence Record and Demo Lab

Completed in PRs #54 and #58.

Delivered:

- progressive Evidence Record detail
- immutable snapshot rendering
- legacy record honesty
- protected typed synthetic Demo Lab states
- isolated demo journey persistence

### Product and machine continuity

Completed through PRs #47, #48, #50, #59, #61, and #62.

Delivered:

- persistent first-trial registration instrument
- canonical specimen identity and material system
- trial-pending and follow-up-ready continuity
- one Oracle result/collection machine
- exactly-once `EVIDENCE_COLLECTED` record creation
- native first-party production camera
- Searching → Aligning → Locking → Scanning → Captured acquisition sequence
- Camera Kit retained as diagnostics only

## Current implementation truth

At the current baseline:

- ordinary baseline uses one accepted YouCam raw score
- ordinary follow-up uses one accepted YouCam raw score
- the evaluator records one session and one accepted score per period
- measurement quality remains limited by honest missing evidence
- adherence, tolerance, and participant-observed change are not collected
- production thresholds remain provisional 5/10 values
- a final exact-head physical-iPhone golden-path pass remains a release gate

## Remaining Phase C sequence

The remaining product work is locked to three implementation issues.

```text
#63 Evidence Burst
→ #64 Trial Truth
→ #65 Preliminary Calibration Harness
→ exact-head release hardening
→ bug fixes only
→ submission
```

## #63 — Evidence Burst

Branch: `agent/redness-evidence-burst`

Objective:

- preserve one consumer scan
- capture three distinct accepted current video frames
- analyze every frame independently through the frozen YouCam protocol
- commit one atomic burst-backed baseline or follow-up period
- use the canonical evaluator for median and direction agreement
- persist accepted/rejected face-free evidence only

Must not:

- duplicate one score three times
- fabricate unavailable capture properties
- change provisional thresholds
- change action precedence
- redesign the acquisition sequence

Exit gate:

A physical iPhone baseline and follow-up each produce three genuine provider measurements through one guided ritual, with no duplicate work or image persistence.

## #64 — Trial Truth

Branch: `agent/redness-trial-truth-lite`

Objective:

- collect product use as planned
- collect tolerance and canonical symptoms
- collect participant-observed redness direction
- commit the inputs once through the reducer
- pass them into the existing deterministic evaluator

Must not:

- infer answers from the camera
- diagnose a reaction
- let self-report reverse the deciding raw-score result
- author safety or attribution logic in React

Exit gate:

Every new follow-up records the three required evidence groups, severe symptoms reach the existing safety precedence, and legacy records remain `Not collected` without fabricated defaults.

## #65 — Preliminary Calibration Harness

Branch: `agent/redness-calibration-lite`

Objective:

- create protected `/calibration/redness`
- reuse the real burst primitive
- collect standard, matched no-treatment, and degraded sessions
- persist isolated face-free calibration observations
- calculate preliminary repeatability and false-change evidence
- export an exploratory versioned registry entry
- enrich technical Evidence Record detail from saved burst/trial-truth evidence

Minimum hackathon outputs:

- Technical N95
- Longitudinal N95
- within-person SD
- repeatability coefficient
- rejection rate
- false-change comparison
- participant/session/frame counts
- device and version breakdown where available
- explicit `not_available` or `not_estimable` states
- exploratory registry hash

ICC and bootstrap intervals should be implemented where sample structure supports them and must fail honestly to `not_estimable` when it does not.

Critical boundary:

- production detectable boundary stays 5
- production strong boundary stays 10
- production source stays `provisional_fixture`
- exported candidate status stays `exploratory`
- no small pilot is promoted into a clinically meaningful or production-approved threshold

Exit gate:

The harness can reproduce its preliminary calculations entirely from exported face-free observations while production trials continue using the unchanged provisional configuration.

## Final release gate

After #65 merges, feature work stops.

Required release proof:

- exact-head CI success
- exact-head Vercel deployment
- physical iPhone baseline and follow-up golden path
- real three-frame provider work
- favorable, null, confounded, safety, retry, and provider-failure scenarios
- no duplicate comparisons or records
- privacy and architecture scans
- Evidence Record immutability across Home, Previous Trials, detail, and reload
- claim-language audit
- runtime-log review
- backup demo recording
- submission video and write-up

## Scope freeze

The hackathon critical path excludes:

- additional YouCam concerns
- product recommendations
- ingredient intelligence
- barcode or OCR
- cloud accounts
- multi-product dashboards
- machine, specimen, Home, or Oracle redesign
- permanent face storage
- LLM-generated scientific decisions
- clinical-validation claims

## Documentation rule

Each implementation PR must update:

- root `README.md`
- `docs/README.md`
- affected authority contracts
- current limitations
- roadmap status
- exact verification evidence

Planned behavior must never be described as merged before the corresponding PR lands.