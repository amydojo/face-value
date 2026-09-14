# FV-01 · Physical Evidence Terminal — v0 handoff

## Mission

Turn the existing Face Value digital prototype into the software/HMI for a real countertop skincare accountability instrument.

This is **not** a redesign of Face Value and **not** an iPad kiosk. The physical machine will provide the chassis, orange actuator, NFC/cassette bay, camera, and thermal receipt printer. The screen should behave like the instrument display inside the existing Face Value machine language.

Core thesis: **ONE PRODUCT · ONE JOB · ONE HONEST RESULT.**

## Source truth

Canonical Figma file:
- https://www.figma.com/design/GKiVi4YJLm9WqozwAK3ThB/Face-Value

Primary HMI source nodes:
- First Run / Empty Case — https://www.figma.com/design/GKiVi4YJLm9WqozwAK3ThB/Face-Value?node-id=483-4
- Trial Pending / Specimen Loaded — https://www.figma.com/design/GKiVi4YJLm9WqozwAK3ThB/Face-Value?node-id=483-5

Canonical physical-language references:
- Evidence Cassette V7 · Precision Reveal — node `368:3295`
- Canonical actuator geometry — node `703:40`
- Brand identity / lockup system — node `681:102`

Treat Figma as visual authority and the existing repo as behavioral/domain authority.

## Existing codebase — preserve it

Repository: `amydojo/face-value`
Vercel project: `face-value`
Production domain: `face-value-seven.vercel.app`

Current stack:
- React 19
- TypeScript
- Vite
- CSS modules + shared token CSS
- Vitest + Playwright

**Do not migrate to Next.js. Do not add Tailwind. Do not replace the current state machines.**

Reuse existing application architecture and components wherever possible, especially:
- `src/app/FaceValueProvider.tsx`
- `src/app/machine.ts`
- `src/app/phaseBMachine.ts`
- `src/app/trialTruthMachine.ts`
- `src/components/FaceValueActuator.tsx`
- `src/components/FaceValueBrandLockup.tsx`
- `src/components/EvidenceNavigation.tsx`
- `src/components/hardware.tsx`
- `src/styles/tokens.css`
- `src/styles/foundations.css`

Existing Face Value tokens are authoritative, including warm chassis/paper surfaces, near-black enamel/chamber, Geist/Geist Mono typography, and signal orange.

## Build target

Add a dedicated physical-terminal experience at:

`/terminal`

Target display contract:
- kiosk/fullscreen
- primary target: 1280 × 720 landscape
- responsive enough to run in desktop browser preview
- no browser-like page chrome inside the experience
- no simulated phone shell
- no illustration of the whole physical machine on the screen

The physical enclosure itself supplies the machine body. `/terminal` is the **actual screen inside the machine**.

## V0 states

### T0 · Standby / no specimen

Required content:
- FACE VALUE lockup / instrument ID
- `STANDBY`
- `NO SPECIMEN LOADED`
- restrained instruction: `Tap a product cassette to begin.`
- system-ready indicator
- privacy language remains visible but secondary

The state should feel dormant, not empty-dashboard generic.

### T1 · Specimen loaded

Use Figma node `483:5` as the primary visual authority.

Required content:
- `SPECIMEN LOADED`
- product identity
- assigned job
- trial duration / current day
- specimen bottle / identity label presentation
- restrained amber state signal
- next action

No unnecessary cards. Preserve the lab-instrument hierarchy.

### T2 · Trial active

Required content:
- day progress
- baseline secured
- next follow-up timing
- product + job remain visible
- evidence state is visibly accumulating, not gamified

### T3 · Verdict ready

Required content:
- `VERDICT READY`
- dominant human-readable observation
- next action (`KEEP USING IT`, `STOP`, or `RETRY ALONE`)
- compact explanation / comparability status
- physical actuator instruction: `PRESS ORANGE CONTROL TO SEAL RESULT`

Important: the orange button is **physical hardware**. Do not draw a fake orange pushbutton on the terminal screen for this route.

### T4 · Sealing / printing

Required content:
- `SEALING EVIDENCE RECORD`
- permanent evidence ID assigned before print
- short printer animation/progress state only
- completion: `TAKE YOUR RECORD`

The machine should feel like it committed an evidence object, not downloaded a report.

## Evidence receipt

Create a print-safe renderer for a 58 mm thermal evidence receipt.

Requirements:
- monochrome only
- 384 px working width preferred for common 58 mm thermal heads
- bitmap/SVG/HTML render can be used for the browser preview
- no reliance on orange printing
- strong typographic hierarchy
- QR placeholder to open the permanent digital evidence record

Receipt hierarchy:

```text
FACE VALUE
EVIDENCE RECORD

FV-035            13 SEP 26
--------------------------------
ONE THING 10%
JOB · VISIBLE REDNESS

OBSERVED
VISIBLE REDNESS IMPROVED
ACROSS COMPARABLE SCANS.
--------------------------------
BASELINE                60
FOLLOW-UP               72
CHANGE                 +12
COMPARABILITY          PASS
CHECKS                   6/6
DURATION             35 DAYS
--------------------------------
NEXT
KEEP USING IT
--------------------------------
[ QR ]
OPEN FULL EVIDENCE RECORD
FV-035 · PRIVATE BY DEFAULT
```

Add a browser-only preview route/state for receipt QA. Do not attempt real ESC/POS transport in this pass.

## Hardware bridge contract

Create a small interface boundary so the web app can later run unchanged on Raspberry Pi kiosk hardware.

Suggested contract:

```ts
export interface FaceValueTerminalHardware {
  onCassetteDetected(handler: (productId: string) => void): () => void;
  onActuatorPressed(handler: () => void): () => void;
  printEvidenceRecord(recordId: string): Promise<{ ok: boolean }>;
  setStatusLight(state: 'standby' | 'active' | 'ready' | 'printing' | 'error'): Promise<void>;
}
```

For V0, implement a browser/mock adapter only. Real Raspberry Pi/NFC/thermal-printer transport comes later.

Mock controls for development:
- `N` → simulate NFC/cassette detect
- `Space` → simulate physical orange actuator
- `P` → preview receipt / mock successful print

Keep mock controls hidden from ordinary terminal UI; expose only in `LAB · SYNTHETIC` / dev mode.

## Evidence logic constraints

Do not let an LLM decide skincare truth.

The existing Face Value state/evidence logic remains authoritative. The terminal is another surface over the existing deterministic trial state.

The UI may say `LAB · SYNTHETIC` anywhere the measurement is synthetic/demo data.

Do not imply clinical validation where none exists.

## Visual rules

Preserve:
- near-black instrument surfaces
- warm white evidence paper
- Face Value orange only as signal/active state
- Geist + Geist Mono hierarchy
- generous negative space
- machined/appliance feel
- restrained shadows and material depth
- specimen label / evidence-lock language

Avoid:
- generic SaaS dashboard cards
- gradients for decoration
- neon/cyberpunk glow
- beauty-app pinks/pastels
- fake medical dashboards
- chat UI
- excessive metrics
- visualizing the entire physical chassis inside the display

## Implementation strategy

1. Add `/terminal` routing without disturbing the current root journey.
2. Reuse current provider/state machines; do not fork product truth.
3. Build terminal-specific presentational components under `src/features/terminal/`.
4. Add browser mock hardware adapter under `src/adapters/terminal/`.
5. Add receipt renderer under `src/features/evidence-receipt/` or similarly isolated feature path.
6. Add tests for terminal state transitions and receipt data mapping.
7. Preserve all existing checks.

## Acceptance gate

The pass is successful when:

- `/` behaves exactly as before.
- `/terminal` loads at 1280×720 with no horizontal scroll.
- standby → specimen → active → verdict → printing can be demonstrated without a real Raspberry Pi.
- physical actuator is represented as an external input, not an on-screen fake button.
- receipt preview renders a convincing 58 mm evidence ticket from the same evidence record data.
- `LAB · SYNTHETIC` remains visible for synthetic measurements.
- no production API keys or hardware dependencies are required.
- `npm run check` remains green.

## v0 execution instruction

Import the existing GitHub repo into v0 rather than creating a fresh app. Use this document plus the canonical Figma nodes as source context. Make the smallest architecture-preserving implementation required for the acceptance gate. Work on a new branch and produce a Vercel Preview Deployment only; do not promote to production automatically.
