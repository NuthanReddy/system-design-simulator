# System Design Simulator

Build a system, overload it, inject failures, and practise explaining the design.
This personal, account-free website combines two MIT-licensed workbenches without
replacing either simulation engine.

**Website:** https://nuthanreddy.github.io/system-design-simulator/

**Learning and interviews:** https://nuthanreddy.github.io/system-design-simulator/learning/

## What is included

| Workbench         | Features                                                                                                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulator         | 33 simulated component types, notes/sections, editable connections, individual-request discrete-event simulation, latency/goodput/error charts, load and failure experiments, 26 examples, 18 challenges, 6 incident stories, a 50-step learning path and 119 glossary entries.                                            |
| System Design Lab | 99 building blocks, 82 practice problems across 15 industries, 41 lessons, 93 measured reference designs, guided clarification/estimation/drawing, traffic-day simulation, daily challenges, sandbox, timed Medium/Hard interviews, evidence-based defense, cost/reliability/latency/data-safety scoring and study guides. |
| Personal workflow | Browser-local progress and saved designs, supported URL sharing and file backups, presentation mode, keyboard controls, accessibility/motion/sound settings, and navigation between the workbenches.                                                                                                                       |

See [FEATURE-PARITY.md](FEATURE-PARITY.md) for the full feature audit,
component-specific controls, source locations, verification evidence and gaps.

## Design and test cache policies

Open [Cache policies and freshness](https://nuthanreddy.github.io/system-design-simulator/?example=cache-policies).
The API connects to both cache and database, but the managed cache owns that
database branch: hits skip the database and misses make one backing call, not a
second parallel API call. Other API dependencies still fan out.

Select **Policy Cache** to choose cache-aside/lazy loading, read-through
("cache-through"), or stale-while-revalidate, independently of write-through,
write-around or write-back/write-behind. TTL, invalidation lag, stale window,
read fraction and flush residence change actual routing, version visibility
and acknowledgments. The legacy probabilistic cache and original Write-behind
component remain compatible with existing designs.

Compare measured hits/misses, stale committed versions, freshness among clean
hits, background refreshes, dirty writes, flush failures and lag in milliseconds.
**Find the problem** and the cache Inspector explain observed freshness/write
failures separately from static durability risks, with explicit, user-applied
remedies and their tradeoffs. Replaying a remedy is necessary; a suggestion is
not proof that an arbitrary architecture is correct.

This is a 64-key educational version model, not a payload store or distributed
coherence protocol. Cache-aside uses the API-to-database link; read-through and
background refresh use the cache-to-database link. Connect one cache to one
ordinary Database; a separate cache-population network round trip, cache
eviction/capacity in bytes, coalescing ordinary cold misses, and replicated
write buffers are not modeled. Invalidation notification is an idealized
configured lag; network faults affect actual database/refresh calls, not that
notification. Dirty reads are shown separately, not called fresh durable data.

## Regions, zones and network paths

Open [Zones, regions and network faults](https://nuthanreddy.github.io/system-design-simulator/?example=network-geography).
Select a component's **Region and zone** section to opt into placement and tune
outgoing same-zone/inter-zone/cross-region propagation. Both endpoints must be
placed. The starting **0.5 / 2 / 80 ms one-way** profiles are illustrative, not
cloud benchmarks; requests and replies each pay their crossing.

Select a connection to override request/reply delay or jitter, inject asymmetric
reply loss, and read measured crossing/complete-call means. Existing cable cuts,
request loss, reply cuts, timeouts and retries remain available. A lost reply
does not undo a committed write. Unplaced legacy links retain their original
request-only delay. Placement is not data migration or automatic geographic
replication; bandwidth queues and TCP congestion are not modeled.

**Hosted-service limitations:** GitHub Pages serves static files, not APIs.
Cross-device account sync, OAuth sign-in, public leaderboards and encrypted short
links are not configured. Browser-local progress, fragment links and file
exports remain available. Backend source is retained, but no upstream private
service, credentials, analytics or paid infrastructure is used.

## Run locally

Install [Bun](https://bun.sh/) and Node.js. CI pins Bun 1.3.11 and Node 24.

```powershell
bun install --frozen-lockfile
bun run dev
```

Vite uses the deployment base `/system-design-simulator/`. Its development server
serves the simulator; the learning workbench is included in the production build:

```powershell
bun run build
bun run preview -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173/system-design-simulator/?example=single-server
or http://127.0.0.1:4173/system-design-simulator/learning/.

The build uses the learning project's supported esbuild release pipeline and
retains its bundled preview images. It publishes both compiled applications to
`dist/`, including generated lesson/problem/guide pages. It does not publish the
repository itself as the website.

The requested hosted features are also implemented using the retained Node API
and encrypted Worker store. They are **not live** until provider/domain/OAuth
setup is completed. See [HOSTED-FEATURES-PLAN.md](HOSTED-FEATURES-PLAN.md)
for architecture, configuration, costs, tests and deployment gates.

## Checks

```powershell
bun run test
bun run typecheck
bun run lint
node learning\sim\selftest.mjs
node --test learning/api/test/*.test.js
bunx tsc -p worker\tsconfig.json
Push-Location learning
node tests\content-run.mjs
Pop-Location
```

With the production preview running and Microsoft Edge installed:

```powershell
bun run smoke:site
bun run smoke:cache
```

The smoke harness uses existing Playwright tooling and an isolated browser
context. It checks overload/crash behavior, share/reload, presentation,
navigation, catalogs, repeated workload score/cost equality, a complete
interview with committed replay predictions, settings and static routes. Set
`SITE_URL` to check the deployed site and `SMOKE_OUT` to choose where screenshots
and the JSON report are saved; otherwise evidence goes to the OS temporary
directory.

## GitHub Pages

[The Pages workflow](.github/workflows/pages.yml) tests and builds on pushes to
`main`, uploads only `dist`, and deploys using GitHub's Pages actions. The
repository's **Settings > Pages > Source** must be **GitHub Actions**.
The workflow can also be started manually. No deployment token is committed.

The default base, generated URLs and navigation target this repository.
For a custom domain, configure `SITE_BASE`, `SITE_ORIGIN` and `SD_SITE_URL`
together; for optional hosted features also configure `SD_API_URL`,
`SD_API_LIVE=1` and/or `VITE_SHARE_API`. These are public GitHub Actions variables,
not secrets. Backend credentials belong only in the backend provider.

## Models and privacy

The simulator measures individual synthetic requests, including finite slots,
queues, retries, downstream waiting and injected faults. System Design Lab uses
an approximate deterministic flow/capacity model with 10-second ticks and
illustrative public pricing. Their latency and scoring definitions are different;
neither is a production benchmark, cloud bill quote or guarantee of correctness.

The two workbenches intentionally retain separate design formats and progress
stores. Designs cannot be directly imported from one engine into the other.
Clearing site data loses local progress unless it was exported. Share fragments
are encoded, **not encrypted**; do not put secrets or private production
information into diagrams or shared links. See the site's privacy page.

## Source and licenses

Adapted from:

- [Breakscale](https://github.com/workersio/breakscale), MIT, Copyright 2026
  Breakscale contributors; source revision
  `a75b3f31859ce86750ef33f2252773d1f1ae312b`.
- [System Designer](https://github.com/adityareddy-dev/system-designer), MIT,
  Copyright 2026 Aditya Reddy; source revision
  `9eccaa31d35c162d72836b396d52a2c2a295193a`.

Original [LICENSE](LICENSE), [learning/LICENSE](learning/LICENSE) and bundled
font licenses are retained. [.github/UPSTREAM.json](.github/UPSTREAM.json)
records the exact provenance. Branding, repository links, static hosting,
privacy notices and navigation were adapted; original authored learning content
and MIT attribution are preserved. Optional backend, extension and MCP source
is included for completeness, not represented as a deployed service.
