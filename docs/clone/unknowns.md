# Unknown Reference Behaviors

Source: https://app.nfcdental.com
Observed: 2026-08-21 (updated with screenshot comparison)

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: "Tạo tiếp nhận" button
Reason: Clicking would create a new reception record (mutating action).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Reception table columns and row layout (when populated)
Reason: Reference showed empty state. The local implementation uses a 9-column table (SỐ PHIẾU, BỆNH NHÂN, BÁC SĨ TIẾP NHẬN, NHÂN SỰ TƯ VẤN, NGUỒN TIẾP NHẬN, TRẠNG THÁI, DỊCH VỤ ĐIỀU TRỊ, TỔNG TIỀN, THAO TÁC) but this has NOT been verified against the reference.
Action taken: NONE — need to observe reference on a date with data

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Row action buttons ("Tiếp nhận", "Xong", three-dot menu)
Reason: These exist in the local implementation but have not been observed in the reference. Click actions are mutating.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: "Bác sĩ" filter dropdown options
Reason: Could not confirm if opening the dropdown triggers any API call or state change beyond rendering options.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Date picker popup
Reason: Clicking the date button may open a calendar picker. Full date picker behavior unknown.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception
Control: Status counter cards (Đã hẹn, Đã đến, etc.) — click behavior
Reason: Unknown if clicking a counter card filters the list or navigates.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Tạo hồ sơ" button
Reason: Clicking would create a new patient record (mutating action).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Xuất file" (Export) button
Reason: May trigger file download or generation. Unknown format (Excel/PDF/CSV).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Chỉnh sửa" (Edit) button on each row
Reason: Would open edit form (mutating action).
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: Patient name link (e.g., [DH26012] - NAME)
Reason: Links to `/patient/:id` detail page. Likely safe to navigate but not yet observed.
Action taken: NONE — will revisit when system is available

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Xem" (View) button on each row
Reason: Likely navigates to patient detail. Likely safe but not yet observed.
Action taken: NONE — will revisit when system is available

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /patient
Control: "Phân loại dịch vụ" and "Phân loại theo Tag" dropdown options
Reason: Could not inspect dropdown content.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: /reception, /patient
Control: "Tuần" (Week) and "Tháng" (Month) time tabs
Reason: Unknown layout change when switching between day/week/month views.
Action taken: NONE

---

RESOLVED — 2026-08-21
Page: Global
Control: Global search (Ctrl+K)
Status: PARTIALLY RESOLVED — modal layout and 4 search categories observed (Khách hàng, Lịch hẹn, CSKH, Nhân viên). Minimum 2 characters to search. Search result format after typing remains UNKNOWN.
See: docs/clone/components.md § "Global Search Modal"

---

RESOLVED — 2026-08-21
Page: Global
Control: Branch selector dropdown
Status: RESOLVED — dropdown shows "Chi nhánh" header, "Tất cả chi nhánh" option, and individual branch names with green dot for selected.
See: docs/clone/components.md § "Branch Selector Dropdown"

---

RESOLVED — 2026-08-21
Page: Global
Control: Language selector
Status: RESOLVED — popover shows "Ngôn ngữ" header with 2 options: "Tiếng Việt" (default, checkmark), "Tiếng Anh".
See: docs/clone/components.md § "Language Selector Popover"

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: Global
Control: Notification panel
Reason: Unknown notification types, format, and real-time behavior.
Action taken: NONE

---

UNKNOWN_REFERENCE_BEHAVIOR
Page: Global
Control: User menu dropdown
Reason: Unknown menu items (profile, settings, logout, etc.).
Action taken: NONE

---

RESOLVED — 2026-08-21
Page: Global
Control: Sidebar collapse/expand behavior
Status: RESOLVED — toggle button in header switches sidebar between collapsed (~70-80px, icon+label stacked) and expanded (~180px, icon+label horizontal, section headings "MENU" and "KHÁC").
See: docs/clone/components.md § "Sidebar"
