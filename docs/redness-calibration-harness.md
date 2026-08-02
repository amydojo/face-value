# Redness calibration harness

**Status:** Current internal engineering authority
**Effective date:** August 1, 2026
**Implementation base:** `main` at merged PR #69
(`f95b051f6c562919c23da0d08728fff124d27d48`)
**Current change:** issue #65

This document defines the implemented preliminary redness-calibration harness.
It extends the canonical redness evaluator and evidence documents without
changing their production authority.

## Purpose and claim boundary

`/calibration/redness` is a protected engineering instrument for measuring
repeat-scan behavior from isolated, face-free observations. Its output is a
**Preliminary internal estimate** of **Technical repeatability**, not clinical
validity. This does not establish clinical efficacy or a clinically meaningful
change.

The instrument includes a real collection path that reuses the canonical
three-frame camera adapter, bounded provider analysis, and signed engineering
session. The current YouCam account returns HTTP 400 `CreditInsufficiency`
during task creation, so automated verification uses injected camera/provider
doubles and separate deterministic, explicitly synthetic, face-free fixtures.
No genuine calibration collection or physical provider gate is represented as complete.

## Frozen production boundary

Consumer trials remain on the byte-frozen production evaluator configuration:

- detectable boundary: 5 raw-score points
- strong boundary: 10 raw-score points
- threshold source: `provisional_fixture`
- version: `redness-provisional-v1`
- provisional: `true`
- configuration hash and evaluator precedence: unchanged

Exploratory calibration estimates never enter a consumer
`RednessEvaluationSnapshot`. Production loading returns no configuration for an
issue #65 registry entry and either ignores a valid exploratory entry or rejects
an unsupported one.

## Security and navigation

The internal route reuses the signed Demo Lab engineering-session handler. The
server accepts `GET` and `HEAD` only after the existing `Secure`, `HttpOnly`,
`SameSite=Strict` session cookie passes validation. Unauthorized requests use
the existing protected-route redirect. There is no query-string password,
local-storage bearer token, client-bundled secret, or ordinary consumer link.

The only restrained entry point is protected Demo Lab Utilities.

## Observation contract

`redness-calibration-observation-v1` is immutable, versioned, pseudonymous, and
face-free. It records:

- observation, participant, session, condition, and capture timestamps/IDs
- `standard`, `no_treatment_longitudinal`, or `degraded` condition type
- `live_provider`, `synthetic_face_free_fixture`, or `imported_unverified`
  collection source; only the completed internal camera/provider path creates
  `live_provider`
- front-camera device class and immutable app/API/model/mode/preprocessing/
  protocol versions
- the existing bounded `RednessEvidenceBurst`, its saved session median,
  capture quality, outcome, and optional comparison anchor
- structured makeup/tint/filter/enhancement, recent activity/exposure,
  high-level routine-change, emotional-flushing, time-of-day, and product-state
  context
- structured confounder code, severity, and source
- explicit `not_available` mask, registration, segmentation, pose, crop,
  face-size, color-cast, lighting, and eligible-pixel fields
- measured skin-tone group only from a future validated audit input; the issue
  #65 fixtures record `null` / `not_collected`
- `includesFaceImage: false`

It never stores or exports images, face data, thumbnails, masks, `Blob`/`File`
values, base64/data/object/signed URLs, provider task IDs, raw provider payloads,
names, emails, or account identifiers. It never infers skin tone.

## Isolated persistence

Calibration persistence uses
`face-value:calibration:redness:v1` and
`face-value-redness-calibration-envelope-v1`, bounded to 240 observations. It
is separate from ordinary trial, Evidence Record, and Demo Lab storage.
Every text field is bounded to 256 UTF-8 bytes, every observation to 16 KiB,
and every stored/imported/exported observation envelope to 512 KiB. Validation,
hydration, import, export, save, and append check their applicable bounds before
writing.

Hydration validates the complete envelope and every observation
deterministically. Invalid JSON, incompatible versions, duplicate immutable
IDs, private fields, non-finite evidence, or any invalid observation quarantine
the input and make the entire dataset unusable. Invalid bytes remain available
for inspection; they are not silently coerced or partially analyzed. Import
replaces data only after validation and explicit confirmation. Imported
observations are always relabeled `imported_unverified`, including JSON that
claims `live_provider`, so imported provenance can never appear genuine. Clear
removes only the calibration key.

Exports are canonical, key-sorted JSON and contain non-image observations or a
single exploratory registry entry. There is no cloud sync, analytics upload, or
background request.

## Predeclared analysis

`analyzeRednessCalibration` is a pure domain function. React receives a
presentation view model and never calculates statistics, re-evaluates saved
records, activates a threshold, or infers missing evidence.

### Eligibility

Every input observation receives an inspectable result. The standard estimate
excludes and names:

- corrupt observations and incompatible API, analysis-model, analysis-mode,
  preprocessing, or capture-protocol versions
- hard capture failures
- explicit interventions
- degraded conditions
- missing or non-finite raw scores
- fewer than three accepted measurements

Degraded evidence remains visible in its own breakdown and never silently
enters the standard no-change dataset.

### Within-burst support

For each valid accepted burst, analysis preserves the raw scores, accepted and
rejected counts, saved rejection evidence, median, range, and every unordered
absolute pairwise difference. Direction agreement is calculated only when an
explicit comparison anchor exists; otherwise it is `not_available`.

### Technical N95

Within-burst frame differences remain agreement evidence only. The predeclared
Technical N95 pool is every unordered pair of eligible standard formal-
recapture burst medians grouped by participant, calibration session ID, and
matched condition ID. Longitudinal observations never enter this pool. The
point estimate is the empirical 95th percentile using named R-7 linear
interpolation. Output includes formal-recapture comparison, participant,
calibration-session, and participating-frame counts plus a deterministic
participant-cluster bootstrap percentile interval or a reasoned
`not_estimable` result.

### Longitudinal N95

The pool is every valid within-participant pair of eligible no-treatment
session medians that shares one no-treatment condition ID. Participants never
mix, and degraded sessions never enter the pool. The point estimate uses the
same R-7 95th percentile and participant-cluster interval contract.

### Within-person SD and repeatability coefficient

Within-person SD is the residual standard deviation around participant means
over every eligible observation median. Formal same-session recaptures remain
distinct observations. The calculation uses `N − participants` residual
degrees of freedom, allows unequal observation counts, and is not a pooled
between-person SD.

The repeatability coefficient is exactly:

```text
1.96 × sqrt(2) × within-person SD
```

### ICC and bootstrap

The named ICC is ICC(A,1), equivalently ICC(2,1): a two-way random-effects,
single-measure, absolute-agreement estimate over a balanced complete matrix.
Unbalanced, incomplete, degenerate, or insufficient inputs return a reasoned
`not_estimable` result rather than zero, `NaN`, or infinity.

Bootstrap algorithm `participant-cluster-percentile-xorshift32-v1` resamples
whole participant clusters with replacement. Its default is 2,000 iterations
and seed 650065; tests use an explicit fixed seed and may use fewer iterations.
It never treats frames from one participant as independent participants.

### False change, rejection, and candidates

No-change comparisons comprise eligible signed matched-standard formal-
recapture burst-median pairs and matched no-treatment session-median pairs. A
false change falls outside a candidate's no-detectable-change zone. Each
candidate reports valid comparison count, false-change count/rate, Wilson
interval where estimable, and saved worsened/no-change/directional/meaningful/
strong classification counts.

Display-only candidates are:

- current provisional 5/10 consumer boundaries
- Technical N95
- Longitudinal N95
- repeatability coefficient
- the maximum finite Technical N95, Longitudinal N95, and repeatability
  coefficient as a predeclared conservative composite

For exploratory display candidates, the estimate is the detectable boundary,
`2 × estimate` is the strong boundary, and `1.5 × estimate` is the boundary
between directional and meaningful-candidate counts. A signed difference at or
below the negative detectable boundary is worsened. These display bins never
invoke or replace the production evaluator.

The dashboard also reports rejection rate using all attempted frames, repeated-
capture median/maximum range, and device/API/model/condition strata. Measured
skin-tone breakdown is **Not collected** when no validated audit input exists;
otherwise the instrument renders the validated, non-inferred audit groups.

## Exploratory registry

Registry version `redness-exploratory-calibration-v1` contains the issue's
required sample, method, interval, rate, version, and device fields. Stable
recursive key ordering produces canonical JSON. `config_hash` is
`sha256:` plus the SHA-256 digest of the canonical unsigned entry.

Every issue #65 entry is frozen to:

```text
threshold_source: technical_calibration
status: exploratory
approved_by: null
provisional: true
```

Serialization rejects any entry that does not preserve those values.

## Internal views

The instrument exposes structured participant/session/condition and confounder
inputs, live quality/count state, the canonical camera/provider collection
path, actual provider-blocked failures, and separate synthetic controls for
standard recaptures, matched no-treatment sessions, degraded evidence, and the
complete deterministic dataset. A live observation is appended only after all
three distinct current frames are accepted and analyzed; failures and
cancellation persist nothing. It renders:

- answer-first preliminary metric cards
- compact provisional-versus-exploratory candidate comparison
- raw session inspection with explicit unavailable fields
- participant timeline and matched no-treatment differences
- visible exclusion reasons
- device/API/model/condition breakdowns
- canonical observation and registry export, validated import, and confirmed
  isolated clear

Status meaning is written in text and does not rely on color. Controls, tables,
dialogs, live regions, focus rings, reduced motion, narrow Mobile WebKit, and
desktop layouts remain accessible without document-level horizontal overflow.

## Consumer Redness Response Signature

The existing Evidence Record presentation adapter groups one immutable saved
snapshot into five progressive-disclosure sections:

1. Observed change
2. Measurement support
3. Trial truth
4. Evidence boundaries
5. Supported next action

Rows identify `Provider measurement`, `Face Value deterministic evaluation`,
`Participant report`, or `Unavailable evidence` in text. Arrays, saved medians,
delta, classifications, agreement counts, trial truth, provisional source/
version/hash, missing evidence, action, explanation, and audit trace come only
from saved record fields. The adapter imports no evaluator or threshold
authority and persists no separate Response Signature object. Older records
retain their existing honest missing-detail fallback and are never migrated or
re-evaluated.

## Verification and remaining physical gate

Unit and component coverage exercises formulas, deterministic bootstrap,
registry hashing/isolation, persistence quarantine, privacy rejection, signed
route behavior, injected camera/provider collection, accessibility, snapshot
fidelity, and legacy honesty. Mobile WebKit does not call YouCam and verifies
the synthetic instrument mode, isolated storage, export/import, Demo Lab continuity,
runtime errors, 5xx responses, provider-request absence, reduced motion, and
horizontal overflow.

After provider credits return, the exact PR-head deployment still requires a
physical iPhone check of engineering authorization, a genuine three-frame
burst, repositioned formal recapture, matched no-treatment collection,
face-free reload, raw scores/median/range/rejections, ordinary-store isolation,
and Safari camera/viewport teardown. Until then, no provider-backed calibration
or physical acceptance claim is supported.
