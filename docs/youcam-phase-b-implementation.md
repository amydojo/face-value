# YouCam Phase B implementation record

> Historical Phase B engine record. Phase B.5 supersedes the fixture-owned
> product identity and consumer journey described here while preserving the
> provider, normalization, comparison, confidence, privacy, and persistence
> laws. See `docs/youcam-phase-b5-implementation.md`.

Status: Complete. Fixture-backed automation and one genuine matched live-provider pair have both passed the full Face Value evidence journey.

Related work: #40, #43, PR #44.

## Implemented vertical slice

The canonical product path is frozen to:

- Product: `02 / ONE THING`
- Assigned job: `Reduce visible redness`
- Provider: YouCam Skin Analysis
- API version: `2.1`
- Mode: `HD`
- Concern: `hd_redness`
- Region: `null`
- Score: `raw_score`
- Capture protocol: `face-value-youcam-1`
- Calibration: `pending`

The accepted baseline and follow-up are normalized into reducer-owned durable signals. The reducer freezes the baseline protocol, rejects local protocol drift before provider invocation, creates the comparison only after both accepted signals exist, maps the direction into the existing Face Value result, and carries that result through the existing next-step, Evidence Machine, Evidence Record, detail, Past Results, and refresh-restoration journey.

## State ownership

YouCam measures the capture and returns a provider signal. It does not create a verdict, choose a next step, control the cassette, write storage, or create a record.

The Phase B wrapper around the existing Human Butter reducer is the only durable authority for:

- frozen protocol
- accepted baseline
- accepted follow-up
- deterministic comparison
- confidence and limitations
- Face Value result
- selected next step
- Evidence Record enrichment
- restoration

The legacy reducer remains intact for existing product behavior. Phase B adds explicit legal events and delegates all established transitions rather than replacing the existing architecture.

## Durable contract and privacy

`normalizeSkinAnalysisSignal` explicitly reconstructs the allowed durable fields. It cannot carry forward provider task IDs, raw payload fields, signed URLs, image bytes, files, blobs, object URLs, credentials, or mask URLs.

Local persistence includes only:

- protocol
- normalized baseline and follow-up scores
- comparison
- result
- capture metadata without image data
- face-free Evidence Record metadata

Ephemeral request identity is used to ignore stale asynchronous completions and is never serialized.

## Demo authorization boundary

The protected `/youcam-spike` engineering gate accepts `YOUCAM_SPIKE_TOKEN` only long enough to POST it to `/api/youcam/session`. The field is cleared before the request resolves. The server validates it using timing-safe comparison and issues a 30-minute signed cookie with:

- `Secure`
- `HttpOnly`
- `SameSite=Strict`
- `Path=/api/youcam`

Canonical product requests use `credentials: include` and never read the raw token. Unauthorized analysis calls fail closed with `401`. API responses use `Cache-Control: no-store`.

### Temporary compatibility deviation

The Phase A `x-face-value-spike-token` header remains accepted by the server as a protected engineering-only compatibility path. The Phase B canonical product does not send it. Removing the compatibility path is deferred until Phase A evidence collection is retired.

This signed cookie is a temporary hackathon demo boundary, not a consumer account system.

## Comparison rules

The pure comparison function applies:

```text
delta = followUp.rawScore - baseline.rawScore
```

For YouCam `hd_redness`, a higher `raw_score` represents a more favorable redness-related skin condition. The score is not an amount of redness.

- positive delta: `favorable`
- negative delta: `unfavorable`
- zero delta: `unchanged`

Before calibration:

- calibration is always `pending`
- confidence is always `possible`
- the limitation `Prototype noise boundary has not been calibrated.` is always included
- no point threshold is invented
- delta is never described as a percentage
- direction is not described as efficacy or clinical significance

## Result mapping

Favorable direction uses the existing result reveal with:

- title: `Favorable direction detected`
- support: `The redness condition score increased from {baseline} to {followUp}. Higher scores indicate a more favorable skin condition.`
- context: `This comparison may reflect normal scan variation. The prototype noise boundary has not been calibrated.`
- confidence: `Possible`
- default next step: `Test longer`

Unfavorable direction uses:

- title: `No favorable direction yet`
- support: `The redness condition score decreased from {baseline} to {followUp}. Higher scores indicate a more favorable skin condition.`
- confidence: `Possible`
- default next step: `Test longer`

Unchanged direction uses:

- title: `No favorable direction yet`
- support: `The redness condition score remained at {baseline}. No directional movement was detected.`
- confidence: `Possible`
- default next step: `Test longer`

Technical provenance and formatted scores are shown only in existing evidence detail surfaces. Saved trial windows use human-readable local dates and times rather than raw ISO strings. Demo-clearing controls are excluded from production archive builds.

## Calibration utility

`/youcam-calibration` is a protected development utility that keeps repeated same-session scores in component memory only and reports:

- scores
- consecutive deltas
- absolute consecutive deltas
- median absolute delta
- maximum absolute delta
- minimum score
- maximum score

It is labeled `Prototype engineering calibration, not clinical validation.` It writes no production trial state and commits no threshold.

## Automation and verification

CI uses the deterministic provider fixture with the synthetic Phase A values `93.3356` and `100.0000`. Those values are used only to test comparison behavior. They are not represented as a genuine longitudinal trial.

The mobile WebKit path proves:

```text
baseline capture
→ accepted normalized baseline
→ trial active
→ matched follow-up
→ reducer-owned comparison
→ existing result reveal
→ Test longer
→ Evidence Machine release
→ collect
→ detail
→ Past Results
→ refresh restoration
```

Screenshots are uploaded from the Playwright run for baseline accepted, follow-up accepted, result reveal, Evidence Record release, and Past Results.

## Live-provider verification

A genuine same-session matched pair was completed on July 27, 2026 against the stable Phase B preview.

- baseline `hd_redness` raw score: `94.96`
- follow-up `hd_redness` raw score: `95.69`
- delta: approximately `+0.73`
- direction: `favorable`
- calibration: `pending`
- confidence: `possible`
- result: `Favorable direction detected`
- selected next step: `Paused / Test longer`

Both provider tasks completed successfully under the identical frozen protocol. The live result reached next-step selection, Evidence Machine release, collection, Evidence Record detail, Past Results, and browser refresh restoration. The saved record remained face-free after refresh.

This run proves the vertical slice and acceptance plumbing. It does not calibrate the provider noise boundary and does not establish product efficacy or clinical significance.
