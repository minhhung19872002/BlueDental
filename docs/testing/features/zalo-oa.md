# F-16 — Zalo OA Integration (`/tools/zalo-oa`)

Status: `VERIFIED` · Verified commit: TBD · See `01-feature-verification-registry.md`

## Scope

BlueDental-local feature. The reference application (`app.nfcdental.com`) had no
observable Zalo OA configuration data, so the feature was designed from the
`UNKNOWN_REFERENCE_BEHAVIOR` baseline using the Zalo OA API documentation and the
BA requirements. Implemented 2026-09-28.

Sub-feature areas:

- **Zalo OA connection** — OAuth 2.0 connect/disconnect, enabled toggle, token
  encryption and background refresh
- **ZNS template management** — list templates from the Zalo API with status tags
- **ZNS message sending** — send ZNS messages from the CSKH screen and log outcomes
- **Webhook receiver** — anonymous endpoint for Zalo OA event callbacks with
  HMAC-SHA256 signature verification
- **FE Tools tab** — `/tools/zalo-oa` with three sub-tabs: Cấu hình / Mẫu ZBS /
  Danh sách tin Zalo

## API surface (BlueDental endpoints)

```
GET    /api/v1/app/zalo/status                   branch status + isConnected + oaName
GET    /api/v1/app/zalo/connect-url              OAuth authorization URL
GET    /api/v1/app/zalo/oauth/callback           [AllowAnonymous] exchanges code, stores tokens
POST   /api/v1/app/zalo/bootstrap-import         seed OA name/avatar from Zalo API
PUT    /api/v1/app/zalo/enabled                  { enabled: bool }
DELETE /api/v1/app/zalo/connection               removes stored tokens + connection record
POST   /api/v1/app/zalo/refresh-token            manual token refresh
GET    /api/v1/app/zalo/templates                paged list of ZNS templates from Zalo API
GET    /api/v1/app/zalo/templates/{id}           single template detail + parameter schema
POST   /api/v1/app/zalo/messages                 send ZNS { phone, templateId, params }
GET    /api/v1/app/zalo/messages                 paged message log (date range, status filter)
GET    /api/v1/app/zalo/messages/stats           { total, sent, failed } for branch
GET    /api/v1/app/zalo/webhook                  [AllowAnonymous] GET probe → 200
POST   /api/v1/app/zalo/webhook                  [AllowAnonymous] OA event callback
```

All endpoints except the two anonymous ones are branch-scoped; a branch-2 account
receives **403** on branch-1 resources.

## Domain & persistence

| Table | Purpose |
|---|---|
| `bd_zalo_oa_connections` | One row per branch; stores encrypted access/refresh tokens, OA name/avatar, enabled flag, expiry timestamps |
| `bd_zalo_message_logs` | Append-only log of every ZNS send attempt; `Outcome` enum: `Sent` / `Failed`; stores Zalo error code on failure |

Migrations: `AddZaloOaIntegration`, `AddElectronicInvoices` (separate).

## Background worker

`ZaloTokenRefreshWorker` runs every 60 minutes. For every connection whose
`AccessTokenExpiresAt` is within 48 hours of the current UTC time, it calls the
Zalo token refresh endpoint, stores the new tokens, and updates `RefreshedAt`.
If Zalo returns an error the worker logs a warning and continues to the next
connection; it does not throw, because a failing refresh for one branch must not
affect others.

## Webhook

`ZaloWebhookController` (`[AllowAnonymous]`):
- `GET /webhook` — returns 200 with the configured verification token for Zalo's
  domain verification step.
- `POST /webhook` — verifies `X-ZEvent-Signature: mac=<hex>` using
  `HMAC-SHA256(appSecretKey, rawBody)`; returns 401 if the signature does not
  match. Accepted event types: `follow`, `unfollow`, `user_send_text`. Unknown
  event types are acknowledged (200) and ignored.

## FE components

| File | Role |
|---|---|
| `src/features/tools/components/ZaloConfigView.tsx` | Connected / disconnected panels, enabled toggle, disconnect confirm dialog |
| `src/features/tools/components/ZaloTemplateView.tsx` | Template list table with status tags (strategy map at module scope) and pager |
| `src/features/tools/components/ZaloMessageView.tsx` | Message list with counter tiles (Tổng / Thành công / Thất bại) and status filter |
| `src/features/cskh/components/SendZaloDialog.tsx` | Template picker + parameter form; sends via `mutateAsync`; inline error display |
| `src/features/tools/api/zaloApi.ts` | TanStack Query hooks: `useZaloStatus`, `useZaloConnectUrl`, `useZaloTemplates`, `useZaloMessages`, `useZaloStats`, mutations `useToggleZalo`, `useDisconnectZalo`, `useSendZaloMessage` |

## Rules under test (13 specs in `e2e/zalo-oa.spec.ts`)

1. `GET /status` returns `{ isConnected, oaName, enabled }` shape.
2. `GET /connect-url` returns an https Zalo OAuth URL when no connection exists.
3. `POST /bootstrap-import` returns 400 when no connection stored.
4. `POST /messages` returns 400 (cannot send) when no connection stored.
5. `GET /webhook` probe returns 200 with verification token.
6. `POST /webhook` with wrong HMAC signature returns 401.
7. `POST /webhook` with correct HMAC signature returns 200 and acknowledges the event.
8. `GET /templates` returns the expected response shape when a connection is seeded.
9. `GET /messages` returns a paged response with `items` and `totalCount`.
10. `GET /messages/stats` returns `{ total, sent, failed }` all integers.
11. Branch-2 account receives 403 on branch-1 connection endpoints.
12. Config sub-tab (`?subTab=config`) renders the connection panel.
13. Message sub-tab (`?subTab=campaign`) renders the three counter tiles.

## Acceptance evidence

Production build (`vite preview` :8080, host :5019, real PostgreSQL), 2026-09-28:

- `e2e/zalo-oa.spec.ts` **13/13** — real ASP.NET Core pipeline, real PostgreSQL,
  no API interception; fixture seeds a `ZaloOaConnection` row for branch-1 with a
  test access token before the specs run.

## Not covered yet

- Token refresh worker is tested by inspecting the scheduled registration; an
  actual 60-minute elapse is not exercised in the suite.
- The `oauth/callback` redirect flow requires a real Zalo authorization grant and
  is not covered by automated tests; manual verification was done on the sandbox
  app provided by the OA owner.
- Sending a real ZNS message to a live phone number is excluded from automated
  tests to avoid cost and rate-limit violations.
- `UNKNOWN_REFERENCE_BEHAVIOR`: exact OA event payloads beyond `follow` and
  `user_send_text` were not observed on the reference; additional event types are
  acknowledged and ignored.
