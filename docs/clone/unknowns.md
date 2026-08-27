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

RESOLVED 2026-08-26 — /cskh-grouping surveyed in full on staging.nfcdental.com
(reference chuẩn mới): cả 5 care-type tab + tab Phân nhóm CSKH, toàn bộ API
params, ma trận cột, dialogs, Excel export structure. See
docs/clone/pages/cskh-grouping.md.

UPDATE 2026-08-26 (chiều): user cho phép thử mutation với network-block
client-side (fetch/XHR patch — POST/PUT/PATCH/DELETE không bao giờ tới server;
reload xác nhận không persist). Kết quả: capture đủ POST /customer-care (2
biến thể) + PUT /customer-care/{id}; nút send mở dialog "Gửi ZBS qua Zalo"
(không gửi gì khi mở). Chi tiết: docs/clone/pages/cskh-grouping.md +
docs/clone/api.md.

What remains unknown there (all recorded in the page doc):

UNKNOWN_REFERENCE_BEHAVIOR
Page: /cskh-grouping (tab=care, page=remind-appointment)
Control: Dialog "Gửi ZBS qua Zalo" — endpoint gửi thật sau khi chọn mẫu
Reason: Chi nhánh test chưa config Zalo OA (GET /zalo-oa-templates → 400,
không có mẫu để chọn; Gửi khi chưa chọn mẫu chỉ là validation client).
Action taken: Mở dialog + capture GET templates. Không thể quan sát thêm.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /cskh-grouping (tab=care)
Control: Counter "Đã gửi Zalo"
Reason: Click chỉ đổi pressed-state, không quan sát được refetch/param (0 record).
Action taken: NONE

UNKNOWN_REFERENCE_BEHAVIOR
Page: /cskh-grouping (tab=group)
Control: Filter "Thẻ tag" — param name khi chọn
Reason: Chi nhánh test không có tag nào ("Không có thẻ tag").
Action taken: NONE
Local status (2026-08-27): dropdown lấy option từ danh mục Thẻ hồ sơ
(GET /v1/app/patient-tags, IsActive=true) theo chỉ định của user. Bệnh nhân
nay mang `TagIds` (uuid[] trên bd_patients, migration AddPatientTagIds, gán
qua multi-select "Phân loại Tag" trong form bệnh nhân, id lạ/khác chi nhánh
bị lọc bỏ server-side); grouping-patients và GET /v1/app/patients lọc thật
theo tagId. Param name gốc vẫn chưa xác minh được — local chọn `tagId`.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /cskh-grouping (tab=care)
Control: Dialog "Lưu tin nhắn" — request submit cuối
Reason: Combobox "Cấu hình" rỗng trên chi nhánh test → validation chặn submit.
Action taken: Dialog + data endpoints đã quan sát; submit không thể trigger.
Local status (2026-08-27): 2 data endpoints đã implement + seed; nút Gửi
validate Cấu hình rồi toast placeholder. Quay lại implement send khi có
cấu hình gửi thật (yêu cầu user).

UNKNOWN_REFERENCE_BEHAVIOR
Page: /cskh-grouping (tab=group, dialog file-heart)
Control: Nhãn màu "Khá" — giá trị colorCode
Reason: Chỉ capture được green (Tốt) / orange (Bình thường) / red (Khiếu nại);
"blue" cho Khá là suy luận từ pattern + màu hiển thị #2671D8.
Action taken: Inferred "blue".

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /labo
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/labo.md

---

RESOLVED 2026-08-25 — /operations observed read-only across all eight
divisions, their sub-tabs and both dialogs. Structure, columns, API parameters
and dialog fields recorded in docs/clone/pages/operations.md.

What remains unknown there: the six report sub-tabs and the Truy cập tab (no
data to observe, and no BlueDental tables behind them yet), and whether the
delete buttons confirm before deleting (not clicked — it is production).

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


```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /taxonomy/medicine, /taxonomy/prescription-template,
      /taxonomy/medical-record-template, /taxonomy/tags, /taxonomy/payment-method
Control: xoá bản ghi ở 5 danh mục không có cặp "Đang hoạt động" / "Đã xoá"
Reason: 6 danh mục có cặp checkbox thì đã quan sát được rõ — API của bản gốc trả
        về cả bản ghi `isDeleted: true` và dòng đó chỉ còn nút "Chỉnh sửa". Còn 5
        danh mục này không có checkbox nào, và chi nhánh quan sát được thì không
        có dữ liệu để xem một dòng đã xoá trông ra sao, nên không biết bản gốc
        xoá cứng hay xoá mềm rồi ẩn đi.
Action taken: BlueDental giữ nguyên hành vi cũ cho 5 danh mục này — vẫn là xoá
        mềm của ABP nhưng dòng bị ẩn khỏi danh sách. Nếu ẩn mà bản gốc không ẩn
        thì chỉ khác ở chỗ không khôi phục được; chọn cách này vì ở đây không có
        chỗ nào bỏ được cờ đã xoá, nên hiện ra sẽ thành dòng chết không gỡ được.
```

## Voucher — tab "Tạo một lượt" (2026-08-26)

ĐÃ QUAN SÁT ĐƯỢC (một phần) qua 3 ảnh chụp staging người dùng cung cấp
(2026-08-26): ô số lượng "Nhập số lượng mã (tối đa 100)"* rộng ~50% desktop;
hàng "Chọn mã để cấu hình riêng" / checkbox "Cấu hình tất cả"; lưới thẻ 4
cột, mỗi thẻ = "#N" + mã "HN-..." (đậm, xanh khi chọn) + ô "Tên voucher" có
sao đỏ trong placeholder; thẻ #1 mang đúng mã đang hiển thị ở tab "Tạo theo
số lượng"; bật "Cấu hình tất cả" → mọi thẻ viền xanh, ô số lượt full-width,
không có ô mã; chọn từng thẻ → ô "Mã ngẫu nhiên" (HN- + shuffle, sửa mã thẻ
đang chọn) cạnh ô "Nhập số lượt tối đa" + hint "Chỉ chữ in hoa, số, dấu gạch
ngang. Để trống để tạo tự động."; phần cấu hình chung (ngày, %/VNĐ, phạm vi,
dịch vụ, ngày trong tuần, exclusive) nằm dưới. Đã dựng theo đúng các ảnh này.

Bổ sung (ảnh 2026-08-26, 100 mã): lưới thẻ có scroll RIÊNG bên trong danh
sách (hàng cuối bị cắt ngang thẻ; local chốt 420px theo yêu cầu), không đẩy cả body
modal dài ra — các ô cấu hình chung bên dưới vẫn cuộn theo body như cũ.
Đã áp max-height + overflow-y:auto cho `.voucher-batch-cards`.

Còn lại chưa quan sát được:

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /voucher (staging.nfcdental.com — dialog "Tạo voucher khuyến mãi")
Control: tab "Tạo một lượt" — hành vi không nhìn thấy trên ảnh tĩnh:
        (1) payload gửi lên khi submit (một request batch hay N request lẻ,
            tên field), (2) click vào thẻ khi đang bật "Cấu hình tất cả" thì
            checkbox có tự bỏ chọn không, (3) xử lý khi hai thẻ trùng mã,
        (4) cách hiển thị lỗi khi thiếu tên voucher (viền đỏ thẻ? toast?).
Reason: ảnh chụp là tĩnh; phiên staging đã hết hạn nên không bấm thử được,
        và dù còn phiên cũng không được submit form trên hệ thống tham chiếu.
Action taken: BlueDental tự chọn: 1 request POST /vouchers/batch với
        configureAll + items[]; click thẻ khi đang "Cấu hình tất cả" sẽ bỏ
        chọn checkbox và chuyển sang cấu hình riêng thẻ đó; mã trùng trong
        danh sách bị chặn ở cả FE (toast) lẫn BE (BusinessException); thiếu
        tên → viền đỏ thẻ + toast "Vui lòng nhập tên cho tất cả voucher".
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /voucher (staging.nfcdental.com — dialog "Tạo voucher khuyến mãi")
Control: prefix "HN-" đứng trước mã voucher (addon của ô mã, và trên các thẻ
        ở tab "Tạo một lượt")
Reason: chỉ quan sát được duy nhất giá trị "HN-" trên staging; chưa bắt được
        request tạo voucher nên không biết prefix nằm trong payload hay do
        server tự gắn, và không biết nó là hằng số hệ thống hay cấu hình
        theo phòng khám. Mẫu mã bệnh nhân của bản gốc ({ClinicPrefix}{YY}{SEQ},
        ví dụ "DH" = Đức Hạnh — xem docs/clone/data-model.md) gợi ý mỗi phòng
        khám có prefix riêng, và "HN-" nhiều khả năng là prefix của phòng khám
        trên staging — nhưng chưa xác nhận được.
Action taken: BE sở hữu prefix — hằng VoucherConsts.DefaultPrefix ("HN"),
        trả về qua GET /api/v1/app/vouchers/code-prefix; FE fetch khi mở
        dialog tạo (useVoucherCodePrefix, cache cả phiên) và chỉ giữ "HN-"
        làm fallback hiển thị khi chưa fetch xong. Mã voucher vẫn sinh ở FE
        (generateRandomCode) dưới dạng trần; BE nối prefix vào khi lưu
        (ComposeFullCode) nên cột Code giữ mã đầy đủ "HN-XXXXXXXX" — đúng mã
        khách dùng khi quy đổi. Prefix vẫn lưu riêng ở cột Voucher.Prefix
        (nullable, tối đa 20 ký tự) để dialog sửa tách lại phần trần hiển thị.
        Khi xác định được nguồn thật (cấu hình chi nhánh?) sẽ nối
        VoucherConsts vào đó.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /labo/mau-labo (app.nfcdental.com, khảo sát 2026-08-27)
Control: hàng dữ liệu, nút xem chi tiết, modal "Thông tin chung", lightbox
        "File phòng khám gửi về", và nút "Xuất Excel"
Reason: chi nhánh duy nhất của tài khoản khảo sát (NHA KHOA ĐỨC HẠNH PREMIUM)
        có 0 phiếu labo — GET /api/v1/orders trả data rỗng ở cả 4 tab lọc và
        mọi khoảng thời gian. Không thể tạo phiếu trên bản gốc để xem, và
        clinic chỉ có 1 chi nhánh nên không mượn được dữ liệu chi nhánh khác.
Action taken: NONE trên bản gốc. Toàn bộ cấu trúc cột, ánh xạ trường, hai
        chiều trạng thái (status / statusClinic), bảng màu badge, nội dung
        modal chi tiết, giới hạn upload ảnh (5 ảnh × 5 MB, thư mục
        labo/mau-labo), chốt "Chỉ được huỷ đơn hàng mới", và layout tờ in
        PHIẾU ĐẶT HÀNG LABO đều đọc từ bundle client đã phát hành
        (_next/static/chunks/fdc1fdcd4a190d4f.js, 371d50d53d0310c9.js) —
        xem docs/clone/pages/labo.md §2. Cần đối chiếu lại bằng mắt khi nào
        có chi nhánh tham chiếu thật sự có phiếu labo.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /labo/service-material (panel nhóm bên trái)
Control: kéo-thả sắp xếp nhóm phân loại
Reason: kéo-thả sẽ ghi thứ tự mới xuống server (mutation) nên không thử.
        Bundle không nạp thư viện dnd cho panel này, và dialog nhóm có ô
        "Mức độ ưu tiên" — hai dấu hiệu cho thấy thứ tự chỉ đặt bằng số,
        khác với panel nhóm ở /taxonomy vốn có kéo-thả.
Action taken: NONE. Tạm coi là KHÔNG có kéo-thả; nếu sau này quan sát được
        ngược lại thì bổ sung.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /labo/supplier, /labo/bite, /labo/finish-line, /labo/nhip,
      /labo/service-material
Control: nút Xoá, nút Lưu trong mọi dialog, và thông báo lỗi phía server
Reason: đều là thao tác ghi lên hệ thống production.
Action taken: NONE. Chỉ mở dialog để đọc cấu trúc trường rồi đóng bằng X /
        Escape. Quy tắc validate lấy từ schema Joi trong bundle
        (xem docs/clone/pages/labo.md §3.3, §4.3, §5.2).
```
