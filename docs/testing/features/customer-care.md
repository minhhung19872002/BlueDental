# F-12 — CSKH (Chăm sóc khách hàng)

Status: `DIRTY` · 2026-08-27 (grouping filters made real; runtime retest
pending — see the last section) · previously `VERIFIED` 2026-08-26 ·
Rebuilt for staging parity (staging.nfcdental.com
is the new reference standard). Suite run against the production build
(`vite preview`, 127.0.0.1:8080) → API on `localhost:5000` → PostgreSQL 15 in Docker.

## Scope

`/cskh-grouping` — the whole screen:

- Top pills **Chăm sóc khách hàng** / **Phân nhóm CSKH** (`tab=care|group`).
- Five care-type tabs (`page=`): Sau điều trị (`after-treatment`), Chúc mừng sinh
  nhật (`birthday`), Nhắc lịch hẹn (`reminder`), CSKH định kì (`periodic`),
  CSKH đặc biệt (`special`) — each with its own column set and toolbar.
- Date bar Ngày/Tuần/Tháng (`care_dateMode`, `care_date`) — switching mode resets
  `care_date` to the mode's anchor (today / Monday / the 1st).
- Five counter tiles from `GET /care-records/stats`; the status tiles also filter
  the list (`status=`).
- Row actions: Gọi điện, Lưu tin nhắn, Gửi ZBS qua Zalo (reminder + birthday), Chăm sóc
  (result dialog / base-care dialog).
- Inline note edit (blur → full-object `PUT`).
- Tạo mới dialog (periodic/special only).
- Xuất Excel — real server-generated `.xlsx`, per-tab kebab name.
- Phân nhóm CSKH: patient list from `GET /care-records/grouping-patients` with
  taxonomy filter, search, and the base-care (file-heart) dialog.

## API surface

```
GET  /api/v1/app/care-records?type&status&fromDate&toDate&assignedStaffId&careStaffId&filter&skipCount&maxResultCount
GET  /api/v1/app/care-records/stats?type&fromDate&toDate&...
POST /api/v1/app/care-records
PUT  /api/v1/app/care-records/{id}
GET  /api/v1/app/care-records/excel?type&...          → cskh-<tab>-<yyyyMMdd-HHmm>.xlsx
GET  /api/v1/app/care-records/grouping-patients?taxonomyId&tagId&birthdayDate&staffId&filter
POST /api/v1/app/care-records/{id}/contact|succeed|fail|zalo-sent|cancel   (kept; FE uses the full PUT like the reference)
```

Branch scope comes **only** from the user claim (`CurrentClinicBranchResolver`) —
a `branchId` query param is not honoured on these endpoints.

## Acceptance evidence

`e2e/cskh.spec.ts` — 8 tests, all real full-stack (real login, real API, real
PostgreSQL, zero interception). Last run 2026-08-26: **8 passed (43.7s)**.

1. **URL params** — care-type pill writes `page=`, mode switch writes
   `care_dateMode` and resets `care_date` to the anchor (week → Monday), top pill
   writes `tab=group`.
2. **Counters** — tiles served by the real `/stats`; clicking Thành công issues a
   list request carrying `status=3` and the tile reads `aria-pressed=true`.
3. **Toolbar matrix** — special: search + Bác sĩ điều trị + Nhân viên CSKH +
   Tạo mới + Xuất Excel; birthday: no doctor filter, no Tạo mới; after-treatment:
   doctor filter but no care-staff filter and no Tạo mới.
4. **Create + note** — Tạo mới on the special tab (Lưu disabled until a patient
   is picked), toast, row appears; inline note saved on blur through a real PUT;
   both survive a reload.
5. **Care result** — a Birthday record is seeded through the real authenticated
   API (the UI has no create path for that type), the file-heart dialog saves
   Thành công, the row badge updates, and after a reload the Thành công tile is
   non-zero (server-derived persistence).
6. **Excel** — the download event yields `cskh-dac-biet-<stamp>.xlsx`.
7. **Phân nhóm CSKH** — footer "trên N bệnh nhân", server-side search by patient
   code (`filter=` on the wire), base-care dialog gated on Tiêu đề, saved with
   Nhãn màu Tốt (toast "Đã lưu lần chăm sóc").
8. **Branch isolation** — admin's list is entirely branch one; `branch2`'s list
   (fetched in-page with real cookie auth) contains **no** branch-one record;
   `branch2` POSTing a care record against a known branch-one patient id gets
   **404** (not 403, not success) — a foreign patient id cannot be used to
   hydrate that patient's PHI through `CreateAsync`.

Backend: `CustomerCareAppServiceContractTests` +
`CrossBranchDenialTests` — `Application.Tests` 476/476,
`Domain.Tests` 196/196 (2026-08-26).

## Security review (2026-08-26)

`/security-review` on the rebuild: no findings at the ≥8/10 report threshold.
One 5/10 medium was still fixed proactively: `CreateAsync` trusted the
client-supplied `PatientId`, so a branch A user knowing a branch B patient's
UUID could file a care record that later hydrated that patient's name/phone.
Fix: patient branch membership is checked against the caller's resolved branch
and a foreign id throws `EntityNotFoundException` (404, same
no-existence-disclosure pattern as `GuardBranchAccess`). Covered by the
`ApplyResult` unit tests plus the E2E cross-branch 404 assertion above.

## Not covered yet

- Zalo send is UI + stub only (`zalo-sent` records the timestamp; no provider).
- Call sessions deep-dive deferred by the user ("chỗ này làm sau").
- The reference "Thẻ tag" param name is still `UNKNOWN_REFERENCE_BEHAVIOR`
  (see `docs/clone/unknowns.md`) — local settled on `tagId`.

## Visual parity pass (2026-08-27)

LOCAL vs STAGING screenshots for all 5 care tabs + Phân nhóm at 1600×900
(`reference-private/survey/staging/parity-2026-08-27/`). Fixes applied:
segmented controls + counter-chip row, sentence-case table headers,
no horizontal scrollbar on narrow tabs (`wideTable` flag), `Thao tác`
pinned right on wide tables, tinted treatment-status badges on the
grouping tab. Deliberate divergence: BlueDental house chrome (navy
sidebar, PageHeader, pill tabs) is kept.
Retest level 1 (visual) + full `e2e/cskh.spec.ts` rerun: 8/8 green on the
production build.

Further divergence (user decision 2026-08-27): the reference-blue
`#2671d8` accents were replaced by the app primary (`var(--bd-blue)`)
throughout `cskh.css`; the reference-style pager (standalone
always-visible `<Pagination>`, "‹ Trước / Sau ›", 5/10/20/25/50/100
options) was replaced by the app-standard `useTablePagination` +
`buildConfig` on the Tables (same as `/settings?tab=branches`), and
`carePagination.tsx` / `CARE_PAGE_SIZE_OPTIONS` were deleted. The
segmented control (date modes + care-type tabs) was extracted to the
shared `SegmentedTabs` component (`src/components/SegmentedTabs/`),
40px tall, light hover tint, horizontal scroll on overflow. The two
`e2e/cskh.spec.ts` footer assertions now match the standard
"Hiển thị X-Y/Z" text; e2e rerun skipped at the user's request.

## After-treatment export gap fix (2026-08-27)

User reported the local "Sau điều trị" export was missing 3 columns after
"Bác sĩ điều trị". The real staging file (`reference-private/survey/staging/
cskh-sau-dieu-tri.xlsx`, downloaded 2026-08-27) has 13 columns — the earlier
survey never captured this file. Added **Dịch vụ** (newline-joined service
names resolved via `StageIds → TreatmentStage.ServiceId → catalog name`),
**Phản hồi khách hàng** (`Resolution`), **Trạng thái đánh giá**
(`Outcome` → Tốt/Khá/Bình thường/Khiếu nại, empty until rated) to
`CareExportColumns.AfterTreatment` with staging widths
20/14/24/12/16/16/20/28/30/16/20/16/36. Also fixed two export basenames to
match the downloaded files: `cskh-sinh-nhat`, `cskh-dinh-ky`. Demo seeder now
links after-treatment records to the patient's real treatment stages and
rotates statuses per tab so the new columns carry data.

Verified at runtime: reseeded DB, downloaded the local export via the real
endpoint, decoded with openpyxl — 13 headers byte-identical to staging,
widths match (ClosedXML's pre-existing +0.71 offset aside), multi-service
cell newline-stacked, rated row shows resolution text + "Tốt".
BE CustomerCare tests 33/33 green. Retest level 2.

## After-treatment actions + Lưu tin nhắn restyle (2026-08-27)

User observation on staging superseded the 2026-08-26 survey: the Sau điều
trị tab has **no file-heart (chăm sóc) action** — only phone + message on
every row, including successful ones. Removed the action from
`careTabs.ts` (`fileHeart: null`), deleted `CareOverviewDialog` +
`careTreatmentApi.ts` (dead code), and dropped the "overview" dialog kind.

`SaveMessageDialog` rebuilt to the reference layout (3 user screenshots):
tinted patient bar "Họ và tên: [code] - name", two floating-label selects
(Cấu hình — empty, dropdown search + "Không tìm thấy dữ liệu"; Mẫu tin nhắn
— single "Tin nhắn tự do"), always-visible "Ghi chú CSKH" textarea, footer
"Gửi" button with save icon. Submit endpoint remains
UNKNOWN_REFERENCE_BEHAVIOR — dialog stays UI-only. Global
`.ant-modal-body` padding tightened to `12px 20px 0` per user request, and
the Thao tác column width is now computed from the per-tab button count
(`actionsColumnWidth`, 28px buttons + 2px gap + 16px cell paddings).

Verified in the real browser on the production build: after-treatment rows
show exactly 2 actions, the dialog matches the reference screenshots in
both closed and open-select states. `e2e/cskh.spec.ts` 8/8 green (one
assertion migrated from the stale `cskh-seg-item--active` class to
`aria-pressed` after the shared `SegmentedTabs` extraction). Retest level 2.

## Lưu tin nhắn data integration (2026-08-27)

The dialog's two selects now fetch real data from local mirrors of the
reference endpoints: `GET /api/v1/app/clinic-configure` (new
`Notifications.ClinicConfigure` entity, table `bd_clinic_configures`,
migration `20260827023018_AddClinicConfigures`, demo-seeded with 2 sms
rows) and `GET /api/v1/app/sender-sms-templates` (served from the
existing `Tools.MessageTemplate` catalog filtered Channel=Sms &&
IsActive — no duplicate table). Both are branch-scoped via
`ICurrentClinicBranchResolver` and guarded by `CustomerCare.View`.
"Tin nhắn tự do" is a client-side default option; picking a stored
template reveals the "Nội dung tin nhắn gửi đi" textarea prefilled with
its content ("Tin nhắn tự do" shows it empty). Cấu hình is required.

**Deferred (per user):** the real message SEND is not implemented — the
reference submit request is UNKNOWN_REFERENCE_BEHAVIOR (test branch has
no sending configuration). Gửi currently validates Cấu hình then toasts
"Chức năng gửi tin nhắn chưa được hỗ trợ". Revisit once a sending
configuration exists.

Verified: BE Notifications tests 17/17 green, solution builds clean,
FE tsc + production build clean. Real browser on the production build
(:8080 preview + :5000 host, Development-seeded DB): opening the dialog
fires both GETs (200), Cấu hình lists the 2 seeded configures, Mẫu tin
nhắn lists "Tin nhắn tự do" + "Chúc mừng sinh nhật" + "Nhắc lịch hẹn",
selecting "Nhắc lịch hẹn" prefills the content textarea, Gửi with
nothing selected toasts "Vui lòng chọn cấu hình", Gửi with both
selected toasts the not-supported placeholder. Reopening resets state.
Retest level 2. Note: DbMigrator must run with
`ASPNETCORE_ENVIRONMENT=Development` or the demo seeder skips.

## Grouping filters made real (2026-08-27)

Per user direction ("chưa handle filter theo tag / check dịch vụ nằm trong
nhóm dịch vụ"):

- **Thẻ tag** — patients now carry `TagIds` (PG `uuid[]` on `bd_patients`,
  migration `20260827035426_AddPatientTagIds`, EF `PrimitiveCollection`
  mirroring `CareRecord.StageIds`). Assigned via a new "Phân loại Tag"
  multi-select in `PatientEditorModal` (options = branch's active Thẻ hồ sơ);
  `PatientAppService` drops ids not in the caller-branch's tag catalog before
  saving. `grouping-patients?tagId=` and `GET /v1/app/patients?tagId=` filter
  with `TagIds.Contains`, and the stubbed "Phân loại theo Tag" select on the
  patient list is wired.
- **Nhóm dịch vụ** — `taxonomyId` now also matches patients whose treatment
  plans contain a service (`CatalogEntry`) belonging to that care-service
  group (`TaxonomyId == taxonomyId`), OR-ed with the previous
  `CareRecord.CareServiceId` match.

Evidence: BE solution builds clean; `Application.Tests` filtered to
CustomerCare + Patient: 81/81 green; FE `tsc -b` clean. Browser retest
deliberately skipped in that session per the user ("k cần test ở
conversation này") — feature marked `DIRTY` pending a runtime pass.
