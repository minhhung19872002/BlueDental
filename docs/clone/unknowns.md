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

UNKNOWN_REFERENCE_BEHAVIOR
Page: /staff
Control: Entire page
Reason: Page not yet navigated to. Route confirmed (HTTP 200) but content unknown.
Action taken: NONE
See: docs/clone/pages/staff.md

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
