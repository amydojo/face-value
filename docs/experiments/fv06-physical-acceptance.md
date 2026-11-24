# FV06 physical iPhone evidence — aggregate record

Status: single-owner, single-session engineering feasibility; capture, comparison and diagnostic export demonstrated. Safari restart persistence is owner-confirmed. No calibrated measurement or population reliability established.

Source: owner-supplied FV06-candidate diagnostic JSON (fv-trial-diagnostics-1; fv-optical-measurement-1; fv-local-optics-metrics-0.1), plus owner description of intended perturbations. Candidate lab commit ee34b9751ab775ee715edef0df7b4b13d5126253 (deployment metadata; JSON does not contain the commit SHA). Previous FV05.1 report remains in foundation record. This record is aggregate only; no source JSON, session identifier, absolute times, faces or personal details committed.

## Recorded outcomes
11/11 recorded accepted captures (one baseline, ten follow-ups), 7 matched follow-ups, 3 ineligible. The first six consecutive automatic check-ins matched all eight required rows; seven of seven initial captures including baseline accepted. Check-in 9, the first intended angle test, matched, so angular perturbation was inconclusive. Check-in 10 was a targeted yaw perturbation and ineligible. No rejected bursts or interruptions were recorded across these 11 accepted captures (11 attempts); abandoned scans outside the export may be absent. All 11 used GPU, 12 analyzed frames, analyzed portrait 203×360, reported camera 1080×1920 at 30 fps. Median time-to-accept 4.249 s, range 1.892–10.522 s; includes guidance and acquisition, not inference latency. Export sharing succeeded per owner and supplied JSON. Owner confirmed fully closing Safari and reopening the same URL to generate the export on November 23, 2026 (Pacific time); baseline and ten follow-ups persisted in the re-export.

| Follow-up | Intended test | Observed deviation | Existing tolerance | Outcome |
|---|---|---:|---:|---|
| 1–6 | unchanged conditions | all required rows within | unchanged | matched |
| 7 | lighting | face luma +27.9367% | 15% | excluded; only brightness outside |
| 8 | distance | apparent eye scale −32.1682% | 10% | excluded; only scale outside |
| 9 | first angle attempt | no required row outside | unchanged | inconclusive, matched |
| 10 | targeted angle | estimated yaw +35.02277°; scale −17.321% | 8°; 10% | excluded; both rows outside |

Owner-reported perturbations are not metrologically controlled ground truth. In check-in 10, pose-dependent foreshortening and perspective can change interocular image scale at fixed distance; cannot attribute deviation uniquely to distance. Do not optimize acceptance rate or change thresholds based on these data.

## Observed variability
First six follow-ups only; signed differences from the actual rounded stored baseline; sample SD across six differences, not a calibrated uncertainty estimate. Scale/luma in percentage points; center in frame fractions; angular rows degrees; shading dimensionless.

| Row | Min | Max | Mean | Sample SD | Maximum absolute deviation / tolerance |
|---|---:|---:|---:|---:|---:|
| Roll | −0.55943 | 0.96991 | 0.45821 | 0.57001 | 19.4% |
| Yaw | −1.36204 | 1.43371 | 0.70371 | 1.02615 | 17.9% |
| Pitch | −1.58512 | −0.27109 | −0.71455 | 0.47771 | 19.8% |
| Apparent scale (%) | −1.80936 | 6.89984 | 4.589 | 3.194 | 69.0% |
| Horizontal position | −0.00747 | 0.00556 | 0.00141 | 0.00509 | 12.4% |
| Vertical position | 0.01895 | 0.04297 | 0.03421 | 0.00851 | 71.6% |
| Face brightness (%) | −1.39637 | 6.40881 | 4.193 | 2.800 | 42.7% |
| Side shading | −0.00368 | 0.00641 | 0.00190 | 0.00443 | 6.4% |

No required row missing in the initial six. Four optional rows (brightness spread, whole-frame brightness, background chromaticity r/g) lack comparison baseline values; diagnostics do not imply color comparability. Exposure time, ISO, white balance/color temperature absent; no calibrated reference. Precision: baseline x/y, scale and shading stored to 0.001, angles to 0.1°, luma to integer; full precision baseline diagnostics are optional and not used to retroactively change comparisons. Maximum rounding errors alone are 0.0005, 0.05° and 0.5 luma units, respectively; these are quantization bounds, not measurement uncertainty. Example baseline luma 107 vs observed 107.410738; scale 0.253 vs 0.25306625. Near-threshold classification may be sensitive to quantization. No change to contract or thresholds justified here. No confidence interval, test-retest population distribution, calibration error, sensitivity/specificity or limits of agreement established.

## Gate separation
Physical capture/repeats/perturbations/export: demonstrated. Physical Safari restart: owner-confirmed close/reopen of the same FV06 URL with re-exported evidence; not a cross-origin, eviction or multi-device durability claim. Historical FV05.1 preserved on its old origin; backward-compatible parsing covered by automated tests, not cross-origin migration. Scientific validation: not established.
