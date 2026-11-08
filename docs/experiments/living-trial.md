# Living Trial (experiment 05)

One product, one claim, one ongoing experiment, built on the guided capture from
[`local-optical-comparability.md`](local-optical-comparability.md). Status: **experimental,
unvalidated, not yet device-verified**. It is separate from the production journey, its trials,
the Oracle and the Evidence Record; none of their code or decision logic is used or changed.

## Where it lives

- Route `/trial`, behind the same gate as `/experiments/local-optics`
  (`LOCAL_OPTICS_ENABLED`: dev, or a build with `VITE_LOCAL_OPTICS_EXPERIMENT=true`). A separate,
  lazily loaded chunk; the production bundle does not contain it.
- `src/features/local-optics/LivingTrial.tsx` (screens), `trialStore.ts` (record, validation,
  storage), and an optional `trial` prop on `LocalOptics` (the existing guided capture: same
  model, gates, thresholds and manual fallback; it starts by itself and hands an accepted capture
  to the trial instead of showing its own result panel).

### Bootstrap exception (05.1, experiment builds only)

`src/main.tsx` renders `/trial` and `/experiments/local-optics` **without** the production
`FaceValueProvider` (and `StageFocusManager`). The provider reads saved journeys from
localStorage while mounting; where Safari blocks website data, merely touching `localStorage`
throws and the page never appears. Neither experiment uses the provider. The switch is
`isStandaloneExperimentPath()` in `localOpticsAccess.ts`, which is `false` whenever
`LOCAL_OPTICS_ENABLED` is false, so the production bundle compiles it away: the production build
is byte-identical to 7ac47a6 (`index-DcyWFN_W.js`, SHA-256 `d955e626…`). The production journey
itself is unchanged, including its existing failure with storage blocked; that is out of scope.

### Deployment safety

- `vercel.json` disables Git auto-deployment for exactly `experiment/local-optical-comparability`
  and `feat/fv05-living-trial` (exact names; `main` and every other branch deploy as before).
  Vercel reads this from the pushed commit; `main`'s own `vercel.json` has no such entry.
- `scripts/vercel-build.mjs` builds the Living Trial branch as the experiment **only** in the
  optics-lab project (`prj_LqZsxoGOjWRLSTLRbAJkyDqAgavI`); anywhere else it is the standard build.

## The journey

1. **Start**: product name and one intended outcome (four common ones or free text). The screen
   explains the 14-day plan, that check-ins confirm matching conditions, that skin is not
   measured, and that the camera comes next. No camera or model request before "Capture baseline".
2. **Baseline**: the guided capture runs and captures automatically (or by tap). "Baseline
   captured" explains that it is an optical reference (distance, angle, light), not a reading of
   skin.
3. **Save**: one choice, "Save trial on this device" or "Don't save", with what is kept and
   Safari's limits stated next to it. "Saved on this device" appears only after the written
   record has been read back and validated.
4. **Return**: opening `/trial` again goes straight to "Welcome back": the product, claim,
   "Day N of 14", time since baseline, check-ins and the next action. No re-entry, no new consent.
5. **Check-in**: the guide steers to the *saved* baseline; an accepted capture is compared with
   it by the unchanged `compareCaptures`. The result separates **capture quality (passed)** from
   **same conditions as baseline (yes / no + plain reasons / not confirmed)** and always says
   "Skin change isn't measured in this version." Every check-in is appended; none is replaced.
6. **Review**: baseline and each check-in with its date and condition result, the count of matched
   check-ins, and "What this can't tell you". No scores, percentages or verdicts.
7. **Manage**: what is kept, how long, Safari's limits, delete (with confirmation), clear older
   unreadable copies, and "Save" for a trial that was not saved.

## The saved record (`fv.livingTrial.v1` in localStorage)

Written only after the person chooses to save. Schema `fv-living-trial`, version 1:

| Field | Content |
| --- | --- |
| `id`, `createdAt`, `updatedAt` | random id, timestamps |
| `consent` | `{ storage: 'device-local', grantedAt, version: 'fv-trial-storage-consent-1' }` |
| `product` | `{ name ≤ 80 chars, outcome ≤ 120 chars }` |
| `plan` | `{ days: 14 }` |
| `baseline` | `capturedAt`, `trigger`, `quality: 'passed'`, analysed `frame` size, and `guide`: the existing ten-number guide template (orientation; face centre x/y and eye-corner distance to 3 decimals; roll, yaw, pitch to 0.1°; face brightness to 1 level; side shading to 3 decimals) |
| `checkIns[]` | `at`, `trigger`, `quality: 'passed'`, `conditions` (`matched` / `not_matched` / `unconfirmed`), `reasons` (`light`, `distance`, `position`, `angle`, `framing`) |

Never stored: images, video, frames, landmarks or meshes, face height or edge margins, embeddings,
per-frame values, camera settings, user agent or device identifiers. The guide numbers are derived
from a face and are treated as personal data: saved only with consent, listed in Manage, deletable.
Nothing is transmitted; the page makes same-origin GET requests only and has no analytics.

Rules enforced in `trialStore.ts` (unit-tested):

- **Validation**: a record is parsed field by field and rebuilt from known fields only; anything
  else is dropped. A record without consent or a baseline cannot be saved.
- **Verified save**: write, read back, compare; quota, blocked and unverifiable saves are reported
  as such and the trial continues in the tab.
- **No silent overwrite**: a save never replaces a different trial or an unreadable record
  (another tab, another version). A check-in is appended to the saved copy if another tab has
  added check-ins since.
- **Unreadable data** (damaged JSON, wrong shape, newer/older version): "This saved trial can't be
  opened … Nothing has been deleted." Its contents are never displayed. "Start a new trial" first
  copies it to `fv.livingTrial.unreadable.<time>`, verifies the copy, then frees the main key; if
  the copy fails nothing changes. Set-aside copies are bounded and the screen says so: removed
  after 30 days (on the next visit), and at most two are kept. Deleting it now is a separate,
  confirmed action.
- **Blocked storage** (touching `localStorage` throws): the page still opens (see the bootstrap
  exception), the start screen says the trial lasts only while the tab is open, there is no Save
  button to promise anything, and every status reads "Not saved".
- **Read-only storage** (reads work, writes fail: full, or older Private Browsing): a saved trial
  still restores; a check-in that can't be written says "Not saved" with the reason, and the home
  screen reads "Saved on this device · latest check-in not saved". The saved copy is untouched.
- **Retention**: Face Value never deletes a trial on its own. After 60 days without activity, it
  asks "Keep" or "Delete" on the next visit. Nothing promises the data will last 14 days: Safari
  may remove it first (below), and the app says so before saving.
- **Safari's own limits, disclosed in the app**: Safari can delete a site's script-written storage
  after 7 days of browser use without visiting it; Private Browsing discards it; clearing website
  data deletes it; it is not backed up, synced or encrypted.

## Scientific boundary

- Capture gates, guide bands, tolerances and the comparison are unchanged. The tolerances remain
  exploratory and unvalidated.
- Every check-in is compared with the **rounded saved baseline**, also within the session, so
  restored and unrestored trials behave identically. Rounding is 10–100× finer than the
  tolerances.
- Condition reasons are a relabelling of the comparison's outside-tolerance rows; "not confirmed"
  means a required property could not be measured.
- Nothing estimates skin change, product effect or redness. The YouCam redness scale is not used.
  No new models, paid APIs or server inference.

## Tests

- `src/test/living-trial-store.test.ts`: record shape, validation, consent, verified and failed
  saves, conflicts, unreadable and incompatible records, archiving, deletion, retention, check-in
  history and the reason mapping against the real `compareCaptures`.
- `e2e/living-trial.spec.ts` (real model, Chromium's file-backed camera, `npm run
  prepare:local-optics` first): first visit → automatic baseline → verified save → reload →
  **full browser restart from the same on-disk profile** → two automatic check-ins → review →
  restart in **dimmer light** (guide holds; manual capture recorded as "light was different") →
  restart **held too far** (guide asks to come closer; the gates refuse; nothing recorded) →
  history and baseline intact. Also: storage that **throws before React starts** (whole ephemeral
  trial, no page errors, no "Saved" anywhere); read-only storage; backgrounding and a page reload
  mid check-in; a fresh profile; a moved saved baseline steering the guide; elapsed days and a
  320×568 view; retention prompt; damaged and other-version records; blocked save then recovery;
  denied camera; interrupted camera; deletion; storage and network inventory.

Screenshots (390×844 unless named otherwise) from that run are in
[`../verification/living-trial/`](../verification/living-trial/).

Chromium is not iOS Safari. Safari's eviction, Private Browsing and camera behaviour need the
protocol below.

## iPhone protocol (protected lab deployment)

Use Safari, not a home-screen web app, unless testing that separately.

1. **First run**: open `/trial`. Register a real product and outcome. Confirm no camera prompt
   before "Capture baseline". Let it capture automatically. Save. Note seconds to capture.
2. **Safari restart**: swipe Safari away in the app switcher, reopen it, open `/trial`. Expect
   "Welcome back" with the same product, Day 1, no form, no consent prompt.
3. **Hours later**: return after 3+ hours, ideally after a phone restart. Same expectations; the
   time since baseline is shown in hours.
4. **Same light, handheld**: run a check-in in the baseline spot. Expect automatic capture and
   "Conditions matched". Note any instruction that recurs.
5. **Different light**: a check-in in clearly different light (another room or lamp only). Expect
   either the light instruction holding the capture, or "Conditions didn't match: The light was
   different". Either is a correct outcome; a "matched" result here is a finding to report.
6. **Different hold**: phone noticeably lower or closer. Expect the guide to steer back; a manual
   capture far off should give a distance, angle or position reason.
7. **Review and Manage**: check the counts and that nothing claims skin change. Delete the trial;
   reopen `/trial` and expect the start screen.
8. **Private Browsing (optional)**: open `/trial` in a private tab, save, close the tab, reopen.
   Record what Safari does; the app must not claim the trial is kept beyond what it verified.

Report per step: pass/fail, seconds, and anything confusing. Do not send screenshots of a face.
