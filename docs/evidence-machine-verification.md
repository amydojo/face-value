# Evidence Machine verification matrix

## Automated

### Unit

- valid and invalid trial transitions
- one product and specimen identity through completion
- resolver ownership by phase
- one-primary-action invariant
- idempotent record generation
- interruption restoration
- confidence seal mapping

### Component

- native door button only when actionable
- parked and locked states expose no fake button
- actuator response precedes door release
- door reaches released state before open state
- artifact edge exists before collection is enabled
- artifact collection fires once
- concise collectible face excludes detail fields
- reduced-motion release still presents and collects the object

### End to end

- full Hydrating Drops / Visible Tone Consistency vertical slice
- double actuator press creates one record
- refresh restores an uncollected presented record
- release failure preserves evidence and retries once
- processing failure preserves evidence and retries once
- back navigation returns from archive to the collected artifact
- 390×844 and 430×932 production-like viewports
- short 390×700 viewport with no horizontal overflow

## Visual checkpoints

Playwright writes the following evidence into `test-results`:

1. awaiting job
2. baseline ready
3. baseline recorded
4. processing
5. verdict ready
6. actuator pressed
7. latch releasing
8. artifact edge
9. 40% feed
10. alignment pause
11. 70% feed
12. record presented
13. collected artifact
14. detail open
15. release error
16. reduced-motion presentation
17. short-height verdict
