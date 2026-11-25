# Feature parity and verification

This audit covers the pinned, licensed source and observed reference interfaces,
not a claim that every production service of either reference has been cloned.
Both original engines and complete local content catalogs are retained.

## Provenance and status

| Reference                                      | Imported source                                                                 | License and location                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| https://breakscale.tech/?example=single-server | `workersio/breakscale` at `a75b3f31859ce86750ef33f2252773d1f1ae312b`            | MIT, Copyright 2026 Breakscale contributors; root `LICENSE`. |
| https://systemdesigner.io/                     | `adityareddy-dev/system-designer` at `9eccaa31d35c162d72836b396d52a2c2a295193a` | MIT, Copyright 2026 Aditya Reddy; `learning/LICENSE`.        |

Actual license files were read before reuse. Bundled font OFL notices are
preserved. Source metadata is in `.github/UPSTREAM.json`. Upstream Git metadata
and workflows were not imported. This is an adaptation, not original authorship
of the simulations, problems, lessons or reference illustrations.

Status notation:

- **Source/test:** implemented in imported source and covered by the existing
  suite or content/model checks; not every control was separately clicked.
- **Browser:** exercised on the compiled site by `tools/smoke-site.mjs`.
- **Backend gap:** source exists, but the service is not available on this static
  deployment. No fictitious replacement or upstream account service is used.

## Simulator / Breakscale

| Feature family  | Included features                                                                                                                                                                                                                 | Implementation / evidence                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Simulation      | Individual-request discrete-event engine; seeded service-time variability, finite concurrency, FIFO waiting, downstream slot holding, timeouts, abandoned work, retries and feedback amplification.                               | `src/sim/`; Source/test. Browser overload and database crash change observed outcomes.                                                                                   |
| Traffic         | Offered load slider from 1 to 5,000 requests/s, relative load multiplier, per-client steady/ramp/spike/daily-cycle/bursty/thundering-herd patterns, cycle/burst/herd controls and skewed keys.                                    | `src/App.tsx`, `src/components/Inspector.tsx`; Browser load multiplier reaches 100x.                                                                                     |
| Run controls    | Play/pause, single-tick step, reset, simulation speed, repeated runs and replayable failures.                                                                                                                                     | `src/App.tsx`, `src/sim/`; Source/test; Browser reset.                                                                                                                   |
| Live metrics    | System p99, goodput, failing and lost requests; latency/rate charts; utilization, backlog, queue wait, throughput, abandoned work and component-specific live readings; traffic dots and edge cues.                               | `src/components/`, `src/sim/`; Source/test; Browser headline readings.                                                                                                   |
| Diagram editing | Pan/zoom/fit, drag and click-port connections, keyboard wiring, multiple selection and box select, nudging/snap bypass, copy/cut/paste, duplicate and Alt-drag, rename/delete, undo/redo, context menus and touch press-and-hold. | `src/components/`, `src/App.tsx`; Source/test.                                                                                                                           |
| Annotations     | Text notes, labelled/resizable sections, group framing and multi-selection editing.                                                                                                                                               | `src/components/`, `src/App.tsx`; Source/test. Notes/sections are annotations, not two extra simulation components.                                                      |
| Connections     | Routing/fan-out and call semantics; editable link latency/weight where applicable; cut/reconnect, loss, duplicate delivery and one-way response loss; visible failure and traffic state.                                          | `src/components/Inspector.tsx`, `src/sim/types.ts`, `src/sim/engine.ts`; Source/test.                                                                                    |
| Faults          | Crash/restart, instance failure, slow/stall where meaningful, node and connection failure controls, repair, fault history/replay and reversible experiments.                                                                      | `src/components/FaultControls.tsx`, `src/components/faultWiring.ts`; Source/test; Browser database crash.                                                                |
| Correctness     | Payment/write workloads; duplicate charge, acknowledged write loss and read-your-own-write goals; idempotency/durability/replication/consistency controls where applicable; first violating request traces.                       | `src/sim/`, `src/components/Inspector.tsx`, `src/breakitJob.ts`; Source/test.                                                                                            |
| Failure search  | “Can you break it?” searches counterexamples; “Find the problem” provides measured bottleneck feedback; experiment replay/undo.                                                                                                   | `src/useBreakSearch.ts`, `src/learn/finding.ts`, `src/learn/FindProblem.tsx`; Source/test.                                                                               |
| Guided learning | Four-step onboarding tour, per-example tasks, progress/badges, “What happened” timeline and a 49-step learning path (25 examples, 18 challenges, 6 incidents). | `src/learn/`, `src/content/learningPath.ts`; retained content plus a personal measured cache-policy exercise. |
| Catalogs | All original 24 examples plus Cache policies and freshness, 18 challenges and 6 historical incident stories, including watch/fix flows, budgets/goals and challenge-locked fields. | `src/sim/presets.ts`, `src/sim/challenges.ts`, `src/content/`. |
| Saved designs   | Autosave, named local designs, versioned design serialization, import/export `.breakscale`, supported fragment links and full-browser backup/restore.                                                                             | `src/savedDesigns.ts`, `src/share/`, `src/components/Settings.tsx`; Source/test; Browser fragment share survives navigation and reload.                                  |
| Exports         | Diagram SVG/PNG and design file export, share controls. Encoded fragment links work without upload; large diagrams can exceed the 2,000-character URL limit and require file export.                                              | `src/share/`, `src/components/Settings.tsx`; Source/test; Browser small fragment link.                                                                                   |
| Presentation    | Reduced-chrome presentation mode, component explanation and crash/slow/repair keys.                                                                                                                                               | `src/App.tsx`; Browser Shift+P and Stop presenting. Escape is not the presentation exit shortcut.                                                                        |
| Help            | 119 searchable glossary entries, component legend, inline explained terms, standalone glossary page, keyboard dialog and searchable command palette.                                                                              | `src/content/glossary.ts`, `src/components/Glossary.tsx`, `src/components/Shortcuts.tsx`, `src/components/CommandPalette.tsx`; Source/test; Browser standalone glossary. |
| Settings        | Light/dark/system theme; Generic/AWS/Azure/GCP naming and instance specifications; tooltips, sparklines, grid snapping, minimap and traffic dots; export/import and backup/restore.                                               | `src/components/Settings.tsx`, `src/components/VendorPanel.tsx`; Source/test. Cloud names/specs are illustrative, not real resource provisioning.                        |
| Accessibility   | Focus management, keyboard navigation, live announcements, reduced motion, contrast-aware themes and non-colour explanations.                                                                                                     | Imported component/interaction/contrast tests; Source/test.                                                                                                              |
| Integrations    | Worker short-link service, optional VS Code webview/extension and MCP tooling source retained.                                                                                                                                    | `worker/`, `extension/`, `mcp/`; Backend gap/not deployed or separately validated.                                                                                       |

### All 33 simulated components and their controls

Shared controls, when present: `instances` = fleet size, `capacity` = concurrent
slots (or the documented component-specific limit), `serviceMs` = service time,
`serviceCv` = service-time variation, `queueLimit` = waiting/retention limit,
`errorRate` = random failure probability, `timeoutMs` = deadline, and `retries`
= retry limit. Remaining identifiers below are the exact configuration keys;
the Inspector supplies their human-readable labels, units, bounds and help.
Conditional fields appear only for relevant traffic/policy choices. Challenge
constraints may lock them. Correctness and vendor controls are additional to
this primary tuning table.

Source of truth: `FIELDS_BY_KIND`, `shownFields`, field specs and correctness
sections in `src/components/Inspector.tsx`; defaults/types in `src/sim/`.

Additional Inspector controls: `chargeable` (“Each finished call charges money”),
`idempotencyKeys` (ignore successful repeats; in-flight calls refuse retries),
replica `freshReads` (route lagging reads to the primary), and disk-backed
`flushEveryMs` (durability/flush timing). Fault actions, vendor instance specs,
derived headroom and component-specific live statistics remain available.

| Palette component  | Kind           | Primary tuning controls                                                                                        |
| ------------------ | -------------- | -------------------------------------------------------------------------------------------------------------- |
| Client             | `client`       | `rps`, `traffic`, `trafficPeriodS`, `burstSize`, `herdSize`, `herdSpreadMs`, `keySkew`, `timeoutMs`, `retries` |
| Load balancer      | `lb`           | `instances`, `capacity`, `serviceMs`, `queueLimit`                                                             |
| Service            | `service`      | `instances`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`, `errorRate`, `timeoutMs`, `retries`           |
| Cache              | `cache`        | Legacy `hitRate`; opt-in `cacheReadPolicy`, `cacheWritePolicy`, `readFraction`, `cacheTtlMs`, `cacheInvalidationMs`, `cacheStaleMs`, `flushDelayMs`; shared instance/slot/service/queue controls. |
| Database           | `db`           | `readFraction`, `instances`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`, `lockMs`, `errorRate`         |
| Queue              | `queue`        | `queueLimit`, `serviceMs`                                                                                      |
| Worker             | `worker`       | `instances`, `capacity`, `serviceMs`, `serviceCv`, `errorRate`                                                 |
| Read replicas      | `replica`      | `replicaCount`, `replicationLagMs`, `readFraction`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`         |
| Sharded store      | `shard`        | `shardCount`, `shardCapacity`, `hotKeyFraction`, `serviceMs`, `serviceCv`, `queueLimit`                        |
| Autoscaler         | `autoscaler`   | `targetUtil`, `minCapacity`, `maxCapacity`, `cooldownMs`, `scaleStepPct`, `warmupMs`                           |
| Region             | `region`       | `regions`, `activeRegion`, `failoverMs`                                                                        |
| CDN                | `cdn`          | `hitRate`, `instances`, `capacity`, `serviceMs`, `queueLimit`                                                  |
| Rate limiter       | `ratelimiter`  | `rateLimitRps`, `burst`                                                                                        |
| Circuit breaker    | `breaker`      | `errorThreshold`, `windowMs`, `openMs`, `halfOpenProbes`                                                       |
| Object storage     | `objectstore`  | `prefixRps`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`, `errorRate`                                   |
| Search index       | `searchindex`  | `readFraction`, `indexMs`, `indexLagMs`, `instances`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`       |
| Time-series store  | `timeseriesdb` | `rangeQueryFraction`, `rangeQueryMs`, `instances`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`          |
| Graph database     | `graphdb`      | `traversalDepth`, `instances`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`                              |
| Cold storage       | `coldstorage`  | `capacity`, `serviceMs`, `serviceCv`, `queueLimit`                                                             |
| Vector database    | `vectordb`     | `indexSizeK`, `recallTarget`, `instances`, `capacity`, `serviceMs`, `serviceCv`, `queueLimit`                  |
| Stream broker      | `streambroker` | `partitions`, `queueLimit`, `serviceMs`                                                                        |
| Pub-sub topic      | `pubsub`       | `serviceMs`; subscribers and amplification are determined by wiring                                            |
| WebSocket gateway  | `websocket`    | `connectionMs`, `instances`, `capacity`, `serviceMs`, `serviceCv`                                              |
| API gateway        | `apigateway`   | `rateLimitRps`, `burst`, `authFailRate`, `instances`, `capacity`, `serviceMs`, `queueLimit`                    |
| Sidecar proxy      | `sidecar`      | `outlierAfter`, `openMs`, `retries`, `timeoutMs`, `instances`, `capacity`, `serviceMs`, `queueLimit`           |
| Lambda             | `lambda`       | `coldStartMs`, `keepWarmMs`, `maxConcurrency`, `serviceMs`, `serviceCv`, `errorRate`                           |
| Cron job           | `cron`         | `intervalMs`, `batchSize`                                                                                      |
| Bulkhead           | `bulkhead`     | `bulkheadMax`, `bulkheadMode`, `acquireQueueMax`, `acquireTimeoutMs`                                           |
| Retry queue        | `retryqueue`   | `retries`, `timeoutMs`, `instances`, `capacity`, `serviceMs`, `queueLimit`                                     |
| Transcoder         | `transcoder`   | `renditions`, `instances`, `capacity`, `serviceMs`, `serviceCv`, `errorRate`, `queueLimit`                     |
| Edge compute       | `edgecompute`  | `edgeShare`, `cpuMsCap`, `instances`, `capacity`, `serviceMs`, `queueLimit`                                    |
| Write-behind cache | `writebehind`  | `flushDelayMs`, `capacity`, `serviceMs`, `queueLimit`                                                          |
| Load shedder       | `loadshedder`  | `rateLimitRps`, `burst`, `lowPriorityShare`, `priorityReserve`                                                 |

### Complete simulator catalog

**Examples (25, including one personal addition):** `cache-policies`, `single-server`, `load-balanced`, `cache-aside`,
`async-workers`, `retry-storm`, `cdn-origin`, `rate-limited-api`,
`circuit-breaker`, `read-replicas`, `sharded-database`, `autoscaling-service`,
`multi-region`, `full-stack`, `specialised-stores`, `event-driven`,
`resilient-delivery`, `checkout`, `discord`, `uber`, `netflix`, `spotify`,
`twitter`, `stripe`, `whatsapp`.

**Challenges (18):** `hold-the-line`, `keep-it-warm`, `nothing-looks-busy`,
`five-seconds`, `not-everyones-problem`, `say-no-fast`, `buying-time`,
`lose-a-machine`, `lose-a-region`, `checkout-rush`, `one-hot-key`,
`saved-then-lost`, `loud-and-quiet`, `charged-twice`, `lost-on-the-way-back`,
`sent-twice`, `saved-then-gone`, `read-your-own-write`.

**Incidents (6):** `incident-s3-2017`, `incident-cloudflare-2019`,
`incident-aws-2021`, `incident-coinbase-2026`, `incident-discord-2023`,
`incident-coinbase-2021`. These are educational reconstructions, not access to
the named companies' infrastructure or incident data.

### Simulator keyboard coverage

Space play/pause; S step; brackets speed; F failure search; L keyboard connect;
double-click rename; Ctrl+D duplicate; Alt-drag copy; Delete/Backspace delete;
Ctrl+C/X/V clipboard; Ctrl+Z and Ctrl+Shift+Z/Ctrl+Y history; Shift-click/drag
multi-select; Ctrl+A select all; arrows/grid and Shift-arrows/pixel nudging;
G grid; Ctrl-drag snap bypass; Escape cancel/deselect; N note; B section;
Ctrl+=/- zoom; Ctrl+0 100%; Shift+1 fit; Shift+2 selected fit;
Ctrl-wheel pointer zoom; Space-drag/middle-drag pan; C components; M charts;
I Inspector; ? glossary; F6/Shift+F6 area navigation; Up/Down component rail;
Ctrl+/ shortcuts; Ctrl+K command palette; Shift+P presentation; X/W/R
crash/slow/repair while presenting. Platform-specific modifier labels are
handled by the imported `modKey` helper.

## Learning and interviews / System Designer

| Feature family        | Included features                                                                                                                                                                                                                                                                                                               | Implementation / evidence                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning              | 41 lessons, short guided introduction, deeper/lead-the-design tracks, interactive concept lessons, progress/completion and writing-before-model-answer exercises.                                                                                                                                                               | `learning/content/lessons/`, `learning/ui/`; Source/test; Browser 41-lesson catalog.                                                                                                                                                |
| Practice bank         | 82 complete problems, Easy/Medium/Hard difficulty, 15 industry groups, search, industry/concept/difficulty/status filters, sorting, random selection and decision drill.                                                                                                                                                        | `learning/content/problems/`, `learning/ui/shell/practice.js`; Source/test; Browser count/filter and URL shortener.                                                                                                                 |
| Problem workflow      | Ask clarification questions, requirements, worked arithmetic and estimates; draw architecture, inspect components/connections, start traffic day, watch outcomes and review a debrief.                                                                                                                                          | `learning/ui/play/`; Browser guided clarification/numbers/drawing and completed simulation.                                                                                                                                         |
| Building blocks       | 99 component definitions across 9 categories; toolbar search, placement/connection, component-specific tiers/units/zones/regions/knobs, inspection, auto-layout/fit, annotations, selection, clipboard and history.                                                                                                             | `learning/sim/catalog.js`, `learning/render/`, `learning/ui/play/`; Source/test; Browser places a complete reference graph and configures its knobs.                                                                                |
| Workload and failures | Deterministic 10-second flow ticks; daily demand, spikes, outages, recovery, retries, scheduled events, bottlenecks and approximate saturation/latency.                                                                                                                                                                         | `learning/sim/`; Source/test; Browser complete warmup and full day.                                                                                                                                                                 |
| Metrics               | Offered/served/dropped traffic, latency, reliability, data safety, monthly component/usage/egress cost, budget, stars and separate score dimensions.                                                                                                                                                                            | `learning/sim/`, `learning/ui/play/`; Browser scores and itemized cost.                                                                                                                                                             |
| Replay and comparison | Repeat the same workload, compare prior designs/runs, evidence-based reference designs, progressive Easy warmup/full-day and twists where applicable.                                                                                                                                                                           | `learning/sim/`, `learning/ui/play/play.js`; Browser identical full-day score AND itemized cost after reset on the unchanged graph. Warmup and full day are deliberately different scenarios.                                       |
| Reference designs     | 93 authored alternative designs across the 82 problems, hints/editorials, measured examples, tradeoffs and design-specific feedback.                                                                                                                                                                                            | `learning/content/problems/`; Content runner verifies every problem's first reference design meets its targets.                                                                                                                     |
| Daily challenge       | Date-seeded scenario, local personal best and streak, score/result cards, “Beat my design” sharing and replay verification.                                                                                                                                                                                                     | `learning/ui/shell/`, `learning/ui/play/`, `learning/sim/`; Source/test; not claimed as a separate manual end-to-end check.                                                                                                         |
| Sandbox               | All parts, configurable traffic and events, unrestricted drawing, five saved slots and supported shared designs.                                                                                                                                                                                                                | `learning/ui/play/`, `learning/ui/shell/`; Source/test.                                                                                                                                                                             |
| Interviews            | Medium/Hard mode; 45-minute advisory timer, candidate-led questions/requirements/estimates, independent drawing, one uneditable simulation, graph/run-specific follow-ups, writing before reveal, committed hold/fail predictions, measured replay/counterexamples, local interview report and separate prediction/day records. | `learning/ui/play/interview.js`, `learning/ui/defense.js`, `learning/content/problems/defense-claims.js`; Browser completes preparation, run, follow-ups, prediction replays and report save. Timer is advisory, not a server exam. |
| Guides                | Study, architecture, concept, interview and two-week-plan reading pages; generated problem/lesson references, preview illustrations and daily reading pages.                                                                                                                                                                    | `learning/tools/`, generated release; Browser two-week guide returns readable HTML.                                                                                                                                                 |
| Progress and sharing  | Local solved status/stars/lesson progress, personal display name, recent/best runs, saved sandbox designs, supported URL shares, result images and export/import/reset progress.                                                                                                                                                | `learning/ui/`, `learning/compete/`; Source/test. Local storage is independent from the simulator's storage.                                                                                                                        |
| Settings              | High contrast; system/reduced/full motion; auto/high/medium/low graphics; event auto-slow; generated sound, master volume and ambient hum; request shapes/colours legend; profile; backups; keyboard reference.                                                                                                                 | `learning/ui/shell/settings.js`; Browser rendered controls; not every audio/graphics permutation manually exercised.                                                                                                                |
| Accounts              | OAuth sign-in, cross-device sync and public leaderboards exist in upstream account/API source.                                                                                                                                                                                                                                  | `learning/account/`, `learning/api/`; Backend gap. `API_LIVE=false`; sign-in is removed from dynamic/static navigation and the limitation is visible in settings.                                                                   |
| Feedback/analytics    | Upstream feedback, email and cookie/analytics interfaces are not reused as pretend services. Personal issue reporting and an honest privacy notice replace their links.                                                                                                                                                         | `learning/ui/shell/settings.js`, `tools/build-learning.mjs`; intentionally disabled/not parity with a hosted collection service.                                                                                                    |

### Catalog completeness

Problem industry counts: core 7; media 8; social 5; fintech 10; health 7;
civic 4; mobility 5; travel 4; IoT 5; AI 4; games 4; productivity 5;
commerce 3; telecom 3; developer tools 8. Total: **82**. Individual problem
titles, requirements, workloads, targets, reference designs and concept tags
are preserved in `learning/content/problems/index.js` and its imported groups.
All **41** lesson definitions are preserved in `learning/content/lessons/`.
All **99** building blocks and their exact numeric controls/cost models are in
`learning/sim/catalog.js`; category sizes are 7, 13, 9, 21, 9, 13, 10, 8, 9.
Catalog references are exhaustive, not selected replacement content.

### Learning keyboard coverage

Enter starts the day; Space pauses/resumes; 1-7 chooses 0, 0.25, 0.5, 1, 2, 4,
8x speed; F fits; / searches; H hints; M mutes; Ctrl+Z/Ctrl+Shift+Z undo/redo;
Delete removes; Ctrl+D duplicates; Escape cancels. These bindings are distinct
from the simulator's (for example F fits here but runs failure search there).

## Verification evidence

The actual reference interface was inspected for both sites. System Designer's
live practice/learning catalogs, URL-shortener clarification/estimation/drawing
and settings were observed; no reference account login or public submission
was performed. The imported source, not marketing claims alone, established the
inventory.

| Check                           | Observed outcome                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulator suite                 | 201 files, 3,414 tests passed, including the personal Worker checks.                                                                                                               |
| Navigation / backup / sharing   | 5 files, 57 targeted tests passed.                                                                                                                                               |
| Learning model selftest         | 194 passed, 0 failed.                                                                                                                                                             |
| Learning content runner         | 82 problems, 41 lessons, 93 designs; all 82 first designs pass; no content issues.                                                                                                |
| Production build                | TypeScript, Vite and learning esbuild release succeed; both compiled apps and reading pages exist in `dist`. Vite reports a large preserved app chunk.                            |
| Lint                            | Exit 0; imported learning source still produces existing warnings. This is not a warning-free refactor.                                                                           |
| Local compiled browser smoke    | Headless Edge in a fresh, visible isolated context; zero uncaught page errors and zero failing same-site asset responses.                                                         |
| Overload / failure              | Representative run: baseline p99 about 139ms; at 100x load p99 about 540ms and 96% failing; crashed database gives no replies and 100% failing. Exact synthetic timings can vary. |
| Replay                          | Full-day score, stars and itemized monthly cost deep-equal after reset of the same graph. Initial warmup has different demand and is not compared as an identical workload.       |
| Complete interview              | Candidate questions/requirements/estimates, advisory clock, one simulation, run-specific defense, committed replay predictions and saved local interview report exercised.        |
| Paths / persistence             | Root `?example=single-server`, encoded share/reload, presentation, workbench navigation, practice/learn/settings, glossary/privacy and two-week guide exercised.                  |

`tools/smoke-site.mjs` is a reproducible check, not a claim that every toolbar
combination and all 82 problem paths were clicked. Upstream learning's separate
Puppeteer interview harness was not run: its optional `puppeteer-core`
dependency is absent. The existing Playwright-based complete interview smoke
provides the compiled-site alternative.

## Deliberate limits and remaining hosted gaps

### Personal cache-policy extension

The primary event simulator now adds **Cache policies and freshness**
(`?example=cache-policies`) without changing legacy cache or Write-behind
designs. `src/sim/behaviour-cache.ts` and `cache-policies.test.ts` cover:

- Cache-aside uses the API-to-database edge for misses; read-through uses
  cache-to-database. The direct API-to-that-database fanout is suppressed, so
  a hit performs no database work and a miss makes one call. Unrelated API
  dependencies are retained.
- Read/write classification remains the same throughout the backing request.
  Writes are not counted as cache read misses. Write-through waits for a
  database response and updates memory; write-around writes the database
  without populating memory and lets invalidation remove older versions;
  write-back acknowledges volatile memory and flushes real delayed work.
- TTL expiry refetches; stale-while-revalidate serves within a bounded expired
  window while one background read per key runs, then blocks after hard
  expiry. A failed read does not warm memory. Failed refreshes and flushes
  are surfaced; crash/recovery cannot resurrect a destroyed pending buffer.
- Database commits, including writes through a separate API, advance actual
  per-key versions. Clean hits are compared with those versions. Metrics
  show read hit/miss and stale rates, clean-hit freshness, retained-key lag,
  refresh outcomes, dirty reads/writes, oldest dirty residence and flush
  outcomes. Dirty buffered reads are excluded from committed freshness.
- Find the problem names observed stale reads or flush failures. The
  Inspector distinguishes observed evidence from a static volatile-buffer
  risk and offers user-reviewed invalidation/write-policy patches, with
  explicit latency/load/durability tradeoffs. Applying a remedy is not a
  proof; replay and compare using the existing seeded run/fault schedule.
- Policy controls survive encoded sharing, file/clipboard/local backups and
  MCP design validation; malformed policy/timing imports are rejected.

**Model boundaries:** 64 keys, one ordinary Database per managed cache branch,
no payload values or cache-size eviction, no separate cache-population network
round trip, no coalescing ordinary cold misses, and no replicated write buffer.
Invalidation is an idealized notification delay, not packets sent through a
coherence protocol. A cache crash clears memory; writes already executing at
the database may still commit. “Flush success” means the database's modeled
acknowledgment, not an unconditional disk-durability guarantee. The learning
workbench keeps its distinct aggregate cache model; its preset hit/staleness
percentages are not relabeled as these per-key measurements.

**Compiled-browser evidence:** `tools/smoke-cache.mjs` exercises all policy
controls, measured stale versions and a reviewed remedy, actual background
refresh traffic, dirty-write crash loss, recovery and encoded-share reload.
A recorded 250 requests/s run changed from 131 stale hits/s and 37% clean-hit
freshness to 0 stale hits/s and 100% after immediate invalidation; read misses
increased from 22/s to 41/s, exposing the tradeoff. These are observations of
that synthetic run, not vendor benchmarks or an identical-workload causal
comparison. Focused engine cases separately verify deterministic replay,
single-call misses, delegated-link retries, expiry, independent writers,
background completion accounting and no resurrection after crash/recovery.

**Subsequent requested stages (not claimed implemented by this cache release):**
explicit region/zone placement and tunable directional network profiles;
scoped seeded chaos with baseline/hypothesis and recovery comparison; broader
evidence-backed diagnosis/remedies; Linux scoped resource budgets and
Kubernetes scheduling/readiness/resource behavior. Existing manual network
faults, Region failover, autoscaling and fleet-card rendering remain present.
No actual infrastructure, Linux tuning, cluster provisioning or paid hosting
is involved.

1. **Accounts and public leaderboards:** a static site cannot run
   `learning/api/`. Separate Node hosting, OAuth configuration and an explicit
   deployment/privacy decision are required. None was provisioned.
2. **Encrypted short links:** the optional `worker/` backend requires separate
   hosting/storage and `VITE_SHARE_API`. It is not configured. Fragment
   sharing is encoded, not encrypted; large designs use file export.
3. **Separate engines:** simulator measured request percentiles and learning's
   approximate flow-based latency/cost cannot be equated. Their formats are not
   interchangeable and there is no invented cross-engine import.
4. **Local data:** clearing browser site data loses saved progress/designs.
   Export backups for retention; there is no cross-device recovery promise.
5. **Educational scope:** simulated capacities/prices/incidents are simplified.
   Keyword/topic checks are not AI grading or proof that interview prose is
   correct. Replay predictions assess modeled consequences, not production safety.
6. **Optional integrations:** extension, MCP and backend source is retained but
   not separately installed/deployed. No cloud resources, hosted AI service or
   costs were introduced.

These gaps prevent an honest claim of full hosted-service parity. The two
complete local learning/simulation workbenches remain usable without accounts.

### Requested hosted-feature implementation

The later request to implement the missing services is covered by
[HOSTED-FEATURES-PLAN.md](HOSTED-FEATURES-PLAN.md). The existing backends are now
adapted to configurable personal origins/OAuth return paths, opt-in frontend
builds, same-site deployment, server-replayed public boards and encrypted
Worker storage. They are implemented, **not cloud-deployed**.

The adapted Node API passes 114 tests. Worker/crypto/store checks pass 40 tests;
the Worker type-check and Wrangler dry build pass with an explicit placeholder
for the owner's KV namespace. A compiled hosted-browser smoke passes actual
loopback test-provider sign-in, two isolated progress-sync contexts, server
score replay/public board and session revocation. This is not real OAuth or
cloud verification.

The final simulator/Worker suite passes 201 files and 3,414 tests. The static
build retains disabled hosted features and truthful notices pending approved
provider/domain/OAuth setup. No upstream backend domain, resource binding or
simulated hosted-account preview is used.

### Published website verification

The compiled website is live at
<https://nuthanreddy.github.io/system-design-simulator/>.
Application release `12bb00282213ae7ec811f00bc1c479dd48be6e5e` passed the
[GitHub Pages workflow](https://github.com/NuthanReddy/system-design-simulator/actions/runs/45608904801)
and deployed successfully.

The same browser smoke then passed against the public HTTPS website, not only
the local preview: zero uncaught page errors or failed same-site assets,
100x offered load, database failure, encoded sharing/reload, presentation,
82-problem filtering, 41 lessons, identical full-day replay and itemized cost,
complete interview/report, settings and static reading without JavaScript.
This verifies the static release; personal OAuth, cross-device hosted sync,
public boards and encrypted short-link storage still require the owner setup
described in the hosted-feature plan.
