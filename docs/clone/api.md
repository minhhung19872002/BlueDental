# API Observations — Reference Application

Source: https://app.nfcdental.com
Observed: 2026-08-21

## Technology Stack

The reference application uses **Next.js** with **React Server Components (RSC)**.

API calls are NOT traditional REST endpoints — data is fetched via RSC flight format
using `_rsc` query parameter on route URLs.

## Observed Network Patterns

### Route Prefetching (RSC)

On page load, the app prefetches all sidebar routes via RSC:

```
GET /reception?branchId=<id>&_rsc=<token>
GET /patient?branchId=<id>&_rsc=<token>
GET /calendar?branchId=<id>&_rsc=<token>
GET /cskh-grouping?branchId=<id>&_rsc=<token>
GET /labo?branchId=<id>&_rsc=<token>
GET /operations?branchId=<id>&_rsc=<token>
GET /report?branchId=<id>&_rsc=<token>
GET /staff?branchId=<id>&_rsc=<token>
GET /materials?branchId=<id>&_rsc=<token>
GET /taxonomy?branchId=<id>&_rsc=<token>
GET /tools?branchId=<id>&_rsc=<token>
```

All return HTTP 200.

### Static Assets

JS chunks loaded from `/_next/static/chunks/<hash>.js`
CSS loaded from `/_next/static/chunks/<hash>.css`

### Branch Scoping

Every route includes `branchId` query parameter.
Observed format: 24-character hex string (MongoDB ObjectId).

## API Endpoints

No traditional `/api/` REST endpoints were observed during this session.
The reference app appears to use Next.js server actions or RSC data fetching
rather than a separate API layer.

UNKNOWN_REFERENCE_BEHAVIOR:
- Whether there is a separate backend API
- API authentication mechanism
- API request/response contracts for CRUD operations
- Whether WebSocket/SSE is used for real-time updates
