# BlueDental Reference — Observed & Discovered Network Requests / API Map

> Reference System: https://app.nfcdental.com  
> Inspection Date: 2026-08-21  
> Phase: Phase 1 — Reception / Tiếp nhận Page API Discovery

---

## 1. Currently Observed Production Network Requests

During safe read-only inspection of `https://app.nfcdental.com`, the following HTTP requests were observed:

| Method | Endpoint URL | Status Code | Content Type | Purpose & Notes |
|--------|--------------|-------------|--------------|-----------------|
| `GET` | `https://app.nfcdental.com/` | `200 OK` | `text/html; charset=utf-8` | Next.js HTML initial document delivery |
| `POST` | `https://app.nfcdental.com/api/auth/refresh` | `401 Unauthorized` | `application/json` | Auth session refresh request (returns `{"message":"No refresh token"}` when unauthenticated) |
| `GET` | `https://api.nfcdental.com/api/v1/maintenance/status` | `200 OK` | `application/json; charset=utf-8` | System maintenance status check (returns `{"data":{"enabled":false}}`) |
| `GET` | `https://app.nfcdental.com/signin?_rsc=vusbg` | `200 OK` | `text/x-component` | Next.js App Router React Server Component (RSC) prefetch |
| `GET` | `https://app.nfcdental.com/_next/static/chunks/*.js` | `200 OK` | `application/javascript` | Next.js application JS bundle chunks |
| `GET` | `https://app.nfcdental.com/fonts/GoogleSans-*.ttf` | `200 OK` | `font/ttf` | Application font assets (Google Sans) |

---

## 2. Discovered API Endpoints (Extracted from Frontend JS Chunks)

### 2.1 Authentication & User Session API (`/api/auth`)
- `POST /api/auth/login`: User credential login (Email + Password).
- `POST /api/auth/logout`: User session termination.
- `POST /api/auth/refresh`: JWT token refresh.

### 2.2 Core Backend REST API (`https://api.nfcdental.com/api/v1`)
- **Maintenance & Health**:
  - `GET /api/v1/maintenance/status`: Maintenance status check.
- **Staff & Roles**:
  - `GET /v1/staff`: Retrieve staff, doctor, and receptionist list.
  - `GET /v1/call-sessions`: Communication / call history.
- **Reception & Patient Queue (Target Endpoints for local implementation)**:
  - `GET /v1/receptions`: Retrieve reception queue list with query params (`date`, `status`, `doctorId`, `keyword`, `page`, `pageSize`).
  - `POST /v1/receptions`: Create new patient reception entry (**UNSAFE ON PRODUCTION — UNKNOWN_REFERENCE_BEHAVIOR**).
  - `PUT /v1/receptions/{id}/status`: Transition patient reception status (`Khách đến` -> `Đang khám` -> `Hoàn thành`) (**UNSAFE ON PRODUCTION — UNKNOWN_REFERENCE_BEHAVIOR**).
  - `DELETE /v1/receptions/{id}`: Delete or cancel reception record (**UNSAFE ON PRODUCTION — UNKNOWN_REFERENCE_BEHAVIOR**).

---

## 3. Standard API Response Structure (Observed Metadata Pattern)

All API responses from `https://api.nfcdental.com/api/v1/*` follow a structured JSON envelope:

```json
{
  "statusCode": 200,
  "message": "<string>",
  "metadata": {
    "language": "vi",
    "timestamp": 1787311268820,
    "timezone": "Asia/Ho_Chi_Minh",
    "path": "/api/v1/...",
    "version": "1",
    "repoVersion": "8.2.2",
    "requestId": "<uuid>",
    "correlationId": "<uuid>"
  },
  "data": {}
}
```
