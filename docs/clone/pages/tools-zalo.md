# Tools — Zalo OA Tab (`/tools/zalo-oa`)

Source: `UNKNOWN_REFERENCE_BEHAVIOR` — the reference application had no Zalo OA
configuration data to observe. Page design is BlueDental's own, based on BA
requirements and the Zalo OA API specification. Implemented 2026-09-28.

## Route

`/tools/zalo-oa` (one of four top-level tool routes; see `tools.md`)

The route defaults to `?subTab=config`. Sub-tab values and their URL params:

| # | Label | `?subTab=` value | Default |
|---|-------|------------------|---------|
| 1 | Cấu hình | `config` | yes |
| 2 | Mẫu ZBS | `template` | no |
| 3 | Danh sách tin Zalo | `campaign` | no |

---

## Sub-tab 1 — Cấu hình (`?subTab=config`)

Implemented in `src/features/tools/components/ZaloConfigView.tsx`.

### Disconnected state

Shown when `GET /api/v1/app/zalo/status` returns `{ isConnected: false }`.

| Element | Type | Behaviour |
|---------|------|-----------|
| Zalo OA logo / illustration | Image | Static |
| "Kết nối Zalo OA" | Button (primary) | Calls `GET /connect-url`, opens the returned URL in a new tab to begin the OAuth flow |
| Instruction text | Paragraph | Describes why connecting is useful |

### Connected state

Shown when `isConnected: true`.

| Element | Type | Behaviour |
|---------|------|-----------|
| OA avatar | Image | `avatarUrl` from status; fallback placeholder |
| OA name | Heading | `oaName` from status |
| Token expiry | Text | `expiresAt` formatted `DD/MM/YYYY HH:mm` |
| Bật / Tắt kết nối | Toggle (Switch) | Calls `PUT /zalo/enabled { enabled }`; optimistic update |
| "Đồng bộ thông tin" | Button | Calls `POST /zalo/bootstrap-import`; refreshes OA name + avatar |
| "Làm mới token" | Button | Calls `POST /zalo/refresh-token`; shows success/error toast |
| "Ngắt kết nối" | Button (danger) | Opens confirm dialog "Xác nhận ngắt kết nối Zalo OA?"; on confirm calls `DELETE /zalo/connection` then returns to disconnected state |

---

## Sub-tab 2 — Mẫu ZBS (`?subTab=template`)

Implemented in `src/features/tools/components/ZaloTemplateView.tsx`.

Source: `GET /api/v1/app/zalo/templates` (data from Zalo API, cached 5 min).

### Table columns

| # | Column | Notes |
|---|--------|-------|
| 1 | Tên mẫu | Template name |
| 2 | Mã mẫu | Template ID (monospace) |
| 3 | Trạng thái | `<Tag>` with colour strategy: `enable` → green, `pending_review` → gold, `reject` → red, `disable` → default (grey) |
| 4 | Tham số | Comma-separated list of required parameter names |

### Toolbar

| Element | Behaviour |
|---------|-----------|
| "Làm mới" button | Invalidates `["zalo-templates"]` cache and refetches |
| Pager | 10 / 20 / 50 rows per page; server-side |

Empty state: "Chưa có mẫu nào" when the template list is empty or the OA is not
connected.

---

## Sub-tab 3 — Danh sách tin Zalo (`?subTab=campaign`)

Implemented in `src/features/tools/components/ZaloMessageView.tsx`.

Source: `GET /api/v1/app/zalo/messages` + `GET /api/v1/app/zalo/messages/stats`.

### Counter tiles (3 tiles above the table)

| Tile | Value | Colour |
|------|-------|--------|
| Tổng số tin | `stats.total` | Blue |
| Thành công | `stats.sent` | Green |
| Thất bại | `stats.failed` | Red |

### Filter bar

| Control | Param |
|---------|-------|
| Date range picker (from / to) | `fromDate` / `toDate` |
| Status filter (Tất cả / Thành công / Thất bại) | `status` |

### Table columns

| # | Column | Notes |
|---|--------|-------|
| 1 | Số điện thoại | Recipient phone number |
| 2 | Mẫu | Template name (from `templateName` on the log record) |
| 3 | Thời gian | `sentAt` formatted `DD/MM/YYYY HH:mm` |
| 4 | Kết quả | `<Tag>`: Thành công (green) / Thất bại (red); hover shows Zalo error code on failure |

Pager: 10 / 20 / 50 rows; server-side (`skipCount` + `maxResultCount`).

Empty state: "Chưa có tin nhắn nào" when no messages match the filter.

---

## SendZaloDialog (CSKH screen)

Component: `src/features/cskh/components/SendZaloDialog.tsx`

Opened from the CSKH patient list row action "Gửi Zalo". Allows staff to send a
ZNS to a patient's registered phone number.

| Step | UI element | Notes |
|------|-----------|-------|
| 1 | Template picker (Select) | Loads from `GET /zalo/templates`; shows name + status tag |
| 2 | Parameter form | Dynamic — one Input per required parameter in `listParams`; built from the selected template's schema |
| 3 | "Gửi" button | Disabled and loading while `mutateAsync` is in flight; shows Loader2 spinner |

Success: toast "Gửi Zalo thành công".
Failure: inline error below the form showing the Zalo error code and message (not
a toast, to allow the user to correct and resend).

---

## Known unknowns (`UNKNOWN_REFERENCE_BEHAVIOR`)

- Exact layout and element order of the reference's Zalo OA tab could not be
  observed — no configuration data was present.
- Whether the reference exposes a template preview image in the table.
- Whether there is a "Chi tiết" action on the message log rows.
- Whether the reference supports bulk-send (campaign) from this tab or only
  single-send from CSKH.
