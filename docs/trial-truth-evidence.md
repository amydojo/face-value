# Trial truth evidence checkpoint

**Issue:** #64  
**Dependency:** merged PR #68  
**Scope:** follow-up trial truth only

## Journey position

```text
FOLLOW-UP SECURED
→ TRIAL TRUTH
→ OPTIONAL EXISTING CAPTURE CONTEXT
→ DETERMINISTIC COMPARISON
→ SEALED ORACLE
```

The checkpoint is required only after follow-up evidence is securely committed. Baseline capture does not collect trial truth.

## Canonical evidence

The reducer commits one immutable, generation-bound `TrialTruthEvidence` snapshot composed from the existing canonical types:

- `AdherenceEvidence`
- `ToleranceEvidence`
- `PatientAnchor`
- canonical `IrritationSignal` values

The application clock supplies the participant report timestamp. React owns presentation and focus behavior only. It does not calculate effect, attribution, safety, corroboration, confidence, action, or verdict wording.

## Scientific boundary

`hd_redness.raw_score` remains the deciding objective signal. Trial truth can corroborate objective evidence, weaken attribution, downgrade confidence through the canonical evaluator, block product isolation, or reach the existing safety interruption path. It cannot reverse objective effect classification or independently declare success.

Production thresholds remain unchanged:

- detectable boundary: `5`
- strong boundary: `10`
- threshold source: `provisional_fixture`
- provisional: `true`

## Persistence and legacy behavior

Trial truth is stored in the existing structured persistence envelope and copied into the immutable Evidence Record snapshot. No parallel questionnaire engine, comparison store, or evidence store exists.

Legacy records without trial truth remain readable and display `Not collected`. Hydration does not invent complete adherence, clear tolerance, a favorable patient anchor, anchor agreement, or a safety conclusion.

## Architecture verification

The existing global redness architecture checks continue to reject scientific imports and evaluator ownership drift across production source files. Issue #64 adds a narrower presentation-boundary check under `src/features/trial-truth` for direct scientific decision identifiers such as safety interruption and action outcomes. The narrower check prevents the trial-truth form from interpreting answers while allowing existing saved-verdict renderers to display evaluator-owned snapshot values.

## Verification references

The production golden path completes the required checkpoint before follow-up capture context. The only refreshed Linux WebKit reference is the Evidence Record full-disclosure image whose intentional difference is the honest legacy `Not collected` trial-truth snapshot.

## Explicit exclusions

Issue #64 does not include calibration, release gating, threshold changes, evaluator precedence changes, new objective signals, camera changes, provider changes, medical diagnosis, free-form symptom interpretation, or LLM-generated verdict wording.
