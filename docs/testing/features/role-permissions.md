# F-40 — Phân quyền theo vai trò (menu, route, API)

Status: `VERIFIED` · Verified commit: uncommitted work on top of `1e69e93`
(2026-09-22) — see `01-feature-verification-registry.md`

## Why this exists

BA feedback item 3 (2026-09-22): user *HUỲNH VĂN ĐỊNH* holds the `dentist`
role, that role has **0/378** grants on Cài đặt → Phân quyền, yet the user saw
every menu and every screen. Expected: ticking a role's grants decides what its
users can do.

Owner decisions (2026-09-22), in the owner's words:

- **A.** "ẩn luôn nếu k có quyền chức năng ở menu" — menu groups and entries the
  user may not open are **hidden**, not disabled.
- **B.** "làm theo bạn nhưng nhớ note lại cho bước tiếp theo" — Phase 1 (menu +
  route gating), Phase 3 (server hardening) and Phase 5 (real tests + docs) are
  done here; Phase 2 and Phase 4 are deferred and written down under
  *Next steps* below.
- **C.** "hiện tại nếu chưa có quyền thì cho mọi user đăng nhập xem đi" — Tổng
  quan (`/dashboard`) opens for every signed-in user.
- **D.** "giữ nguyên đi" — the demo seeder is untouched (demo dentists keep the
  `admin` role they are seeded with).

## Scope

### Frontend (Phase 1)

- `src/app/routePermissions.ts` — one map: route key → list of permissions,
  "any of". An empty list means everyone (only `dashboard`).
- `src/lib/permissions.ts` — `isAnyGranted`, `useHasAnyPermission` (subscribes
  to `user.permissions` on the auth store, so a re-login re-evaluates).
- `src/app/useVisibleNav.ts` — filters `nav.ts` through the map: an entry the
  user may not open is dropped, a group with no entries left is dropped.
  `HeaderNav` and the drawer render the filtered tree only.
- `src/app/PermissionRoute.tsx` + `src/components/ForbiddenResult.tsx` — every
  route in `router.tsx` is wrapped (`<G k="...">`); a typed or bookmarked
  address the user may not open renders the AntD 403 Result "Không có quyền
  truy cập" instead of the page.
- `ClinicSettingsPage` tabs: Phân quyền needs `BlueDental.rolePermission.read`,
  Chi nhánh needs `BlueDental.Organizations.View`, Quản lý chi nhánh needs
  `BlueDental.BranchManager.View`; a hidden tab in the URL falls back to the
  first visible one.
- Post-login lands on `/dashboard` (was a screen a restricted user may not
  open).

### Backend (Phase 3)

| Gap found | Fix |
|-----------|-----|
| `GET /api/v1/app/role-permission/permission-tree` was bare `[Authorize]` — any signed-in user could pull the whole permission tree | `[Authorize(BlueDentalAbilityPermissions.RolePermission.Read)]` |
| `FileAttachmentAppService` had no ability at all — list, read, create, delete open to every signed-in user | Gated as `treatmentImage.read/create/delete` (**ASSUMPTION**, see below) |
| `NotificationAppService.MarkReadAsync` accepted any notification id | Refuses (`AbpAuthorizationException`) when the recipient is not the caller |
| `OperationsArticleAppService.GetListAsync` / `OperationsTaskAppService.QueryAsync` checked nothing when no department was named — the "all departments" list showed every khối to a user with no operations ability | Narrowed to the department+section pairs the caller may read; none readable → 403 rather than an empty page |
| Staff created through the Nhân sự dialog carry `StaffBranchAssignment` rows but **not** the home-branch claim, so `/account/me` returned `clinicId: null`, the client sent no `X-Clinic-Branch-Id`, and every branch-scoped list answered 403 `BlueDental:Organizations:0005` — even after the role was granted | `AccountAppService.GetCurrentUserAsync` falls back to the lowest accessible assignment when neither the header nor the claim names a branch (**ASSUMPTION**, see below) |

## API surface touched

```
GET  /api/v1/app/account/me                              clinicId now falls back to an assignment
GET  /api/v1/app/role-permission/permission-tree         needs BlueDental.rolePermission.read
GET/POST/DELETE /api/v1/app/file-attachments…            need BlueDental.treatmentImage.{read,create,delete}
POST /api/v1/app/notifications/{id}/mark-read            recipient only
GET  /api/v1/app/operations-articles, /operations-tasks  narrowed to readable departments
```

## Rules under test

- A role with no grants: the header shows **one** group (Tổng quan); Phòng
  khám / Tài chính / Vận hành are absent from the DOM, not disabled.
- Typing `/patient` or `/settings?tab=permission` shows the 403 Result; no
  table, no role list is rendered.
- The server refuses the same user: `permission-tree` → 403, `patients` → 403.
- Granting **Khách hàng → Xem** (`patient.read`) to the role through the real
  Phân quyền tab, then reloading as that user: Phòng khám appears with exactly
  one ribbon entry (Bệnh nhân), the patient list loads through a real
  `/api/v1/app/patients` request, and `permission-tree` is still 403 — the grant
  widens only what it names.

## Acceptance evidence

`e2e/role-permissions.spec.ts` — 1 spec, real stack only (real login as
`admin`, real role edit, real staff creation through the Nhân sự dialog, a
second browser context logged in as the new dentist, real API status codes
through `page.request`, `assertRealApiTraffic` on `/api/v1/app/patients`).
Cleanup revokes the grant and deletes the staff row through the UI.

Run 2026-09-22 against `vite preview` on `http://localhost:8082` +
`BlueDental.HttpApi.Host` on `:5000` + Docker PostgreSQL: **1 passed (20 s)**.

Contract tests:

- `BlueDental.Application.Tests` filtered on FileAttachment / Account /
  Notification / Operations: 58 passed.
- `BlueDental.HttpApi.Host.Tests` `ControllerConventionTests` (incl.
  `RolePermissionController_Should_Require_RolePermission_Read`): 15 passed.

Level 3 retest (auth + `AccountAppService` are shared): `header-navigation`
(admin still sees 4 groups, 14 drawer items), `routes` 25/26 —
`/timekeeping loads without error` fails **before and after** this change and
on the other session's build too: the committed router has no `/timekeeping`
route (timekeeping lives at `/calendar?tab=timekeeping`), so that smoke row is
stale, not a regression. `branch-isolation` + `branch-switcher` (F-20, F-30): 8 passed on the
same stack. The full suite was **not** rerun.

## Assumptions

- **FileAttachment → treatmentImage**: the reference's ability tree has no
  "attachment" subject; X-ray images and treatment documents are the only thing
  these rows hold today, so they are gated as treatment images. If the
  reference turns out to gate them elsewhere, change the four attributes in
  `FileAttachmentAppService` and the theory in
  `FileAttachmentAppServiceContractTests`.
- **Home branch = lowest assigned branch id** for staff with assignments but no
  claim. The Nhân sự dialog lets an admin pick several branches and marks none
  of them as home; `Min()` is deterministic, which is what the session needs
  (the client only takes the value when no branch is chosen yet — the user can
  switch afterwards). Setting the home-branch extra property on the user from
  the dialog was **not** done: it would need a "home" notion in the dialog the
  reference does not show.

## Round 2 (2026-09-22, later the same day) — the existing 378 leaves take effect

Owner: "làm tiếp đi, b đã handle các bước chưa làm chưa? b đã handle các
quyền hiện có chưa". Two questions, two answers.

### Did the existing grants ever reach the server? No — two defects

1. **Application-service `[Authorize]` was never enforced (R-401).** The host
   registered the Application assembly as conventional (auto API) controllers
   *and* the HttpApi project has a hand-written controller for every service.
   ABP treats each auto-controller service type as a controller and adds it to
   `DynamicProxyIgnoreTypes`, so Autofac handed the hand-written controllers
   plain, un-proxied instances: no `AuthorizationInterceptor`, so every
   `[Authorize(...)]` on an `*AppService` was decoration. Only attributes on
   controllers counted. Fix: the conventional-controller registration is gone
   from `BlueDentalHttpApiHostModule.PreConfigureServices`; services that had no
   controller got one (`AccountController` at `api/v1/app/account`,
   `FileAttachmentController`, `InsurancePlanController`,
   `InsuranceClaimController`); the eight taxonomy contracts the Danh mục
   screen never calls (`IConsultingDataAppService`, `IDiagnosisAppService`,
   `IMedicalHistoryTypeAppService`, `IMedicalRecordTemplateAppService`,
   `IMedicationTypeAppService`, `IOccupationAppService`,
   `IPatientSourceAppService`, `IPrescriptionTemplateAppService`) are marked
   `[RemoteService(IsEnabled = false)]`. Guarded by
   `ApplicationServiceInterceptionTests` (the resolved service must be a proxy
   carrying `AuthorizationInterceptor`) and `HostModuleConfigurationTests`
   (no conventional controllers; every enabled contract is a constructor
   parameter of some controller).
2. **Legacy policies were unreachable from the Phân quyền tree (R-402).**
   Most services still ask for `BlueDental.Catalogs.View`-style module names,
   which the tree never grants. `BlueDentalPermissionBridge` maps each legacy
   name onto the ability leaves it covers ("any of"), and
   `AbilityBridgePermissionValueProvider` (name `AB`) answers a legacy check
   from the bridged leaves. `SystemAdministration.*` is not bridged on purpose.
   Guarded by `PermissionBridgeTests`, `AbilityBridgePermissionValueProviderTests`.

Side effects of enforcement becoming real:

- `ClinicBranchAppService` carried a class-level Organizations policy; ABP
  **unions** class- and method-level policies, so `GetAccessibleAsync` was
  refused for every restricted user (R-403). The class now has a bare
  `[Authorize]` and each method names its own Organizations policy.
- The account routes moved from the auto-generated `/api/app/account/*` to
  `/api/v1/app/account/current-user` and `/change-password` (R-404); the auth
  API client follows.
- `GET /api/v1/app/insurance-claims` returned 500 for admin (`42703: column
  b.BranchId does not exist`): commit `72194d7` added `BranchId` to the
  entity and the snapshot but never generated the migration. Fixed by the
  hand-written `20260922100000_AddInsuranceClaimBranchId` (column, backfill
  from the invoice's branch, index); the abilities spec now asserts the admin
  GET is 200 (R-405).

### The deferred steps

- **Phase 2 (per-page action gating) — done for the first four screens.**
  `src/hooks/useAbility.ts` (`useAbility(subject)` → `can(action)` plus
  `canRead/Create/Update/Delete/Export/Approve`) reads `user.permissions`
  from the auth store. Used by Bệnh nhân (`PatientManagementPage`: "Tạo hồ
  sơ" ← `patient.create`, "Xuất file" ← `patient.export`), Nhân sự
  (`StaffPage`, `StaffRosterCard`), Thanh toán (`BillingPage`), Lịch hẹn
  (`AppointmentCalendarPage`, `AppointmentListPage`, `CalendarToolbarRow2`,
  `CalendarControlPanel`). `/taxonomy` untouched (CLAUDE.md §17). Remaining
  screens still render every button and rely on the server refusal.
- **Header branch popover** reads `GET /api/v1/app/clinic-branches/accessible`
  (`listAccessibleBranches`), which needs only a signed-in user and is narrowed
  server-side to the caller's assignments. `useClinicBranches(true)` routes
  there; the admin list route keeps `Organizations.View`.
- **Phase 4 (seed defaults)** — still deferred, owner decision D.
- **Home branch for dialog-created staff** — still the `Min()` fallback; the
  dialog has no "chi nhánh chính" control.

### Evidence (round 2)

`e2e/role-permissions-abilities.spec.ts` — real stack, admin session + a
second cookie session for a dentist created through the Nhân sự dialog:
ungranted → `dental-procedures` 403, `patients` 403, `clinic-branches` 403,
`clinic-branches/accessible` 200 listing the main branch, Khối lễ tân
`work-log` 403; after `catalogService.read` + `patient.read` →
`dental-procedures` 200 (the legacy `Catalogs.View` guard opened by a leaf),
`work-log` still 403, `/patient` renders with no "Tạo hồ sơ" / "Xuất file";
after `patient.create` → "Tạo hồ sơ" visible, "Xuất file" still absent. 1
passed (26 s) on preview 8082 + host 5000. Backend: Host.Tests 19/19,
Application.Tests 588/588, Domain.Tests 310/310.

## Known gaps (not fixed here)

- Dashboard widgets need `reportSales.read` / appointment abilities; for a
  restricted user they fail quietly (empty cards). Owner decision C accepts
  this for now.
- `PersonalInfoTab` loads the profile through `useStaff` (`staff.read`); a user
  without it sees an empty personal-info form.
- `/audit-logs` has no backend at all; its route is gated by `SystemAdmin`.
- Axios handles only 401 globally; a 403 from an action button is shown by
  whichever screen called it (global `MutationCache` toast).
- `MarkReadAsync` / Operations narrowing are covered by contract review and
  the admin-path specs only; no restricted-user runtime spec for them yet.

## Next steps (deferred by owner decision B — do these next)

1. **Phase 2 — remaining screens.** Bệnh nhân, Lịch hẹn, Thanh toán, Nhân sự
   are gated through `useAbility` (round 2). Extend the same hook to the
   patient detail tabs, Vận hành, Báo cáo row buttons, Kho, Cài đặt. **Do not
   rewrite `/taxonomy`** (CLAUDE.md §17) — its 38 specs must stay green; gate
   its buttons only through the hook.
2. **Phase 4 — seed sensible defaults.** `dentist` is seeded with 0 grants
   and the demo dentists carry `admin`, so a fresh database still shows a
   dentist everything. Decide a default dentist grant set with the owner and
   seed it; drop `admin` from demo dentists (owner said "giữ nguyên đi").
3. Store a home branch for dialog-created staff instead of the `Min()` fallback
   once the dialog has a "chi nhánh chính" control.
4. Bridge pairings are ASSUMPTIONS (see `BlueDentalPermissionBridge`); if a
   role holding a leaf is still refused by a legacy-guarded route, extend the
   map there, not the service attribute.
