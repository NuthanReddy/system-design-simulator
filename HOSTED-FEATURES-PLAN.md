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

## Concrete deployment decision

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
provider and custom-domain setup remain owner-required deployment blockers.
