# Hosted features: implementation and deployment plan

The user requested account/progress sync, public leaderboards and encrypted
short links after accepting the initial static release. Keep GitHub Pages live
while implementing these optional services. **Implementation is not deployment.**

## Architecture and sequence

1. Reuse the MIT Node 24 API in `learning/api/`: SQLite users/sessions/progress,
   GitHub/Google verification, conflict-safe progress merging, server-replayed
   scores, rate limits and public boards. Make site URL, CORS and OAuth callback
   configurable for this repository and preserve its security checks.
2. Reuse the MIT Worker in `worker/`: browser AES-GCM encryption, random blob
   identifiers, KV ciphertext storage and write-rate limits. Never send the
   fragment key to the server. Remove upstream domain/resource bindings.
3. Add validated, opt-in build configuration. A static build must make no
   account requests. Configured services must disclose outages and never report
   local preview sign-in as real sync.
4. Run API integration tests, Worker/crypto/store tests and compiled browser
   checks. Publish static files independently; enable hosted endpoints only
   after actual health/auth/storage/replay checks.
5. Provision only after the owner chooses hosting and completes provider/OAuth
   setup. Put secret values in the provider's secret store, never the repo,
   browser bundle, chat or Pages variables.

## Current decision: investigate free hosting

The owner selected **"explore free options"** for both hosting and domain.
There is **no paid-provider or purchased-domain approval**. The earlier paid
proposal below is not the selected path; `render.yaml` still describes that
older proposal and must not be applied as a free deployment.

**Recommended achievable $0 hobby path:** a Render Free Node web service
serving the compiled frontend and existing API routes on its single free
`onrender.com` origin, plus Neon Free Postgres for durable records, and the
separate Cloudflare Free Worker/KV for encrypted links. Keep GitHub Pages as
the unchanged, account-free deployment. The hosted-capable copy would use a
different provider URL, not silently enable cross-site cookies on Pages.

This is a **feasibility recommendation, not an already implemented or deployed
free architecture**. It needs a proper asynchronous database adapter and
same-origin static serving first. It trades cold starts and quota interruptions
for no subscription or domain purchase; it is not an always-on production SLA.
Do not migrate the backend or create resources until the owner selects this
option. Research and replay measurements below leave existing runtime code,
the Pages workflow and the live frontend configuration unchanged.

## Earlier paid proposal (not selected or approved)

**Recommended compatible option:** a persistent Node host (Render configuration
is included as a proposal), Cloudflare Worker + KV, and **same-site HTTPS custom
domains** for the website and account API, e.g. `app.example.com` and
`api.example.com`. This preserves the upstream HttpOnly/Secure/SameSite=Lax
cookie design. The website can still be served by GitHub Pages on its custom
domain. Domain examples are placeholders, not provisioned resources.

GitHub Pages on `nuthanreddy.github.io` and an API on `onrender.com` or
`workers.dev` are cross-site: Lax account cookies will not support their
credentialed sync calls. Do not enable that broken combination or weaken cookie
security as a workaround. A same-origin reverse-proxy/static-and-API host is
also compatible, but changes the website's host.

| Service                       | Indicative cost / limits                                                                                                                                                                                                               | Decision and sensitive setup                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Pages                  | Existing public static deployment; no new backend runtime.                                                                                                                                                                             | Keep current URL, or owner configures a same-site custom domain/DNS.                                                                   |
| Render Node + persistent disk | Published baseline $7/month for 512MB service plus $0.25/GB-month disk; 1GB disk example is about $7.25/month, excluding domain/bandwidth/taxes. Free instances have ephemeral storage and are unsuitable for durable SQLite progress. | Owner approves spend/provider, connects repository and stores session/OAuth secrets. Use one instance and one replay worker initially. |
| Cloudflare Workers Free       | 100,000 requests/day; 10ms CPU/invocation.                                                                                                                                                                                             | Owner chooses account and creates the project's KV namespace.                                                                          |
| Workers KV Free               | 100,000 reads/day, 1,000 writes/day, 1GB storage; exceeding quotas can fail requests. Ciphertext reads are cacheable; writes are rate-limited.                                                                                         | Replace the placeholder binding with the owner's namespace ID. No upstream namespace is reused.                                        |
| GitHub OAuth                  | OAuth app configuration, not a hosted authentication bill.                                                                                                                                                                             | Owner registers the exact API callback and enters the client secret directly in the hosting dashboard.                                 |
| Domain                        | Registrar-dependent recurring cost, or an existing owned domain.                                                                                                                                                                       | Owner supplies a domain; changes DNS and OAuth origins directly.                                                                       |

Sources: [Render pricing](https://render.com/render-pricing),
[Render free-service limits](https://render.com/docs/free),
[Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[KV pricing](https://developers.cloudflare.com/kv/platform/pricing/).
Prices/quotas can change; recheck before provisioning. No charge is approved by
this document and no backend resource has been created.

## Implemented configuration

`render.yaml` proposes a single persistent Node service, not an automatically
approved purchase. `learning/api/.env.example` lists the backend settings.
`SITE_URL` is the full learning URL including its path/trailing slash;
`API_URL` is the HTTPS API origin. The API validates these, uses only the
configured CORS origin, and returns OAuth users to the learning path rather
than the host root. `SESSION_SECRET`, OAuth client secrets and any provider
token must be supplied directly through the owner's provider dashboard.

The Pages workflow supports public repository variables:

| Variable         | Default / purpose                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `SITE_BASE`      | `/system-design-simulator/`; use `/` for a root custom-domain deployment.                                |
| `SITE_ORIGIN`    | `https://nuthanreddy.github.io/system-design-simulator`; canonical simulator URL without trailing slash. |
| `SD_SITE_URL`    | `https://nuthanreddy.github.io/system-design-simulator/learning/`; complete learning URL.                |
| `SD_API_URL`     | Empty; configured API HTTPS origin, without a path.                                                      |
| `SD_API_LIVE`    | Empty/off; set `1` only after hosted release gates pass.                                                 |
| `VITE_SHARE_API` | Empty/off; configured encrypted-link Worker HTTPS origin.                                                |

For the same-site domain example, use `SITE_BASE=/`,
`SITE_ORIGIN=https://app.example.com`,
`SD_SITE_URL=https://app.example.com/learning/`,
`SD_API_URL=https://api.example.com`. Configure Pages custom-domain/DNS and the
API custom domain before enabling. URLs are public configuration; they are
not authentication credentials.

Worker setup, **after** the owner approves Cloudflare:
install its dependencies with `bun install --cwd worker`; create an owned KV
namespace using Wrangler; replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` in
`worker/wrangler.toml`; set `ALLOWED_ORIGINS` to the actual website origin;
deploy with `bun run --cwd worker deploy`. Never use upstream bindings.
The Worker refuses missing/foreign write origins, bounds streamed uploads to
256KiB, and keeps ciphertext separate from browser keys.

The personal Node server disables email-marketing queueing. The frontend
disables the upstream simulated account preview and marketing prompts: local
test authentication is labelled and available only on an explicit loopback
development/test backend, never production. Reading pages link to the
workbench's full account menu rather than importing unavailable source modules.

## Code verification

The complete adapted API suite passes **114 tests**, including sessions,
revocation/deletion, progress merge, server-replayed results, leaderboard
eligibility, rate limits and new personal-origin/OAuth-path checks. One upstream
test cleanup ordering was corrected to close SQLite before deleting its
temporary directory on Windows.

Worker + existing browser crypto/store tests pass **40 tests**, including
ciphertext round trip, wrong-key rejection, origin/rate denial and chunked body
limits. These are local tests, not evidence of cloud deployment or real OAuth.

`bun run smoke:hosted`, with the standard production preview running on port
4173, temporarily builds an opted-in learning bundle against a real loopback
test-provider API. It checks browser cookies/CORS, progress in two isolated
contexts, server-replayed public scores and session revocation, then restores
the original build configuration. It uses no real credentials and does not
test or provision a cloud provider.

## Release gates

Require health check, authenticated progress round-trip from two isolated
browser contexts, session revocation/deletion, actual server-replayed board
submission, disallowed-origin rejection, encrypted-link creation/opening and
wrong-key rejection. Test database persistence across restart and restore a
backup before promising cross-device retention.

Until these gates pass, the public build keeps accounts disabled and explains
that hosted sync/boards/short links are unavailable. Browser-local functions
remain usable. Backend code/tests/configuration can be complete while OAuth,
provider/OAuth and compatible same-origin or same-site setup remain
owner-required deployment blockers; a purchased domain is not mandatory.

## Free-hosting feasibility research

Official documentation checked **2026-11-25**. Free allowances can change and
are shared with other workloads where noted. Accounts must remain on Free;
do not attach a payment method, upgrade, purchase a domain or enable paid
overages as part of this proposal.

### Measured trusted replay cost

Measurements used the unchanged Node 24.14.1 code on Windows with a Ryzen 7
PRO 7840U. Each run advances a complete 86,400,000ms traffic day; no fewer
ticks, client-claimed scores, sampled scoring or reduced validation were used.

| Workload | Runs | Median wall ms | p95 wall ms | Median CPU ms | p95 CPU ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Accepted non-editorial practice designs, all 82 problems, three passes | 246 | 98.5 | 158.6 | 109 | 189 |
| Accepted daily variants, November 19-25, 2026 | 7 | 94.1 | 121.7 | 94 | 249 |
| Accepted cap-size designs, three shapes, five passes each | 15 | 278.1 | 357.5 | 297 | 360 |
| All shipped reference designs, engine only | 93 | 213.6 | 379.7 | 266 | 937 |
| Single replay-worker pool, warm | 10 | 120.1 | 144.0 | 188 | 454 |

The cap-size chain, fan-out and branching graphs each pass `prepare()` with
exactly **40 nodes, 60 edges and 2,400 units**, the existing accepted limits.
They are measured stress samples, not a proof of worst-case execution time.
Practice/daily/cap groups run actual `replayPayload()` including decoding,
scenario selection, starter checks, eligibility and server scoring. Reference
designs are normally excluded from boards; their separate engine-only group
measures realistic larger graphs without claiming they are eligible submissions.

`loadGame()` took 194ms wall / 235ms CPU after module imports; the first
worker-pool job including startup took 567ms wall / 954ms process CPU.
Peak process RSS was approximately 310MiB during this harness, not a bound for
the full API. Every measured full replay exceeded 10ms process CPU.

CPU is `process.cpuUsage()` user + system across the process, including V8/GC
threads and the pool worker when used; wall time is `performance.now()`.
These are local observations, **not Cloudflare-billed isolate CPU**, provider
benchmarks, a concurrency/load test or a free-host throughput guarantee.
The host can be shared and these timings are not calibrated. They exclude
database, HTTP, OAuth and network latency. Nevertheless, even the ordinary
accepted median is about 11 times the Workers Free per-invocation budget,
before API/database overhead: there is no evidence for safely fitting it.
Do not promise a 10ms deployment or reduce score honesty to obtain one.

The measurement script and raw per-run JSON are retained with the session
handoff as `benchmark-free-hosting.mjs` and `free-hosting-benchmark.json`;
no benchmark endpoint or production-backend change was added.

### Portability findings

`learning/api/db.js` uses synchronous `node:sqlite` prepared statements,
SQLite PRAGMAs and `BEGIN IMMEDIATE` transactions. `app.js` calls these methods
synchronously, including read/merge/write progress and best-score updates.
`observation-store.js` and `email-capture.js` also use the database wrapper.
Neither a D1 binding nor a Postgres connection string is a drop-in replacement.

`replay.js` creates actual `node:worker_threads` workers with admission caps,
fair queues, startup deadlines, job deadlines and worker termination.
`replay-core.js` loads JSON catalogs from `node:fs`. Current
[Workers Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
lists **both `node:sqlite` and `node:worker_threads` as non-functional stubs**.
Other supported Node APIs do not make those two work. Workers therefore needs
a runtime/storage/queue port as well as a CPU solution; a D1 migration alone
cannot host this retained backend.

### Bounded comparison

| Option | Current free allowances | Fit and material tradeoffs |
| --- | --- | --- |
| Cloudflare Worker + static assets + D1 | 100,000 dynamic requests/day and 10ms CPU/invocation; directly served static assets free/unlimited. D1: 5 million rows read/day, 100,000 written/day, 5GB total. | A single `workers.dev` origin avoids buying a domain and can serve frontend/API together. **Not recommended for the unchanged trusted scorer:** measured CPU mismatch plus unsupported SQLite/worker threads. Substantial port required; D1 quotas count scanned/indexed rows, not just HTTP calls. |
| Render Free Node + Neon Free Postgres | Render: 750 instance-hours/workspace/month, 5GB outbound bandwidth/month on Hobby, 500 build minutes/month. Neon: 100 CU-hours/project/month, 1GB Postgres/project (20GB account total), 5GB project egress/month; 100 Free projects and 10 branches/project. | **Recommended hobby feasibility path.** Retains actual Node workers and full trusted replay. Uses one same-origin web service/free `onrender.com` URL; durable remote database survives Render sleep/redeploy. Requires async SQL/transaction adaptation and static-serving wrapper. Render sleeps after 15 idle minutes, waking in about a minute. Neon scales to zero after 5 minutes, adding database wake latency. |
| Render Free Node + Supabase Free Postgres | Same Render limits. Supabase: 500MB DB, 5GB egress, 2 active Free projects; optional Auth includes 50,000 MAU. | Viable fallback with the same SQL adaptation and same-origin serving requirements. Pauses after one week of inactivity; smaller DB and manual recovery burden make it less attractive for occasional personal use. Supabase Auth is not needed to retain GitHub OAuth and does not eliminate server score replay. No automatic Free database backups. |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[static assets](https://developers.cloudflare.com/workers/static-assets/),
[free provider subdomain](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[Render Free](https://render.com/docs/free),
[Render bandwidth](https://render.com/docs/outbound-bandwidth),
[Render build pipeline](https://render.com/docs/build-pipeline),
[Render provider URL and Node hosting](https://render.com/docs/web-services),
[Neon plans](https://neon.com/docs/introduction/plans),
[Supabase pricing](https://supabase.com/pricing).
Neon CU-hours measure compute size multiplied by running time, not a promise
of 100 always-on service hours; sleeping matters. Using Neon only as a database
does not consume its optional Auth MAU allowance.

Render's local SQLite is **not durable on Free**: files disappear on sleep,
restart or redeploy, and Free cannot attach a persistent disk. Its own Free
Postgres expires after 30 days, so it is not a lasting free alternative.
Render also warns it can suspend Free services with unusually high outbound
service-initiated traffic, including external database calls. Use low-volume
personal traffic, bounded connection pooling and explicit outage messages,
not keep-alive traffic intended to defeat sleep. With no payment method,
Render exceeds bandwidth by suspending service and build-minute exhaustion
stops builds; do not silently upgrade. Neon/Supabase limits and inactivity
can also make sync unavailable: browser-local work and exports remain essential.

The existing encrypted-link Worker has a much smaller role: it stores opaque
ciphertext, not score replay, accounts or progress. Workers KV Free permits
100,000 key reads/day, **1,000 key writes/day** and 1GB stored data; exceeding
the daily allowance rejects those operations. Each successful current POST
writes one ciphertext key, so 1,000 creates/day is only an upper bound before
other account usage. Existing 28-byte minimum/256KiB maximum bodies, browser
AES-GCM, write-origin checks and native rate limiting remain intact. It can
use a free `workers.dev` URL because it needs no session cookie. Actual
provider CPU, KV eventual-consistency read-after-create, error reporting and
rate-limiter binding must still be verified before activation. Storage grows
until cleaned; the current code does not expire blobs or promise permanence.
Cloudflare documents its
[native rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
as approximate and per-location, not a strict global write-quota guarantee.

### Proposed no-paid-services implementation and owner setup

1. **Keep Pages stable.** Do not change its variables or cookie policy. Add an
   optional hosted-capable build, served on the Node service's exact origin.
   No purchased domain is needed. The Pages copy remains account-free; moving
   to another origin does not automatically transfer browser-local progress.
   Use the existing export/import backup flow for a deliberate transfer.
2. **Implement and test durable async storage.** Add a Postgres adapter rather
   than saving SQLite on ephemeral disk. Migrate schemas/SQL and all dependent
   request/startup/cleanup calls to awaited operations. Preserve uniqueness,
   session hashes/expiry/deletion, progress sanitization/merge, best-score
   ordering, attempts and replay verification. Use real database transactions
   with row locking or serializable retries for concurrent progress merges and
   score writes; account for first-write races and identity/name uniqueness.
   A connection string alone or best-effort snapshotting is insufficient.
   Keep the existing SQLite path usable as a separate supported adapter rather
   than breaking the already tested persistent-Node deployment.
3. **Serve both apps and API safely on one Node origin.** Build with
   `SITE_BASE=/`, matching `SITE_ORIGIN`, full `SD_SITE_URL` ending `/learning/`,
   and `SD_API_URL`/`API_URL` equal to that service's HTTPS origin. Retain the
   API's existing `/auth/...`, `/progress`, `/results` and other route paths
   via an explicit API-route allowlist, separate from static directory-index,
   MIME/cache/path-traversal/404 handling. Do not invent an `/api` prefix:
   current URL validation permits an API **origin**, not a prefixed base path.
   Bind the public server to `0.0.0.0:$PORT`; reserve one replay worker initially.
   Keep HttpOnly/Secure/SameSite=Lax cookies, exact Origin validation and OAuth
   state checks unchanged.
4. **Owner-only free account setup.** Select Render Free (not the existing
   Starter blueprint) and Neon Free, choose nearby regions and connect this
   repository. Store the database URL, a stable session secret and GitHub OAuth
   secret directly in the host's secret store. Register the actual
   `https://<service>.onrender.com/auth/github/callback` in the owner's GitHub
   OAuth app; configure its homepage to the hosted learning URL. Configure a
   small TLS connection pool using the provider's recommended pooled URL.
   Do not send secrets through chat or enable the loopback test provider.
   If provider onboarding demands payment details, stop for the owner rather
   than treating this research as permission to supply them or incur charges.
5. **Owner-only link-store setup.** Select Cloudflare Free, create the personal
   KV namespace and verify the configured rate-limiter binding. Set exact
   allowed Pages/hosted origins, deploy on the assigned `workers.dev` URL,
   then configure `VITE_SHARE_API` only after real round-trip checks. No D1,
   paid Workers plan, custom domain or upstream resource is needed for this
   separate ciphertext store.
6. **Run real release gates before calling it live.** Run the API suite
   against Postgres, concurrent merge/identity/score race tests, session
   revocation and forged-score denial. Measure actual Node host cold/warm
   replay CPU/memory, queue fairness, busy/timeouts and startup under its free
   limits; keep the full replay and caps. Check two-browser progress sync,
   OAuth, CORS/origin rejection, encrypted-link round-trip/wrong-key handling,
   database persistence after host sleep/redeploy and a restored owner-held
   database export. Free tiers are not a backup strategy: take secure manual
   exports and verify retention/restore rather than enabling paid backup
   add-ons. If a free limit is insufficient, disclose the limitation and keep
   local functions usable instead of automatically upgrading.

**Status:** feasibility measured and documented; no Postgres adapter,
same-origin host wrapper, provider resources, purchased domain, real OAuth
configuration or billing changes were made by this research. The owner must
select the free providers and complete their sensitive setup before activation.
