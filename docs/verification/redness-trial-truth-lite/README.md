# Redness trial truth lite verification

Issue #64 adds one reducer-owned evidence checkpoint after the committed follow-up burst and before deterministic comparison creation.

The implementation preserves the merged three-frame acquisition architecture from PR #68. Trial truth supplies canonical adherence, tolerance, symptoms, and participant-observed visible redness to the existing evaluator. It does not change the objective redness direction, provisional thresholds, threshold hash, evaluator precedence, camera behavior, or provider behavior.

Automated coverage includes canonical mappings, injected-clock timestamps, required-answer validation, stale and duplicate-submit rejection, exactly-once comparison and Evidence Record creation, persistence and legacy honesty, evaluator safety and attribution integration, accessibility, seven Mobile WebKit scenarios, immutable saved-record continuity, privacy scans, and architecture guards.

The Linux WebKit Evidence Record reference was refreshed only after inspecting the CI-generated actual and diff. The intentional visual change is the bounded trial-truth snapshot block: product use, skin response, reported symptoms, participant observation, participant report timestamp, and anchor relationship. No unrelated visual drift was accepted.

Physical iPhone and VoiceOver acceptance remains pending on the exact draft PR-head Vercel deployment. The pull request must remain draft and must not be merged until that checklist is completed.
