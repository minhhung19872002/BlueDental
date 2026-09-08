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

UNKNOWN_REFERENCE_BEHAVIOR
Page: /report (tab Quản lý thu chi, tab Luân chuyển dòng tiền V2)
Control: nút Lưu trong các dialog "Thêm khoản thu", "Thêm danh mục thu nhập",
      "Tạo giao dịch nạp / rút / luân chuyển"; các nút Chỉnh sửa / Xóa /
      Duyệt / Từ chối trên từng dòng
Reason: đều ghi dữ liệu lên production. Chỉ mở dialog để đọc cấu trúc trường
      rồi đóng bằng Escape; không nhập, không bấm Lưu.
Action taken: NONE. Bản local dựng modal cùng cấu trúc trường, submit chỉ hiện
      toast demo (không có API ghi). Validate phía server, thông báo lỗi và
      hộp xác nhận xóa/duyệt: chưa biết.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /report?reportTab=cashflow (sub Chi phí)
Control: dialog "Thêm mới" của tab Chi phí
Reason: chỉ mở dialog của tab Thu nhập ("Thêm khoản thu": Ngày tạo | Ngày
      thực thu*, Chọn nhân viên | Chọn khách hàng, Số tiền*, Hình thức |
      Người nộp | Mục thu*, Nội dung thu). Bản chi được suy ra bằng cách đổi
      thu→chi và "Người nộp"→"Người nhận".
Action taken: NONE. Cần quan sát lại khi có dịp an toàn.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /report?reportTab=cashflow-v2 (sub Danh mục)
Control: dialog "Thêm mục" của Danh mục sổ quỹ
Reason: không mở. Cột bảng là Tên danh mục / Mã màu / Thao tác nên bản local
      dựng form Tên danh mục* + Mã màu (ColorPicker).
Action taken: NONE.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=appointment — dialog "Tạo lịch hẹn", khối "Lịch đã hẹn"
Control: nút tròn "Đổi cách xem" (chỉ hiện ở chế độ Ngày)
Reason: bấm nút là thao tác đọc, đã bấm và chụp lại được: icon đổi từ dạng
        hàng sang dạng cột, và lưới lùi sang phải chừa một cột nhãn ~200px.
        Nhưng ngày đang xem không có lịch hẹn nào nên không thấy được nội
        dung hai bố cục khác nhau ra sao. Không tạo lịch trên bản gốc để thử.
Action taken: NONE thêm trên bản gốc. ĐÃ GIẢI ĐÁP (2026-08-31): dialog lịch hẹn
        trên `main` dựng nút này thành công tắc "Xem theo giờ" / "Xem theo bác
        sĩ" — đúng cách hiểu "một làn chung" đổi sang "mỗi bác sĩ một làn".

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=appointment — dialog "Tạo lịch hẹn"
Control: nút "Lưu", nút "+ Thêm ngay" trong thẻ Ghi chú
Reason: đều ghi dữ liệu lên hệ thống production.
Action taken: NONE. Chỉ mở dialog, mở dropdown bác sĩ, đổi Ngày/Tuần/Tháng
        rồi đóng bằng X. Cấu trúc trường, kích thước và bảng màu đọc từ DOM
        và computed style — xem docs/clone/pages/patient-detail.md.

RESOLVED 2026-09-05 — nút "Lịch sử thay đổi" (/patient/<id>?tab=appointment)
        Đã mở được trên staging (chỉ đọc) với một bệnh nhân có sẵn lịch sử:
        thẻ thống kê, hàng lọc, bảng / dòng thời gian, panel mở rộng và
        footer đều đã đọc từ DOM + computed style; ghi ở
        docs/clone/pages/patient-detail.md và docs/clone/api.md. Còn chưa
        rõ: nút "Xuất dữ liệu" của bản gốc đang lỗi khi quan sát, nên nội
        dung file xuất là của BlueDental tự định nghĩa (CSV / Excel / JSON đủ
        cột). Không thao tác ghi nào được thực hiện trên bản gốc.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=consulting — bảng "Phiếu tư vấn"
Control: tay nắm kéo-thả ở cột đầu, và nút "Lưu" trong popover "Cấu hình cột"
Reason: cả hai đều ghi thứ tự / cấu hình cột xuống server.
Action taken: NONE. Đã đọc được danh sách cột và dạng công tắc bật/tắt trong
        popover. BlueDental chưa dựng tay nắm kéo-thả vì chưa có endpoint sắp
        xếp; cấu hình cột hiện chỉ giữ trong phiên.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=consulting — thao tác trên dòng chẩn đoán
Control: nút lịch (biểu tượng calendar) giữa "Tạo Dịch Vụ" và nút xoá
Reason: không bấm vì có khả năng mở luồng tạo lịch hẹn rồi ghi dữ liệu.
Action taken: NONE. BlueDental hiểu là mở dialog đặt lịch cho bệnh nhân đó,
        điền sẵn lý do từ tên chẩn đoán. Cần xác nhận lại.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id> — chế độ xem "Bệnh án"
Control: nút "Đồng bộ phiếu" ở thanh dưới
Reason: nút này ghi dữ liệu vào phiếu (nhiều khả năng chép thông tin bệnh nhân
        vào phần Hành chính của tờ A4). Không bấm trên bản gốc.
Action taken: NONE. BlueDental chưa dựng nút này; các ô hành chính vẫn nhập tay.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id> — chế độ xem "Bệnh án"
Control: bản in của 8 biểu mẫu còn lại (1, 3, 4, 5, 6, 7, 8, 9)
Reason: phải bấm "Thêm" mới thấy được bố cục từng tờ, mà "Thêm" là thao tác ghi.
Action taken: NONE. BlueDental liệt kê đủ 9 biểu mẫu đúng thứ tự và màu, nhưng
        chỉ vẽ được tờ số 2 (Bệnh án ngoại trú RHM) — tờ mà Danh mục đã dựng.
        Thêm 8 tờ kia sẽ báo rõ là chưa có bản in, không mở trang trắng.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id> — phân quyền cho Bệnh án
Control: tên subject phân quyền của bản gốc cho phiếu bệnh án
Reason: chỉ quan sát được endpoint (/patient-medical-record/files/{id}), không
        đọc được ma trận quyền của bản gốc cho mục này.
Action taken: NONE. BlueDental tự đặt subject `patientMedicalRecord`
        (read/create/update/delete/print). Cần đối chiếu lại nếu xem được ma
        trận quyền của bản gốc.

## UNKNOWN_REFERENCE_BEHAVIOR — ô tích trên thẻ phiếu bệnh án

Page: /patient/{id} -> Bệnh án -> Mục lục bệnh án
Control: ô tích ở góc trên mỗi thẻ phiếu
Reason: Bấm được, nhưng không quan sát được nó dùng để làm gì — không có nút nào
  đổi trạng thái theo nó trong lúc khảo sát, và thử các thao tác đi kèm thì có
  khả năng ghi vào hệ thống thật.
Action taken: NONE
BlueDental: dùng ô tích để chọn phiếu đem in và lọc chế độ "Toàn bộ". Đây là
  **suy đoán**, không phải hành vi đã đo.

## UNKNOWN_REFERENCE_BEHAVIOR — nút "Đồng bộ phiếu"

Page: /patient/{id} -> Bệnh án -> thanh dưới
Control: "Đồng bộ phiếu"
Reason: Tên gợi ý nó chép thông tin bệnh nhân vào các ô đầu phiếu, nhưng bấm là
  ghi vào phiếu thật.
Action taken: NONE
BlueDental: không dựng nút này.

## UNKNOWN_REFERENCE_BEHAVIOR — nút kéo sắp xếp ảnh trong "Chọn ảnh hiển thị"

Page: /patient/{id}?tab=consulting -> Danh sách ảnh
Control: nút tròn hình tay kéo ở góc dưới phải mỗi thẻ ảnh
Reason: Kéo thả để đổi thứ tự sẽ ghi thứ tự mới lên hệ thống thật.
Action taken: NONE
BlueDental: dựng nút cho đúng hình, nhưng **chưa nối** chức năng kéo — thứ tự
  ảnh chưa được lưu.


## UNKNOWN_REFERENCE_BEHAVIOR — sắp xếp lại ảnh phía server (tab Hình ảnh)

Page: /patient/{id}?tab=image
Control: nút kéo (grip) trên thẻ ảnh — thả vào vị trí mới trong cùng ngày
Reason: Bundle cho thấy client chỉ gửi `PUT /patient-images/reorder
  { id, ordering: <vị trí đích> }` cho **một** ảnh. Server đẩy các ảnh còn lại
  trong ngày như thế nào (dồn lên / đổi chỗ / để trùng ordering) không quan sát
  được vì kéo là ghi dữ liệu thật.
Action taken: NONE
BlueDental: đọc là "chuyển ảnh tới vị trí đích, các ảnh còn lại cùng ngày dồn
  lại theo thứ tự cũ" (giống danh sách kéo-thả thông thường) và đánh số lại
  1..N trong ngày đó. Đây là **suy đoán**.

## UNKNOWN_REFERENCE_BEHAVIOR — xoá ảnh (tab Hình ảnh)

Page: /patient/{id}?tab=image
Control: nút thùng rác đỏ trên thẻ ảnh
Reason: Mở modal "Xác nhận xoá ảnh" rồi xoá thật. Không bấm nên chưa thấy nhãn
  nút xác nhận của modal (bundle không truyền `confirmLabel`, dùng mặc định
  của component dùng chung).
Action taken: NONE
BlueDental: dùng modal xác nhận chung của app, nút "Xoá".

## UNKNOWN_REFERENCE_BEHAVIOR — tải ảnh (tab Hình ảnh)

Page: /patient/{id}?tab=image
Control: nút "Tải ảnh" (đã xác nhận nó mở hộp chọn file, không có dialog)
Reason: Không chọn file nên không thấy server kiểm tra gì thêm (kích thước,
  định dạng) ngoài những gì client tự làm (resize 1600px, tối đa 5 MB, 10
  file/lần, chỉ jpeg/png).
Action taken: NONE
BlueDental: giữ giới hạn client như bản gốc; server nhận jpeg/png/webp tối đa
  20 MB như hiện tại.

UNKNOWN_REFERENCE_BEHAVIOR

Page: Patient detail → Lịch hẹn → "Lịch sử thay đổi" modal
Control: Hành động / Trạng thái / Nguồn multi-selects
Reason: The boxes are multi-selects (reported by the product owner), but how the
reference draws several chosen values inside the 160px box (tags, "+n",
comma list) and whether its query repeats the key per value were not
observed. Local: small tags, overflow folded into "+n", repeated keys.
Action taken: NONE

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=prescription&create=true ("Thêm đơn thuốc")
Control: "Lưu" (submit) and the "Lưu đơn thuốc mẫu" checkbox
Reason: Saving is a POST on the reference; not clicked. The request payload,
  validation messages (beyond "Chọn bác sĩ*" and "Tên thuốc*" being required),
  the generated code format and what "Lưu đơn thuốc mẫu" stores (name of the
  template? whole slip?) were not observed.
Action taken: NONE
BlueDental: POST /api/v1/app/prescriptions with { staffId, diagnosisText,
  note, treatmentType, followUpDate, saveAsTemplate, templateName, items[] }.
  Owner's answer (2026-09-05): ticking the box reveals a text field
  "Tên đơn thuốc mẫu"; the prescription_template catalog entry takes that
  name, the lines, and the lời dặn as its description. Code format DT{yy}-{nnnn}
  is local (the reference's format was not seen).

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=prescription&create=true
Control: combobox "Chọn đơn thuốc mẫu"
Reason: Staging branch has no templates, so what a pick fills (lines only, or
  lines + lời dặn) and whether it replaces or appends lines was not observed.
Action taken: NONE (opened the empty list only)
BlueDental: picking a template replaces the lines with the template lines and
  fills "Nhập lời dặn" from the template content (assumption).

RESOLVED 2026-09-05 (product owner, not observation)

Page: /patient/{id}?tab=prescription
Control: "Thao tác" column of saved prescriptions
Reason: No patient with a prescription was reachable on staging (both
  branches) or production (first page of patients), so the row actions were
  not seen. The owner confirmed them: **Sửa** and **Xóa**, no print.
Action taken: NONE on the reference.
BlueDental: Sửa reopens the same dialog titled "Cập nhật đơn thuốc" (title
  assumed — the reference's edit title was not seen) · Xóa asks
  "Xác nhận xoá đơn thuốc <code>" then deletes.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=prescription&create=true
Control: "Lưu" with an incomplete form
Reason: The button renders enabled while "Chọn bác sĩ*" and "Tên thuốc*" are
  empty; whether a click shows inline errors, a toast, or nothing is a
  mutation path and was not tried.
Action taken: NONE
BlueDental: "Lưu" stays disabled until a doctor and at least one medicine
  line are set (the app-wide AppDialog rule), and until "Tên đơn thuốc mẫu"
  is filled when the template box is ticked.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=prescription&create=true
Control: "Tên thuốc*" search box
Reason: Typing into the picker was not done; whether the search hits
  /medicine-template/medicines again with a keyword or filters the 20 loaded
  rows client-side is unknown.
Action taken: NONE
BlueDental: client-side filter over the branch medicine catalog (≤200 rows).


UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=appointment
Control: "Trạng thái" select in the "Cập nhật lịch hẹn" dialog
Reason: Seen once, on a Trễ hẹn appointment, offering Đã huỷ and Trễ hẹn.
  Which options a booked, arrived or cancelled appointment gets, and whether a
  cancelled one can be edited or restored at all, was not observed — opening
  more rows risked nothing, but no such rows were at hand and saving is out.
Action taken: NONE (dialog closed without saving)
BlueDental: always Đã hẹn · Đã huỷ · Trễ hẹn (user decision 2026-09-05);
  Đã hẹn on a cancelled or late row puts it back on the book as Confirmed.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=appointment
Control: pencil / trash on a note row inside the edit dialog's "Ghi chú" card
Reason: Not clicked — editing or deleting a note would mutate production.
Action taken: NONE
BlueDental: notes are shown read-only in the dialog for now.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=care
Control: "Nhóm" column for a record of type special / recurring / base
Reason: The staging patient surveyed on 2026-09-05 only carried afterTreatment
  records ("Sau điều trị"); creating a record of another type would mutate
  production, so the label the reference prints for those types is unobserved.
Action taken: NONE
BlueDental: prints the CSKH module's group label ("CSKH đặc biệt", "Định kỳ",
  "CSKH cơ bản").

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=care
Control: "Xóa" inside the "Xóa lượt chăm sóc" confirm dialog
Reason: Opening the dialog was approved by the owner; confirming would delete a
  production record, so the request behind it was not observed.
Action taken: NONE (dialog dismissed with Huỷ)
BlueDental: DELETE /api/v1/app/care-records/{id}, soft delete, Manage
  permission, branch-guarded.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=labo (dialog Đặt mới / Làm tiếp công đoạn / Bảo hành)
Control: "Lưu"
Reason: Would POST /v1/clinic-orders on production; the request body was never
  observed. Which of code, treatment plan, treatment service, labo service,
  material, teeth, dates and images it carries is unknown.
Action taken: NONE (dialog closed with Escape, nothing saved)
BlueDental: own payload — see docs/clone/pages/patient-detail.md Tab 6 for the
  fields the form shows.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=labo (dialog Đặt mới, "Lựa chọn dịch vụ*" / "Vật liệu*")
Control: labo-service list and material list
Reason: Every treatment service on staging has service.laboIds = [] and the
  taxonomy type serviceMaterial is empty, so both lists only ever showed
  "Không có dữ liệu" / "Chọn dịch vụ trước". How a labo service is linked to a
  clinic service and how materials hang off a labo service was not observable.
Action taken: NONE
BlueDental: labo services = the local "Dịch vụ & vật liệu" catalog
  (/labo/service-material); materials = that service's materials.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=labo
Control: "Xem file" button in column "File Labo gửi về" with images present
Reason: No order on staging carried returned files; the button was disabled
  ("Xem file -") on every row. The lightbox seen on /labo (labo.md) is assumed
  to be the same.
Action taken: NONE
BlueDental: reuse the /labo lightbox over order.images.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=labo (dialog Đặt mới, "Bác sĩ chỉ định*")
Control: doctor list
Reason: GET /v1/staff/list?...&isDoctor=true returned 403 for the surveyed
  account, so the option label format is unobserved.
Action taken: NONE
BlueDental: local dentist list, label = staff name.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id} (Hồ sơ) — treatment row, Thao tác → "Tạo phiếu thanh toán"
Control: Lưu, and the "Chia Tiền Tự Động" / "Chia Tiền Thủ Công" pair
Reason: The dialog was opened and measured read-only; the POST behind Lưu was
  never sent, so neither the request shape nor what the two split modes
  actually do could be observed. Whether the reference refuses an amount above
  the chosen lines' Còn nợ is likewise unobserved.
Action taken: NONE
BlueDental: one POST /api/v1/app/patient-payments for the whole slip, carrying
  treatmentServiceIds[] and splitMode. Tự động sends only the total and the
  server spreads it over the ticked lines, oldest first, capped at each line's
  Còn nợ; Thủ công sends items[] and the server takes them as typed. Overpaying
  the ticked lines is refused with the reference's own wording.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id} (Hồ sơ) — treatment row, "Công đoạn" and "Chăm sóc sau điều trị"
Control: the green round + button; the radio-style care glyph
Reason: The only staging row had 0/0 công đoạn and care status "new", so what
  the cell shows once a line has steps, and whether the care glyph is a control
  or a read-out, could not be seen. Clicking either could write.
Action taken: NONE
BlueDental: + only when the line has no stage (it opens Kế hoạch điều trị,
  where stages are added); "completed/total" otherwise. The care cell is a
  read-out of the care record covering the line's stages.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id} (Hồ sơ) — treatment row, "Bác sĩ hỗ trợ" and "Phụ tá"
Control: the two staff slots
Reason: The reference keeps `subStaffId` (Bác sĩ hỗ trợ) and `assistantStaffId`
  (Phụ tá) on the stage; both were null on staging, so how either is assigned
  is unobserved.
Action taken: NONE
BlueDental: neither is modelled; both print the reference's empty state
  ("Không có" and "Phụ tá: —").

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient (Danh sách bệnh nhân) — "Phân loại theo Tag" filter
Control: the option rows
Reason: GET /v1/medical-record/tag/list answers 403 for the surveyed account,
  so the dropdown only ever showed "Không tìm thấy dữ liệu" and a populated
  option could not be seen.
Action taken: NONE
BlueDental: plain text rows. The filter is the same widget as "Phân loại dịch
  vụ" down to the markup, so it is drawn the same way; the coloured chip is kept
  only where it was actually observed, on the record's own tag picker.

RESOLVED 2026-09-06 (second survey) — "Tải Ảnh" before the công đoạn exists

Page: /patient/{id} (Hồ sơ) — "Chi tiết phiếu", the stage form
Was unknown: whether the reference lets a picture be chosen before the công
  đoạn is saved.
Action taken: NONE on the reference — the form's markup answers it. The card
  carries its own hidden
  <input type="file" accept="image/jpeg,image/jpg,image/png" multiple>, and the
  button is not disabled.
BlueDental: the form's Tải Ảnh is live; chosen files are held and uploaded
  against the new stage id the moment Lưu succeeds.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id} (Hồ sơ) — "Chi tiết phiếu", the stage form
Control: "Danh sách công đoạn"
Reason: It is the *service catalog's* own checklist — the stage's
  `stageServiceItems`, backed by `GET /v1/treatment-lines`'s
  `treatmentLineItems`. Both were empty on staging because the surveyed service
  declares no stages, so a populated one was never seen.
Action taken: NONE
BlueDental: prints "(Trống)"; the checklist is not modelled. The history's
  "Công đoạn" column prints the stage's own name rather than that checklist.

RESOLVED 2026-09-06 (second survey) — "Phụ tá" and "Bác sĩ hỗ trợ"

Page: /patient/{id} (Hồ sơ) — "Chi tiết phiếu", the stage form
Was unknown: how the reference stores the two helper slots.
Action taken: NONE on the reference — a GET of its own
  /v1/patient-stages answers it: the row carries `subStaffId` (Phụ tá) and
  `assistantStaffId` (Bác sĩ hỗ trợ) as separate nullable fields, both null on
  the surveyed stage.
BlueDental: both are stored. `TreatmentStage.SecondStaffId` is Bác sĩ hỗ trợ and
  the new `TreatmentStage.SubStaffId` is Phụ tá (migration
  20260906160000_AddStageSubStaff); the history row and the printed sheet read
  both names back, printing "(Trống)" when empty.

RESOLVED 2026-09-06 (second survey) — "Tạo Labo"

Page: /patient/{id} (Hồ sơ) — "Chi tiết phiếu", "Tạo Labo"
Was unknown: whether the button navigates or opens something.
Action taken: the button was clicked and the dialog it opens was read, then
  closed **without saving** — opening a form writes nothing, and the Lưu it
  carries was never pressed.
Observed: it opens the Labo "Đặt mới" dialog in place, prefilled from the công
  đoạn (patient, slip, service, dentist, teeth, Số phiếu Labo LABO-yyyyMMddN,
  Ngày/Giờ gửi = now).
BlueDental: the same dialog, over the Labo order contract BlueDental already
  had plus ToothShade / Quantity / TreatmentServiceId / TreatmentStageId
  (migration 20260906170000_AddLaboOrderTreatmentLink).

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id} (Hồ sơ) — Labo "Đặt mới" raised from a công đoạn
Control: "Giờ nhận", "Tải ảnh", and "Chọn tất cả" over the teeth
Reason: The form was read but never submitted, so what the reference does with
  the received-by hour, with a file attached at order time, and with the
  select-all over teeth that arrived from the công đoạn, is unobserved.
Action taken: NONE
BlueDental: Giờ nhận is collected but not stored (LaboOrder.DueDate is a date);
  the teeth come from the công đoạn read-only; the form has no Tải ảnh.

RESOLVED 2026-09-06 — the two payment/stage write contracts above were read out
of the reference's own JavaScript bundle (a static asset, which rule 00 permits)
rather than by sending a request. See docs/clone/pages/patient-detail.md for the
schemas. Two facts worth keeping:

- The surveyed account has no `payment` ability at all (`GET /v1/payment-v2`
  answers 403), so the payment dialog could not have been saved on staging even
  with permission from the project owner.
- `treatmentStage` grants `create`, `continue` and `complete` but **no delete**,
  so a công đoạn created on staging could not have been undone.

RESOLVED 2026-09-06 — one receipt covering several services

Page: /patient/{id} (Hồ sơ) — "Tạo phiếu thanh toán"
Was unknown: the reference POSTs a single payment carrying `treatmentServiceIds[]`
  and, in manual mode, an `items[]` breakdown, but whether its payment history
  then shows one row per receipt or per service could not be seen — the history
  list is 403 for the surveyed account.
Action taken: NONE on the reference. The create contract came out of its own
  JavaScript bundle; the row count was settled locally instead of by writing.
BlueDental: `PatientPayment` now owns `PatientPaymentLine` children — one
  `(treatmentServiceId, amount)` per service — plus `SplitMode`. The dialog posts
  one receipt naming every ticked service, and the history shows one row for it.
  A receipt whose lines do not add up to its total, or a line of zero, is
  refused by the aggregate.

  Still unknown, and unobservable without the payment ability: whether the
  reference's history row itself expands to show the per-service breakdown.
  BlueDental shows the receipt's total on the row.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id} (Hồ sơ) — the treatment table
Control: a service line that has no công đoạn yet
Reason: The reference's table is built from `/v1/patient-timeline`, whose rows
  are all `type: "stage"`. Every staging slip inspected already had at least one
  công đoạn, so whether a line with none appears at all — and if so under what
  `type` — was never observable. Accepting an advise on the reference to make
  one would be a write.
Action taken: NONE
BlueDental: such a line still gets one row, with an empty Nội dung điều trị, so
  its "+" stays reachable. That is a superset of what the reference was seen to
  do, never a subset.

RESOLVED 2026-09-06 (second survey) — Labo "Đặt mới": Giờ nhận and Tải ảnh

Page: /patient/{id} (Hồ sơ) — Labo "Đặt mới" raised from a công đoạn
Was unknown: what the received-by hour and the form's file tile do.
Action taken: the form was read, never submitted.
Observed: `Giờ nhận` is a plain time field beside `Ngày nhận dự kiến` in a
  `minmax(0,1fr) 140px` pair, and `Tải ảnh` is a **square 80px tile** at the
  bottom of the form over its own hidden single-file input.
BlueDental: both are drawn. `Giờ nhận` is still not stored — `LaboOrder.DueDate`
  is a date — and the picture is attached to the công đoạn the order was raised
  from, since a labo order has no image collection of its own. Whether the
  reference files it against the order instead stays unobserved.

## PATIENT DETAIL — Tab Kế hoạch điều trị (re-survey 2026-09-07, staging)

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=treatment-plan — "Tạo phiếu dịch vụ"
Control: `Lưu`
Reason: The form was filled on staging but never saved, so the POST payload of
  `/v1/patient-treatments` and what the response carries were not observed.
Action taken: NONE
BlueDental: `POST /api/v1/app/patient-treatments` with the fields listed in
  `docs/clone/api.md`; the new slip lists as "Đã tạo".

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=treatment-plan — summary cards
Control: "Dịch vụ đang điều trị" / "Dịch vụ có công đoạn gần nhất"
Reason: `/patient-treatments/summary` answered `{ active: [], recent: [] }` on
  every surveyed record, so the exact shape of a non-empty answer is unknown.
Action taken: NONE
BlueDental: both cards are derived client-side from the slip list (lines in
  treatment; lines with at least one công đoạn).

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=treatment-plan — "Chọn răng"
Control: `Răng sữa` radio
Reason: Switching to deciduous teeth only cleared the picks on staging; whether
  a saved deciduous pick is stored differently (FDI 51–85) was not observable
  without saving.
Action taken: NONE
BlueDental: deciduous teeth use their FDI numbers (51–85) and clear the picks
  when the dentition changes, as observed.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=treatment-plan — table
Control: `In bệnh án` (clipboard icon) and the slip code link
Reason: Both leave the tab (print sheet / `/treatment-plan/{planId}` detail
  page); the owner asked for the button to exist without an action and for the
  detail page to be a later round.
Action taken: NONE
BlueDental: the button renders and does nothing. **Updated 2026-09-07**: the
  detail page is built (F-39, `pages/treatment-plan-detail.md`); the code link,
  the items in the two summary cards and the ≤640 card head all navigate to
  `/patient/{id}/treatment-plan/{planId}`.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=treatment-plan — service pills
Control: "Chuyển đổi" status on a service line
Reason: Seen once on staging on a line that had been replaced; what replaces it
  and whether the original stays billable was not observable.
Action taken: NONE
BlueDental: `SERVICE_LINE_STATUS.Replaced` renders "Chuyển đổi" with the blue
  pill; nothing else is done with it.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}?tab=treatment-plan — empty table
Control: the table with no slip
Reason: Every surveyed record already had slips, so the empty-state text was
  never seen.
Action taken: NONE
BlueDental: "Chưa có kế hoạch điều trị".

Deliberate deviations recorded with the owner (2026-09-07):

- The app's primary colour (`--bd-primary`, #6366f1) replaces the reference's
  blue on every control of this tab — owner's rule.
- Tables fold into "Thêm đơn thuốc"-style record cards at ≤640px — owner's rule.
- The pager is the app's shared `useTablePagination` pager, not the reference's
  outlined Trước/Sau pager — owner's rule of 2026-09-07 ("dùng pagination có
  sẵn").
- "Đã tạo" is derived on the client: local slips open as InProgress, and the
  pill reads "Đã tạo" while every line is still Created.
- Font family and the modal mask blur follow the house chrome; the staging
  discount input overflows its cell at 640px and is not reproduced; staging's
  care-service list returned 403 for the surveyed role; the invoice modal's
  pager belongs to the invoice feature and is out of scope here.

---

## TREATMENT PLAN DETAIL (/patient/{id}/treatment-plan/{planId}) — 2026-09-07

Surveyed on production (read-only) and staging. Every entry below is a control
whose effect could not be observed without saving.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=detail
Control: `Thêm dịch vụ mới` service picker
Reason: Picking a service adds a line to the slip on the reference (a write).
  Owner's screenshots 2026-09-07: it appends an editable row at the bottom of
  the table (status pill with Đã tạo / Đang điều trị / Hoàn thành / Chuyển đổi
  / Đã chuyển / Bảo hành / Hủy dịch vụ; Chẩn đoán, Bác sĩ, tooth button, Số
  lượng, Đơn giá, Ghi chú, BS chẩn đoán 1–2, Tư vấn 1–2) with Lưu ✓ / Hủy ✗.
  In group mode a clicked group shows a back arrow + a table of its services
  (Dịch vụ / Giá gốc / Giảm giá / Thành tiền) inside the popover. What Lưu
  sends was not observed (no save on production).
Action taken: NONE
BlueDental: rebuilt to the screenshots 2026-09-07 (`useDraftServiceRow`,
  `draftServiceCells.tsx`, group table in `PlanServicePicker`). Lưu posts
  `POST patient-treatments/{id}/services` (new endpoint, columns on
  `bd_treatment_services` via migration `20260907090000`). Not yet retested
  on the real stack.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=detail
Control: `Chuyển đổi` in the status pill menu of a service line
Reason: Converting replaces the line with another service on the reference; the
  follow-up dialog was not opened because the pill menu already mutates on pick.
Action taken: NONE
BlueDental: the menu entry shows a toast and does nothing else; the line status
  `Chuyển đổi` renders when the API reports it.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=debt
Control: the Dư nợ table
Reason: Empty on every slip observed, so which lines it lists and where `Dư nợ`
  per line comes from is unknown.
Action taken: NONE
BlueDental: lists the slip's lines that carry a payment made with the
  `OutstandingDebt` method, `Dư nợ` = that amount. Assumption.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=payment-v2
Control: `In hóa đơn tổng` → "Chi tiết phiếu" with `Mã thanh toán: Tổng hợp`
Reason: The three totals (`Doanh thu dự kiến`, `Đã thanh toán`, `Công nợ`) were
  read on a slip with one receipt; whether `Đã thanh toán` is net of refunds on
  the reference was not observable.
Action taken: NONE
BlueDental: the three totals are the head figures `totalPrice`, `totalPaid`,
  `debt` of the slip (net, as the API reports them). Assumption.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=refund — dialog "Hoàn tiền"
Control: the service table on a line that was already partly refunded, and
  `Loại = Hoàn tiền dư nợ`
Reason: Observed on a slip with no prior refund; the debt variant needs a held
  balance the surveyed patient did not have.
Action taken: NONE
BlueDental: `Đã thanh toán` shows the gross collected, `Đã hoàn` the refunded
  sum, and the box accepts up to the net still held. `Hoàn tiền dư nợ` posts a
  Refund without `treatmentPlanId` against the patient's held balance. Both are
  assumptions; the server refuses a refund on a fully paid line (see
  `docs/testing/features/treatment-plan-detail.md`).

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=detail
Control: `Tạo Đơn Thuốc`, `In Hóa Đơn`
Reason: Both leave the page. (The printer icon was observed on 2026-09-07: it
  opens the slip's "Chi tiết phiếu", and `In Phiếu` prints "PHIẾU ĐIỀU TRỊ" —
  see the page doc.)
Action taken: NONE
BlueDental: `Tạo Đơn Thuốc` opens the Đơn thuốc tab with `create=true`;
  `In Hóa Đơn` opens the invoice modal.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=detail → printer icon → "Chi tiết phiếu"
Control: the columns of `CHI TIẾT DỊCH VỤ` to the right of `Thành tiền`
Reason: The table scrolls horizontally and only the columns up to `Thành tiền`
  were visible in the capture; the scrollbar was not dragged.
Action taken: NONE
BlueDental: the table ends at `Thành tiền`.

UNKNOWN_REFERENCE_BEHAVIOR

Page: /patient/{id}/treatment-plan/{planId}?planTab=payment-v2 → eye → "Chi tiết phiếu" → `In Hoá Đơn`
Control: the print of a **single** receipt (and of a refund row)
Reason: Only the aggregate print ("In hóa đơn tổng" → In Hoá Đơn) was observed
  — one "BIÊN LAI THU TIỀN" sheet with `Nhân viên` blank, `Phương thức TT:
  Tổng hợp` and the treating dentist under `Người lập phiếu`. Opening the
  single-receipt print preview was not repeated on production.
Action taken: NONE
BlueDental: the same sheet, with the receipt's own date, `Nhân viên` = the
  collector, its channel and amount, and the collector signing `Người lập
  phiếu` (the dentist when no collector is known).

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=consulting — form "Tạo chẩn đoán"
Control: nút "Thêm chẩn đoán" (xanh, trải hết cột phải)
Reason: bấm trên staging chỉ thấy form xếp thêm một chẩn đoán vào phiếu; không
        rõ khi lưu tạo một hay nhiều bản ghi, và bản production không được
        bấm. Chủ dự án chốt tạm vô hiệu nút này (2026-09-07).
Action taken: NONE trên production. BlueDental hiện lưu một chẩn đoán mỗi lần.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=consulting — chân "Phiếu tư vấn", "Voucher áp dụng"
Control: nút "Chọn voucher" và popover tìm voucher
Reason: staging tải `GET /voucher/available?customerTarget=returning` khi mở
        tab nhưng không có voucher nào cho kế hoạch, nên chỉ thấy trạng thái
        rỗng. Ảnh chủ dự án gửi 2026-09-08 (staging có một voucher "10đ"
        phạm vi "Kế hoạch") cho thấy thẻ voucher, thẻ đã chọn màu xanh lá, nút
        ngoài đổi thành "Voucher (1)" và "Tổng tiền" trừ đúng 10đ. Chọn được
        nhiều voucher. Chưa thấy: voucher "độc quyền" xử lý ra sao, và bấm
        chọn có gửi request lưu lên phiếu/kế hoạch hay không.
Action taken: NONE trên production. BlueDental (2026-09-07) gọi
        `GET /api/v1/app/vouchers/available?orderAmount=<tổng các dòng đã tick>`
        và chỉ giữ voucher `scopeTarget = treatment`; mỗi dòng: mã đậm, tên,
        mức giảm "-10%"/"-500.000đ"; cho chọn nhiều, voucher `isExclusive`
        đứng một mình; giảm giá tính trên client bằng đúng công thức
        `Voucher.CalculateDiscount`, trừ vào "Tổng tiền"; chọn voucher chỉ là
        state trên trang, chưa gửi `apply-voucher` lên phiếu.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=consulting — form "Tạo chẩn đoán"
Control: nút tròn 36px "+" cạnh "Bác sĩ chẩn đoán 1"
Reason: trên staging bấm bật thêm ô "Bác sĩ chẩn đoán 2"; chưa rõ bấm lần nữa
        có ẩn ô và xoá giá trị hay không (không kiểm tra khi ô đã có dữ liệu).
Action taken: NONE trên production. BlueDental: bấm lại thì ẩn ô và bỏ giá trị.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=consulting — dialog "Chọn Dịch Vụ" (nút Tạo dịch vụ)
Control: bảng dịch vụ, nút nhóm dịch vụ, ô tìm kiếm, nút "Lưu"
Reason: tài khoản staging bị 403 khi tải danh sách dịch vụ / nhóm / nhân sự,
        nên chỉ quan sát được trạng thái rỗng: chưa thấy một hàng dịch vụ
        khi tick trông thế nào (ô giá, số lượng, %/VNĐ, ghi chú), nút nhóm
        lọc hay chọn cả nhóm, tìm kiếm lọc tại chỗ hay gọi API, và request
        khi bấm Lưu (một hay nhiều bản ghi). Production không được bấm.
Action taken: NONE trên production. BlueDental (2026-09-07): tick mở editor
        trên hàng như bảng kế hoạch điều trị, nhóm chỉ lọc, tìm kiếm lọc tại
        chỗ, Lưu gọi `POST /api/v1/app/patient-advises` cho từng dòng tick.

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient/<id>?tab=consulting — dialog "Chi tiết phiếu" (nút máy in ở chân Phiếu tư vấn)
Control: nút "In hóa đơn kèm chẩn đoán", nút "In Hoá Đơn", nút "Sửa" trong bản xem trước
Reason: chỉ có ảnh chụp production của dialog và CSS/JS trong bundle tĩnh;
        không bấm hai nút In trên production nên bố cục hai bản in dựng
        theo mã nguồn bundle; ảnh production của "Phiếu Báo Giá" (chủ dự án
        gửi 2026-09-08) không có phần chữ ký; chủ dự án xác nhận bản "Hóa
        Đơn Kèm Chẩn Đoán" trên production cũng không có → local bỏ cả hai.
        Chưa rõ "Nội dung chẩn đoán" của bác sĩ trên bản gốc lấy từ trường
        nào (local lấy `note` của phiếu chẩn đoán, trống thì dùng đoạn văn
        mẫu). "Giảm giá bác sĩ" trên bản gốc = giảm tay + voucher; local chưa
        có giảm tay nên chỉ là voucher kế hoạch. Nút "Gửi Khách Hàng
        (Zalo/FB)" trên bản gốc cũng chỉ là nút chờ (không thấy request).
Action taken: NONE trên production. BlueDental (2026-09-08): dựng dialog và
        hai bản xem trước theo bundle, in bằng `window.print` chỉ giữ phần
        phiếu; sửa nội dung chẩn đoán chỉ sống trong bản xem trước, không
        ghi lên server.
