# BlueDental — Test Policy

## What counts as verification

A feature is `VERIFIED` only when it has been exercised through the real path:

```
React (Vite) → real HTTP → ASP.NET Core → auth → application layer
             → EF Core → real PostgreSQL → real response → rendered UI
```

Unit tests, mapping tests and contract tests are useful regression nets. They are
**not** runtime acceptance evidence and never move a feature to `VERIFIED`.

## Test layers in this repo

| Layer | Project / path | What it proves | Counts as acceptance? |
|-------|----------------|----------------|-----------------------|
| Domain | `BlueDental.Domain.Tests` | Invariants and state machines in isolation | No |
| Application contract | `BlueDental.Application.Tests` | AppService surface, `[Authorize]` presence | No |
| EF mapping | `BlueDental.EntityFrameworkCore.Tests` | Table names, owned types, indexes | No |
| API convention | `BlueDental.HttpApi.Host.Tests` | Routes, `[RemoteService]`, auth attributes | No |
| **Acceptance (E2E)** | `BlueDental.FE/e2e/*.spec.ts` | Real browser → real API → real PostgreSQL | **Yes** |

## Rules for acceptance tests

Forbidden in `BlueDental.FE/e2e`:

- `page.route()`, `route.fulfill()`, `route.abort()`
- MSW or any interception of BlueDental business APIs
- injected access/refresh tokens, faked `localStorage` auth
- faked permissions or clinic-branch context
- hard-coded successful business responses

Required:

- log in through the real login screen (`e2e/fixtures/auth.ts`)
- assert on visible UI behaviour, not just that a heading rendered
- verify persistence by reloading the page after a write
- prefer asserting a **delta** over an absolute total — the branch accumulates
  data across runs, and an absolute assertion silently rots

`assertRealApiTraffic()` in the fixture fails the test if the expected API call
did not actually reach the server, so an accidental mock is loud rather than
quiet.

## Running the acceptance suite

Stack (from the repo root):

```bash
docker compose up -d postgres redis          # POSTGRES_PORT / REDIS_PORT if the defaults clash
dotnet run --project BlueDental.BE/src/BlueDental.DbMigrator     # migrations + seed
ASPNETCORE_URLS=http://localhost:5019 \
  dotnet run --project BlueDental.BE/src/BlueDental.HttpApi.Host --no-launch-profile
cd BlueDental.FE && npm run dev              # Vite on :5173, proxies /api to :5019
```

Then:

```bash
cd BlueDental.FE
E2E_BASE_URL=http://localhost:5173 npx playwright test
```

Seeded credentials come from `BlueDental.DbMigrator/appsettings.json`
(`admin` / `Admin@123456`); override with `E2E_USER` / `E2E_PASSWORD`.

## Impact-based retest levels

| Level | Trigger | Action |
|-------|---------|--------|
| 0 | Docs, comments, formatting | No retest |
| 1 | CSS, spacing, icons, tokens | Visual smoke |
| 2 | One feature's FE/API/service/validation | That feature's acceptance spec |
| 3 | Shared dependency: auth, permissions, branch scope, API client, DbContext | Every dependent feature's spec |
| 4 | Release candidate, auth redesign, major architecture change | Full suite |

## Completion reporting

Before calling a feature complete, report: feature ID, status, verified commit,
backend result, real-browser result, persistence result, permission result,
branch-isolation result, workflow result, retest level, affected features,
remaining blockers. Never describe a mocked test as runtime verification.
