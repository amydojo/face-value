# Evidence Machine interaction matrix

| Route or stable state | Primary owner | Control | Enabled condition | Visible result | Durable mutation | Destination | Loading or error state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Landing | page | Start a product trial | always | product trial begins | product registered | job selection | pressed page control |
| Job selection | page | Assign this job | valid selected job | machine status changes to JOB ACCEPTED | assigned job | baseline required | disabled with prerequisite before selection |
| Baseline required | machine | amber actuator | assigned job exists | actuator compresses and capture opens | baseline capture started | capture contract | actuator locked while opening |
| Baseline recorded | page | Begin trial | baseline exists | BASELINE RECORDED remains visible | trial active | active trial | pressed page control |
| Trial active | none | none | n/a | machine remains informational | none | none | n/a |
| Follow-up required | machine | amber actuator | target date reached or fixture ready | actuator compresses and capture opens | follow-up capture started | capture contract | actuator locked while opening |
| Processing | none | none | n/a | COMPARING SCANS / LATCH LOCKED | processing status | none | recoverable processing error |
| Processing error | machine | amber actuator | preserved trial and scans | retry work starts visibly | processing retry | none | PROCESS INTERRUPTED / PRESS TO RETRY |
| Verdict ready | machine | amber actuator | verdict exists | compression, latch, slot light, record feed | one idempotent Evidence Record | no navigation | RELEASE INTERRUPTED / PRESS TO RETRY |
| Record presented | artifact | Evidence Record artifact | release reached stable stop | artifact lifts from machine | record collected | no navigation before collection | machine motion stopped |
| Record collected | page | View evidence detail | artifact collected | detail appears below same object | collected state persists | same screen or detail layer | no competing actuator |
| Disposition required | page | disposition controls | collected record exists | selected next step is visible | disposition | complete | disabled until collection |
| Archive | page or none | record and archive actions | collected record exists | same artifact remains centered | archived state | archive or trials | n/a |

## Invariant

Every stable state exposes exactly one of `machine`, `artifact`, `page`, or `none` as `primaryActionOwner`. An enabled affordance must mutate visible state, navigate after a valid transition, begin visible work, or explain why it is unavailable.
