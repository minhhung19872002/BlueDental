# F-15 — Quản trị vận hành

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The Vận hành screen: per-department "Trang chủ" and "Quy trình" articles, plus
per-department tasks.

## Provenance

The reference guards each department + section pair with its own ability subject
(`operations<Department><Section>`, e.g. `operationsReceptionProcess`), which is
what fixes the shape of this module. The article and task **payloads** were never
fetched — those sub-tabs fired no API call while being observed — so the fields
are BlueDental's, listed in `docs/clone/business-features.md` under
`UNKNOWN_REFERENCE_BEHAVIOR`.

## API surface

```
GET  /api/v1/app/operations-articles?clinicBranchId&department&section&isPublished
POST /api/v1/app/operations-articles
POST /api/v1/app/operations-articles/{id}/publish
POST /api/v1/app/operations-articles/{id}/unpublish
GET  /api/v1/app/operations-tasks?clinicBranchId&department&status&overdueOnly
GET  /api/v1/app/operations-tasks/stats
POST /api/v1/app/operations-tasks
POST /api/v1/app/operations-tasks/{id}/{start,complete,cancel}
```

## Rules under test

- One endpoint serves every department, so the department travels with every
  request **and** with every authorization check.
- An article stays a draft until published, and publishing is refused while the
  body is empty.
- Articles order pinned → sortOrder → newest.
- Tasks run `Chưa làm → Đang làm → Hoàn thành`; overdue is derived from the due
  date, never stored.
- Every read and write is branch-scoped.

## Acceptance evidence

`e2e/operations.spec.ts`:

1. creates an article, asserts "Nháp", publishes it, asserts "Đã đăng" survives a
   reload;
2. drives a task through its lifecycle and asserts the "Hoàn thành" tile moves by
   exactly one and no further transition is offered;
3. switches department and asserts the server is re-queried with `department=3`.

## Not covered yet

- Sections the reference exposes read-only (they render an honest Empty)
- Pinning and sort order through the UI
