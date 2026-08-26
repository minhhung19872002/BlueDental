# Feature Verification Registry

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `READY_FOR_TEST` · `FAILED` ·
`VERIFIED` · `DIRTY` · `BLOCKED`.

Only `VERIFIED` means the feature passed **real runtime acceptance** — real
browser, real API, real PostgreSQL (see `00-test-policy.md`).

Last run: 2026-08-24, stack on `localhost:5173` (Vite) → `localhost:5019` (API)
→ PostgreSQL 15 and MinIO in Docker.

> ⚠️ **The suite is not green.** The last full run was **51 passed, 30 failed**.
> Sixteen of those failures are specs still written against Ant Design selectors
> (`tr.ant-table-row`), and `antd` is no longer a dependency; three more are forms
> whose `<label>` carries no `htmlFor`. They fail in isolation too, so they are rot
> rather than interference. Do not read a run through `| tail -N`: the exit code
> then comes from `tail` and the failure list scrolls away — that is how earlier
> "N passed" numbers in this file were produced. Every `VERIFIED` row backed by one
> of the failing specs needs re-checking. See `save/taxonomy-handoff.md` §6.

| ID | Feature | Status | Acceptance spec | Notes |
|----|---------|--------|-----------------|-------|
| F-01 | Đăng nhập | `VERIFIED` | `e2e/fixtures/auth.ts` (used by every spec) | Real login form, real cookie auth |
| F-02 | Danh mục (taxonomy + catalog entries) | `VERIFIED` | `e2e/taxonomy.spec.ts` | Rebuilt 2026-08-24 against the redesigned reference layout: per-catalog URLs, group panel, server-side paging, drag/keyboard reordering. 5 specs — group + priced service persisted across reload, `/taxonomy/medicine` reached by link with `group=medication_type` on the wire, price column absent on unpriced catalogs, `skipCount` on the entry query, unmodelled catalogs explained |
| F-03 | Chấm công (lịch làm việc) | `VERIFIED` | `e2e/timekeeping.spec.ts` | Work day opened, shift clocked in and out through the UI |
| F-04 | Thu chi (phiếu thu/chi + duyệt) | `VERIFIED` | `e2e/finance.spec.ts` | Pending expense excluded from Tổng chi; approval adds exactly its amount |
| F-05 | Luân chuyển dòng tiền | `VERIFIED` | `e2e/finance.spec.ts` | Deposit moves Tổng Tiền Mặt by the deposited amount |
| F-06 | Hồ sơ bệnh nhân (đăng ký + danh sách) | `VERIFIED` | `e2e/patient.spec.ts` | Registered through the UI, persisted, reopened from the list |
| F-07 | Sơ đồ răng theo mặt | `VERIFIED` | `e2e/patient.spec.ts` | Whole-tooth, whole-jaw and clear all behave |
| F-08 | Voucher khuyến mãi | `VERIFIED` | `e2e/voucher.spec.ts` | Draft → active → paused; percentage above 100 refused |
| F-09 | Chẩn đoán & Tư vấn | `VERIFIED` | `e2e/treatment-stage.spec.ts`, `e2e/treatment-plan.spec.ts` | Diagnosis and advise created, then accepted |
| F-10 | Lịch hẹn | `VERIFIED` | `e2e/appointment.spec.ts` | Booking stored and found by a **server-side** search over every appointment (it used to filter only the fetched page); double-booking refused; day and week grids query their own range and now draw their bookings |
| F-11 | Tiếp nhận | `VERIFIED` | `e2e/reception.spec.ts` | Visit stored through the real API; counters served by `/visits/stats` |
| F-12 | CSKH | `VERIFIED` | `e2e/cskh.spec.ts` | Care task Chưa CS → Thành công moves the counters |
| F-13 | Labo | `VERIFIED` | `e2e/labo.spec.ts` | Overdue sample reads late until returned |
| F-14 | Vật tư | `VERIFIED` | `e2e/materials.spec.ts` | Supply added, stock received, status derived from expiry |
| F-15 | Quản trị vận hành | `VERIFIED` | `e2e/operations.spec.ts` | Article draft → published; task lifecycle; department travels with the query |
| F-16 | Công cụ (call/message/Zalo/hóa đơn) | `BLOCKED` | — | `UNKNOWN_REFERENCE_BEHAVIOR` — no data on the reference to observe |
| F-29 | Danh mục — màn hình phẳng (Đơn thuốc mẫu, Thẻ hồ sơ, Phương thức thanh toán) | `VERIFIED` | `e2e/taxonomy-flat.spec.ts` | Added 2026-08-24. Đơn thuốc mẫu drops the group panel and the group column while Bệnh án mẫu keeps both; a coloured thẻ hồ sơ is stored and survives a reload; MoMo and bank accounts stay on their own tabs across a reload; an account with no holder is refused. New tables `bd_patient_tags` (branch-scoped) and `bd_payment_accounts` |
| F-31 | Danh mục — ảnh QR phương thức thanh toán | `VERIFIED` | `e2e/payment-qr.spec.ts` | Added 2026-08-24. "Tải ảnh QR" uploads through a real multipart POST to MinIO, the saved QR is served back by the API and survives a reload, removal clears both row and blob, and a non-image file is refused before it leaves the browser. New columns on `bd_payment_accounts` (`QrImage*`); the reference's own limits could not be observed — see `docs/clone/unknowns.md` Re-verified 2026-08-25 after the rebase onto `main` (Ant Design 6, Tailwind removed) — the catalog UI was rebuilt on antd + a named stylesheet, and the suite was run against the **production build** (`vite preview`), not the dev server: see R-69…R-76 in `03-regression-log.md`. **Chốt 2026-08-25 — màn hình Danh mục coi như hoàn thiện; xem mục 17 của CLAUDE.md trước khi sửa.** |
| F-32 | Danh mục — nhóm phân loại (dialog, tìm kiếm, kéo-thả) | `VERIFIED` | `e2e/taxonomy-groups.spec.ts`, `e2e/taxonomy.spec.ts` | Added 2026-08-24. `Mức độ ưu tiên` is stored and decides the order, and comes back into the dialog on edit; the search sends `filter=` to the API and empties the panel on a term the server cannot match; search is trimmed, case-insensitive and term-wise across every column shown (`TRÁM RĂNG SỨ`, `   trám răng sứ   ` and `sứ trám` all find the same row; whitespace alone is not a search); a real pointer drag reorders the panel as it passes rows and saves the whole order in **one** `POST /taxonomies/reorder`; the entry table does the same through `POST /catalog-entries/reorder`, with the lifted row following the pointer sideways as well as down Re-verified 2026-08-25 after the rebase onto `main` (Ant Design 6, Tailwind removed) — the catalog UI was rebuilt on antd + a named stylesheet, and the suite was run against the **production build** (`vite preview`), not the dev server: see R-69…R-76 in `03-regression-log.md`. **Chốt 2026-08-25 — màn hình Danh mục coi như hoàn thiện; xem mục 17 của CLAUDE.md trước khi sửa.** |
| F-33 | Danh mục — parity dialog (P1+P2) | `VERIFIED` | `e2e/taxonomy-groups.spec.ts` | Added 2026-08-25. Khung dialog dùng chung theo bản gốc (tiêu đề + kẻ, floating label, một nút `Lưu`, không `Huỷ`); menu hàng nhóm còn `Chỉnh sửa`/`Xoá` với grip nhận phím `↑`/`↓`; ba tab đơn giản dùng đúng bộ field của bản gốc và `Đã xoá` xoá bản ghi khi lưu; tab Nghề nghiệp không có nút `Xuất`. P3–P7 còn lại — xem `save/taxonomy-parity-plan.md` Re-verified 2026-08-25 after the rebase onto `main` (Ant Design 6, Tailwind removed) — the catalog UI was rebuilt on antd + a named stylesheet, and the suite was run against the **production build** (`vite preview`), not the dev server: see R-69…R-76 in `03-regression-log.md`. **Chốt 2026-08-25 — màn hình Danh mục coi như hoàn thiện; xem mục 17 của CLAUDE.md trước khi sửa.** |
| F-34 | Danh mục — dialog theo từng danh mục (P3–P7) | `VERIFIED` | `e2e/taxonomy-dialogs.spec.ts` | Added 2026-08-25. Dịch vụ giữ đủ cấu hình giá/thuế, công đoạn và bảo hành, và hai ô tính ra (`Giá sau giảm` 900, `Thực thu` 990 từ giá 1.000 giảm 10% cộng VAT 10%) trả về từ server; thuốc giữ hoạt chất và cả hai giá; chẩn đoán giữ nội dung rich-text và ghi chú; đơn thuốc mẫu lưu dòng thuốc và tự tính `Số lượng`; bệnh án mẫu lưu tờ A4 đã điền. Tờ A4 dựng lại 2026-08-25 theo đúng bản gốc — 3 trang, 17 ô nhập, test khẳng định cả tiêu đề in sẵn lẫn ô nhập trên cả ba trang. 4 bảng mới + 3 cột trên `bd_catalog_entries` Re-verified 2026-08-25 after the rebase onto `main` (Ant Design 6, Tailwind removed) — the catalog UI was rebuilt on antd + a named stylesheet, and the suite was run against the **production build** (`vite preview`), not the dev server: see R-69…R-76 in `03-regression-log.md`. **Chốt 2026-08-25 — màn hình Danh mục coi như hoàn thiện; xem mục 17 của CLAUDE.md trước khi sửa.** |
| F-35 | Vận hành — phân loại và bài viết theo khối | `VERIFIED` | `e2e/operations.spec.ts` | Added 2026-08-25. Rà soát lại toàn bộ theo bản gốc cùng ngày (R-93→R-98): tám khối là tám route, **mỗi khối một tham số sub-tab riêng** và chúng cộng dồn trong URL nên rời đi rồi quay lại vẫn đúng tab; sub-tab lấy đúng từng khối (Khối bảo vệ 3, Khối tài chính 6 tab riêng); Khối điều trị/tài chính có thêm hàng tab giữa Tổng quan/Truy cập. **Chỉ Trang chủ/Quy trình/Công việc là màn bài viết** — 6 sub-tab còn lại là báo cáo, render `OperationReportPanel` chứ không giả vờ là màn bài viết; cột của chúng ghi ở `docs/clone/pages/operations.md`. Panel phân loại dựng riêng theo bản gốc (không tiêu đề/số đếm/mô tả/tìm kiếm/kéo-thả, hành động hiện khi hover). Hai dialog theo đúng chữ và số đo đọc từ DOM. Ảnh trong bài viết lưu ra blob, nội dung chỉ giữ link. Báo cáo và nút xoá của bản gốc còn `UNKNOWN` — xem `docs/clone/unknowns.md` |
| F-36 | Vận hành — bảy màn báo cáo | `VERIFIED` | `e2e/operations-reports.spec.ts`, `OperationsReportWindowTests` | Added 2026-08-26. Sáu endpoint chỉ-đọc (`/operations/reports/...`), lọc theo chi nhánh và theo kỳ Ngày/Tuần/Tháng/Năm với ngày mốc được server làm tròn về kỳ. Báo cáo gộp 5 nguồn thành một nhật ký và lọc theo hành động; Chẩn đoán chưa điều trị đọc `HasTreatmentService = false`; Khách hàng phát sinh gộp theo nhân sự tư vấn, tách khách mới/cũ theo việc phòng khám đã tư vấn người đó trước kỳ hay chưa; Hóa đơn; Hoàn thành theo dịch vụ với 5 thẻ số (gồm % so với kỳ trước); Truy cập dùng chung cho Khối điều trị và Khối tài chính, 3 thẻ số kiêm luôn bộ lọc. Đơn thuốc giữ đúng câu của bản gốc vì bản gốc cũng chưa dựng. Dữ liệu demo: `BlueDentalReportsDemoSeeder` rải 120 ca trên 75 ngày — xem R-99→R-103 về hai lỗi seeder phải sửa trước. Công thức các thẻ số của bản gốc còn `UNKNOWN` — xem `docs/clone/pages/operations.md` |
| F-17 | Báo cáo doanh số | `VERIFIED` | `e2e/report.spec.ts` | Ledger and payment split served by `/clinic-reports`; period switch re-queries |
| F-18 | Kết quả kinh doanh | `VERIFIED` | `e2e/report.spec.ts` | Six rows agree with the cards; result = revenue − refunds − expenses |
| F-19 | Công đoạn điều trị | `VERIFIED` | `e2e/treatment-stage.spec.ts` | Chưa làm → Đang làm → Hoàn thành, persisted. **Model is BlueDental's assumption** — see below |
| F-20 | Phân tách chi nhánh | `VERIFIED` | `e2e/branch-isolation.spec.ts` | Rewritten 2026-08-24 for the stricter contract: naming a branch the account may not work in answers **403** rather than being silently narrowed; `manager` (no assignment) reaches both branches; an unqualified list still narrows to the caller's own |
| F-30 | Chuyển chi nhánh trên header | `VERIFIED` | `e2e/branch-switcher.spec.ts` | Added 2026-08-24, extended the same day. The switcher lists only branches the account may work in; a branch-scoped account neither sees the other branch's catalog nor writes into it; a clinic-wide account (`manager`) switches between both branches and each shows its own seeded catalog, persisted across a reload. The popover now closes on select |
| F-21 | Phiếu điều trị + dòng dịch vụ | `VERIFIED` | `e2e/treatment-plan.spec.ts` | Accepted advise becomes a priced service line on DT01; a line cannot be planned twice |
| F-22 | Thanh toán bệnh nhân | `VERIFIED` | `e2e/treatment-plan.spec.ts` | Only finished work becomes Phải thu; refund capped at what was collected; prepaid held, not counted as paid |
| F-23 | Đơn thuốc | `VERIFIED` | `e2e/prescription.spec.ts` | Medicine lines snapshotted; a dispensed slip is frozen |
| F-24 | Hình ảnh bệnh nhân | `VERIFIED` | `e2e/patient-image.spec.ts` | Real multipart upload to MinIO, bytes fetched back through the API |
| F-25 | Nhân viên | `VERIFIED` | `e2e/staff.spec.ts` | Account created, edited and deleted; weak password refused by Identity |
| F-28 | Tìm kiếm nhanh (Ctrl K) | `VERIFIED` | manual browser run, 2026-08-24 | The palette used to render a search box with no `value`, no `onChange` and no results. It now queries `/patients?filter=` and opens the record; typing TRAN returned 8 real patients and the first one opened `/patient/:id` |
| F-27 | Thanh toán & hoá đơn (màn hoá đơn phòng khám) | `VERIFIED` | manual browser run, 2026-08-24 | Payment recorded through the real modal on `HD-202608-0012`; PostgreSQL shows `paid_amount=1000000`, `Status=3 (PartiallyPaid)`; survives a reload. Excel export returns a real `.xlsx` |
| F-26 | Song ngữ Việt/Anh (i18n) | `VERIFIED` | manual browser sweep, 2026-08-23 | Switch is instant, no reload; 985 keys, 0 untranslated; survives reload via `localStorage`; Zod messages and `Accept-Language` follow the switch |

## F-19 note — assumed, not observed

The reference never exposed a treatment-stage payload that could be read without
mutating production. What was observed is only: the ability subject
`treatmentStage` and its six verbs, the per-service "Thêm công đoạn" action,
`stageIds` / `patientStages[]` on CSKH records, and `stageNote` in the treatment
summary. Everything else — sequence numbers, tooth selection, timestamps, and the
image rule — is BlueDental's own design and is documented as such in
`TreatmentStage`.

## Backend regression nets (not acceptance)

| Suite | Count | Last run |
|-------|-------|----------|
| `BlueDental.Domain.Tests` | 178 | 2026-08-24 — pass |
| `BlueDental.Application.Tests` | 51 | 2026-08-24 — pass |
| `BlueDental.EntityFrameworkCore.Tests` | 39 | 2026-08-24 — pass |
| `BlueDental.HttpApi.Host.Tests` | 15 | 2026-08-24 — pass |
| `BlueDental.FE` Vitest | 3 | 2026-08-24 — pass |

## Still not covered

- **Công cụ** (F-16): gọi điện / SMS / Zalo / hoá đơn điện tử — the reference had
  no data to observe.
- **Xuất Excel / PDF**: wired on patients, labo, CSKH, reports, prescriptions,
  treatment plans and invoices. Screens without an export endpoint still have no
  button.
- **i18n export language**: a PDF or Excel export is still generated in
  Vietnamese regardless of the UI language.
- **i18n on the login screen**: the switcher lives in the app header, which only
  exists after sign-in, so the sign-in page is always Vietnamese.
- Two catalogs ("Thẻ hồ sơ", "Phương thức thanh toán") that the reference does not
  model as catalogs.
