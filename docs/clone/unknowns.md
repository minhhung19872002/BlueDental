# Unknown Reference Behaviors

Source: https://app.nfcdental.com
Last updated: 2026-08-22

Format:
```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /route
Control: element description
Reason: why not observed
Action taken: NONE | PENDING | RESOLVED (see note)
```

---

## RECEPTION PAGE (/reception)

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: "Tạo tiếp nhận" button
Reason: Clicking would create a new reception record (mutating action).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Reception table when populated (columns, row format, data layout)
Reason: Reference showed empty state on 2026-08-21. Screenshots from 2026-08-22 show
5 records — table layout partially observed from user-provided screenshot.
The 9-column table structure (SỐ PHIẾU, BỆNH NHÂN, BÁC SĨ TIẾP NHẬN, NHÂN SỰ TƯ VẤN,
NGUỒN TIẾP NHẬN, TRẠNG THÁI, DỊCH VỤ ĐIỀU TRỊ, TỔNG TIỀN, THAO TÁC) is CONFIRMED
from the reference screenshot provided by the user.
Action taken: PARTIALLY RESOLVED — see docs/clone/pages/reception.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Row action buttons ("Tiếp nhận", "Xong") — click behavior
Reason: Clicking would transition reception status (mutating action).
Action taken: NONE — buttons observed visually but not clicked

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Three-dot (⋮) menu per row — menu items
Reason: Menu could contain mutating actions (cancel, delete, edit).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: "Bác sĩ" filter dropdown — content of options
Reason: Uncertain if opening the dropdown triggers API call or just renders options.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Date picker popup (clicking the calendar icon / date area)
Reason: Full date picker UI and behavior unknown (single date vs range?).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Status counter cards click behavior (Đã hẹn, Đã đến, etc.)
Reason: Unknown if clicking a counter card filters the table or navigates to another view.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: "Tuần" (Week) and "Tháng" (Month) view
Reason: Layout change when switching from "Ngày" to week or month view is unknown.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Detail card — calendar icon button (top-right of card)
Reason: Unknown if clicking opens appointment calendar, reschedule flow, or navigation.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Detail card — Doctor selector dropdown (changing doctor)
Reason: May change assigned doctor (mutating).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Detail card — Outcome radio buttons save mechanism
Reason: Unknown how/when the selected outcome is saved (auto-save vs. explicit save button).
Action taken: NONE

---

## PATIENT LIST PAGE (/patient)

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Tạo hồ sơ" button
Reason: Would create a new patient record (mutating).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Xuất file" (Export) button
Reason: May trigger file generation/download. Format unknown (Excel/PDF/CSV).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Chỉnh sửa" (pencil icon) per row
Reason: Would open patient edit form (mutating).
Action taken: NONE

---

RESOLVED — 2026-08-22
Page: /patient
Control: Patient name link "[DH26012] - FULL NAME" + "Xem" (eye icon) per row
Status: RESOLVED — navigated to patient detail. 10-tab layout confirmed.
See: docs/clone/pages/patient-detail.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Phân loại dịch vụ" dropdown content
Reason: Dropdown options (service categories) not observed.
Action taken: NONE — likely safe to click (read-only dropdown)

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Phân loại theo Tag" dropdown content
Reason: Dropdown options (patient tags) not observed.
Action taken: NONE — likely safe to click (read-only dropdown)

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: Patient detail page layout — /patient/:id
Reason: Page not navigated to. All content unknown.
Action taken: NONE

---

## PAGES NOT YET OBSERVED

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /calendar
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/calendar.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /cskh-grouping
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/cskh-grouping.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /labo
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/labo.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/operations.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /report
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/report.md

---

PARTIALLY RESOLVED — 2026-08-24
Page: /staff
Control: Staff list page — table layout, search, status tabs, pagination, create/edit modal
Status: PARTIALLY RESOLVED — table layout, modal form observed from user-provided screenshots.
11 fields now supported via ABP ExtraProperties (no migration needed). Avatar upload still pending.

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /staff
Control: "Tải ảnh lên" — Staff avatar upload in create/edit modal
Reason: Backend does not support avatar storage for staff. Upload behavior (file format, size limits, crop) unknown.
Action taken: NONE — placeholder rendered in FE modal, non-functional

---

RESOLVED — 2026-08-24
Page: /staff
Control: "Tỉnh/ Thành phố", "Quận/ Huyện", "Xã/ Phường" dropdowns in create/edit modal
Status: RESOLVED — fields stored via ABP ExtraProperties (provinceId, districtId, wardId).
Province/district/ward data source API not yet implemented — dropdowns render empty.

---

RESOLVED — 2026-08-24
Page: /staff
Control: "Địa chỉ" text input in create/edit modal
Status: RESOLVED — field stored via ABP ExtraProperties. Table column shows real value.

---

RESOLVED — 2026-08-24
Page: /staff
Control: "Bác sĩ", "Phụ tá", "Y sĩ" checkboxes in create/edit modal
Status: RESOLVED — boolean fields stored via ABP ExtraProperties (isDentist, isAssistant, isHygienist).
How these map to roles/permissions in reference is still unknown.

---

RESOLVED — 2026-08-24
Page: /staff
Control: Working hours (4 time fields) in create/edit modal
Status: RESOLVED — morningStartTime, morningEndTime, afternoonStartTime, afternoonEndTime stored via ABP ExtraProperties.
HH:mm format validated on both FE (Zod) and BE (regex). Defaults: 08:00, 12:00, 13:00, 17:00.

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /materials
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/materials.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/taxonomy.md

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /tools
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/tools.md

---

## GLOBAL CHROME

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: Global
Control: Notification panel (bell icon click)
Reason: Notification content, format, real-time behavior unknown.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: Global
Control: User menu dropdown (avatar + name click)
Reason: Menu items (profile, settings, logout, etc.) unknown.
Action taken: NONE

---

## RESOLVED

---

RESOLVED — 2026-08-21
Page: Global
Control: Global search modal (Ctrl+K)
Status: PARTIALLY RESOLVED — modal layout, 4 categories (Khách hàng, Lịch hẹn, CSKH, Nhân viên), minimum 2 chars. Search results format STILL UNKNOWN.
See: docs/clone/components.md § "Global Search Modal"

---

RESOLVED — 2026-08-21
Page: Global
Control: Branch selector dropdown
Status: RESOLVED — "Chi nhánh" header, "Tất cả chi nhánh" option, individual branches with green dot for selected.
See: docs/clone/components.md § "Branch Selector Dropdown"

---

RESOLVED — 2026-08-21
Page: Global
Control: Language selector (globe icon)
Status: RESOLVED — popover with "Ngôn ngữ" header, "Tiếng Việt" (default ✓), "Tiếng Anh".
See: docs/clone/components.md § "Language Selector Popover"

---

RESOLVED — 2026-08-21
Page: Global
Control: Sidebar collapse/expand behavior
Status: RESOLVED — toggle button in header, collapsed ~70-80px (icon + label stacked), expanded ~180px (icon + label horizontal, "MENU"/"KHÁC" section headings).
See: docs/clone/components.md § "Sidebar"

---

RESOLVED — 2026-08-22
Page: /reception
Control: Reception table populated state columns and row format
Status: RESOLVED — user-provided screenshot confirmed 9-column table:
SỐ PHIẾU | BỆNH NHÂN | BÁC SĨ TIẾP NHẬN | NHÂN SỰ TƯ VẤN | NGUỒN TIẾP NHẬN | TRẠNG THÁI | DỊCH VỤ ĐIỀU TRỊ | TỔNG TIỀN | THAO TÁC
Patient column shows name + [Mới/Cũ] badge + phone number on second line.
Action buttons: "Tiếp nhận" (blue, for Chờ khám), "Xong" (green, for Đang khám), ⋮ (all rows).
See: docs/clone/pages/reception.md

## Tiếp nhận — header row of the reception table is 256px tall

Status: OPEN, cosmetic. The screen works; there is a blank band above and below
the column titles.

What was established:

- The header cell's own content is small: cloning the same `<th>` into a
  detached table renders it at **23px**.
- Inside the real table it is **256px**, and so is every other `<th>` in the row.
- The `<table>` computes to 722px while thead(natural) + tbody = ~490px. Forcing
  `table { height: 1px }` does not shrink it, so the height is not inherited
  from an ancestor being stretched.
- It is not our stylesheet: disabling `styles/index.css` entirely makes the row
  **taller** (287px), not shorter.
- Unaffected by: `tr { height }`, `th { height/padding/line-height/display }`,
  `tbody { height: 100% }`, the Table's inline `style`, or the card's
  `min-height`.
- Other screens using the same antd Table (e.g. Thanh toán) render a normal
  header, so it is specific to this table's configuration rather than global.

Next thing to try: bisect `ReceptionTable`'s nine column definitions — the
difference from a working table is most likely in one of them (`render`,
`width`, or `ellipsis`), not in CSS.

---

## Danh mục — assumptions made while cloning the redesigned layout (2026-08-24)

Observed read-only on `staging.nfcdental.com/taxonomy/*`. Nothing was submitted
on the reference; every write below happened only against the local stack.

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: initial-letter colour square in the name column
Reason: only five letters could be observed (A, I → blue; S → amber; T → rose;
        M → emerald). That fits `charCode % 8`, so BlueDental uses an
        eight-colour palette indexed that way; the four unobserved slots
        (violet, cyan, indigo, pink) are our own choice.
Action taken: PENDING — see src/components/LetterAvatar.tsx
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: "Xuất" button
Reason: not clicked — the reference is read-only and the button's target
        (server-rendered file vs client export) could not be established
        without issuing the request.
Action taken: PENDING — BlueDental exports the current page of the table to
        .xlsx client-side via utils/exportExcel.ts.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: drag grips on group rows and table rows
Reason: dragging on the reference would have written a new sort order.
Action taken: PENDING — BlueDental persists a drag by rewriting `sortOrder` on
        every row whose position changed, and offers the same two moves from
        the keyboard (grip focused, ArrowUp/ArrowDown) and from the group row's
        overflow menu, because a drag-only affordance is unreachable without a
        pointer.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: group row overflow menu ("Thêm thao tác")
Reason: not opened on the reference.
Action taken: PENDING — BlueDental offers Đổi tên nhóm / Di chuyển lên /
        Di chuyển xuống / Xoá nhóm.
```

## Thẻ hồ sơ & Phương thức thanh toán — what was and was not built (2026-08-24)

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/payment-method, /taxonomy/tags
Control: "Tải ảnh QR" upload in both Thêm phương thức dialogs
Reason: uploading would have written to the reference. The field is visible in
        the dialog on staging (an image-plus button over a hidden file input),
        but its size limits, accepted types and where the image is shown
        afterwards could not be observed without submitting.
Action taken: BUILT with stated assumptions (2026-08-24). The upload itself is
        confirmed on the reference; the parts that could not be observed were
        chosen as follows, and each is a guess to revisit if the reference can
        ever be observed safely:
          - accepted types: JPEG, PNG, WEBP — the same set patient images accept.
          - size limit: 5 MB, chosen because a QR is a small square image.
          - one QR per account, replaced rather than accumulated.
          - the QR is shown in the add/edit dialog only. The reference's MoMo
            column list (Số điện thoại · Tên chủ tài khoản · Lần cập nhật cuối ·
            Thao tác) has no QR column, so none was added to the table.
        Storage follows the patient-image rule: bytes in MinIO, only the blob
        name in PostgreSQL.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/payment-method
Control: footer sentence
Reason: the reference renders "Hiển thị 0 trên 0" with no counted noun, unlike
        every other catalog footer ("... bản ghi", "... thẻ hồ sơ").
Action taken: matched exactly rather than inventing a noun.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/payment-method
Control: changing an account between MoMo and Ngân hàng
Reason: not attempted on the reference.
Action taken: PENDING — BlueDental fixes the kind at creation. A MoMo wallet and
        a bank account hold different required fields, so switching would leave
        the row half-filled; the user deletes and re-adds instead.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/tags
Control: whether a tag can be deactivated rather than deleted
Reason: only create was observed.
Action taken: PENDING — the entity carries IsActive and the API accepts it, but
        the screen only offers edit and delete, as the reference does.
```

## Nhóm phân loại — dialog and ordering (2026-08-24)

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: the "Tạo nhóm" dialog when editing an existing group
Reason: only the create dialog was seen. Whether the reference reuses the same
        dialog for an edit, and what it titles it, was not observed.
Action taken: BlueDental reuses it and titles the edit "Sửa nhóm".
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: where a newly created group lands in the list
Reason: the dialog prefills "Mức độ ưu tiên" with 0, but no group was created on
        the reference, so where 0 puts a new group among existing ones — and how
        the reference breaks ties between equal priorities — was not observed.
Action taken: BlueDental keeps the prefill at 0 as observed and sorts by
        (priority, name), so a new group lands among the other zeros
        alphabetically rather than being appended to the end.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: dragging a group while a search term is in the panel
Reason: not attempted on the reference.
Action taken: BlueDental refuses it — the panel is showing matches, not the
        order, so positions in it are not positions in the catalog. The grip
        shows "Xoá bộ lọc để sắp xếp lại".
```

## Danh mục — quan sát 2026-08-25 (rà soát parity toàn bộ tab)

Xem `save/taxonomy-parity-plan.md` để có bản đối chiếu đầy đủ. Những gì không mở được
mà không chạm vào dữ liệu staging:

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/service
Control: select "% thuế" trong dialog dịch vụ
Reason: chỉ thấy giá trị mặc định "KCT"; mở select ra thì an toàn nhưng danh sách chưa
        được ghi nhận trong lượt này.
Action taken: NONE — cần một lượt quan sát riêng trước khi dựng.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/service
Control: "Giá sau giảm" và "Thực thu từ khách (Đã gồm VAT)"
Reason: là ô tính ra, nhưng công thức khi kết hợp "Sau thuế" + giảm giá "%" chỉ suy được
        bằng cách nhập thử — tức là gõ vào form của staging.
Action taken: NONE — không gõ vào form bản gốc. Công thức sẽ là giả định của BlueDental
        và phải ghi lại khi hiện thực.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/service
Control: tab "Bảo hành" — 7 ô chọn thời hạn
Reason: chỉ thấy trạng thái mặc định ("Không bảo hành" được tích). Có loại trừ nhau hay
        không thì phải bấm thử.
Action taken: NONE — BlueDental sẽ coi là loại trừ nhau (một thời hạn duy nhất) vì đó là
        cách duy nhất có nghĩa với một cột WarrantyDays.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/prescription-template
Control: select "Sử dụng" trên dòng thuốc
Reason: chưa mở; danh sách lựa chọn chưa biết.
Action taken: NONE
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: mọi dialog danh mục
Control: hành vi khi bấm "Lưu"
Reason: submit sẽ ghi vào staging.
Action taken: NONE — thông báo thành công, validate phía server và quy tắc tự sinh
        "Mã dịch vụ" đều chưa quan sát được.
```

## Danh mục — giả định khi hiện thực P3–P7 (2026-08-25)

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/service
Control: "Giá sau giảm" và "Thực thu từ khách (Đã gồm VAT)"
Reason: là ô tính ra; công thức chỉ suy được bằng cách gõ vào form của bản gốc.
Action taken: BlueDental chọn — giảm giá trừ vào giá đã nhập trước, rồi cộng VAT
        nếu đang ở "Trước thuế" (đang ở "Sau thuế" thì giá đã gồm VAT nên không
        cộng nữa). Cài trong CatalogServiceConfig, có test Domain khẳng định.
        Hai ô này chỉ hiện số sau khi đã lưu — không tính lại ở trình duyệt để
        server và giao diện không thể bất đồng về công thức.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/service
Control: tab "Bảo hành"
Reason: bản gốc vẽ 7 ô vuông; không bấm thử nên không biết có loại trừ nhau không.
Action taken: BlueDental coi là loại trừ — chọn một thời hạn sẽ bỏ các thời hạn
        khác, vì chỉ có một cột WarrantyDays. Ô "Tuỳ chỉnh" ghi thẳng số ngày.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/service
Control: cột "Giá trị" của bảng công đoạn
Reason: bảng rỗng trên bản gốc, không có đơn vị ghi bên cạnh.
Action taken: lưu đúng con số đã nhập; ý nghĩa (tiền hay phần trăm) để cho module
        điều trị quyết định sau.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/medical-record-template
Control: định dạng lưu của tờ bệnh án
Reason: không xem được payload lưu.
Action taken: BlueDental lưu JSON các ô đã điền vào cột Content, khoá theo tên ô,
        để bố cục tờ A4 đổi về sau mà không cần migration — và để QuestPDF in
        được từ cùng dữ liệu đó (CLAUDE.md §8).
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/medicine
Control: ô "Cách dùng"
Reason: chưa rõ là ô nhập tự do hay select.
Action taken: dựng thành ô nhập tự do.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/<catalog>
Control: panel nhóm khi có rất nhiều nhóm
Reason: chi nhánh trên bản gốc chỉ có 9 nhóm, không thấy được nó phân trang,
        cuộn vô hạn hay tải hết một lần.
Action taken: BlueDental tải tối đa 200 nhóm một lần và không phân trang — quá số
        đó sẽ mất phần đuôi mà không báo. Cần quan sát lại trước khi có phòng khám
        thật vượt ngưỡng này.
```

