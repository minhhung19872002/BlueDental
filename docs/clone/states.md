# UI States — Reference Application

Source: https://app.nfcdental.com
Observed: 2026-08-21 (updated with screenshot comparison)

## Reception Page States

### Reception Visit Status (tab filters)
- Tất cả (All) — count in parentheses
- Chờ khám (Waiting for exam) — count in parentheses
- Đang khám (Being examined) — count in parentheses
- Hoàn thành (Completed) — count in parentheses

### Reception Counter Categories
- Đã hẹn (Scheduled) — green/teal
- Đã đến (Arrived) — blue
- Huỷ hẹn (Cancelled) — yellow/amber
- Trễ hẹn (Late) — red/coral
- Lịch tạm (Temporary) — orange
- Chuyển đổi (Converted) — light blue

### Empty State (OBSERVED in reference)
Displayed when no receptions match current filters:
- Container: light blue-gray background, rounded corners
- Icon: person/user outline (centered)
- Heading: "Không có lượt tiếp nhận phù hợp"
- Subtitle: "Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm để xem thêm dữ liệu."

### Populated State — Table (INFERRED from local implementation)
When receptions exist for the selected date:
- Data table with 9 columns
- Row-level status badges with colored dots
- Patient "Mới"/"Cũ" (New/Existing) badges
- Source badges: Y tế, Tự đến, Marketing, Giới thiệu
- Action buttons per row: "Tiếp nhận" (blue) or "Xong" (green) + three-dot menu
- Pagination: total count + page size selector + page navigation

NOTE: The reference populated state has NOT been directly observed.
See docs/clone/pages/reception.md § "Content Area — Populated State" for details.

### Reception Status Badges (local implementation)
- Chờ khám — blue dot + blue text
- Đang khám — orange dot + orange text
- Hoàn thành — green checkmark + green text

### Reception Source Badges (local implementation)
- Y tế — blue badge
- Tự đến — default/gray badge
- Marketing — green badge
- Giới thiệu — orange badge

### Patient Type Badges (local implementation)
- Mới (New) — blue badge
- Cũ (Existing) — gray badge

## Patient List Page States

### Patient Treatment Status (tab filters)
- Tất cả (All)
- Điều trị hoàn tất (Treatment completed)
- Đang điều trị (In treatment)
- Chưa phát sinh (No activity)
- Active tab: blue background, white text, rounded pill

### Patient Record Status Badges
- Chưa phát sinh — gray/default tag
- Đang điều trị — blue tag
- Hoàn tất — green tag

### Patient Code Format
Pattern: `[DH26XXX]` — prefix "DH" + year(2) + sequence number

## Time Period States

Both pages support viewing data by:
- Ngày (Day) — default active
- Tuần (Week)
- Tháng (Month)

## UNKNOWN_REFERENCE_BEHAVIOR

### Week/Month view layout
- Page: /reception, /patient
- Control: "Tuần" and "Tháng" tabs
- Reason: Not observed in reference. Unknown if layout changes (e.g. weekly calendar grid vs. daily list).
- Action taken: NONE
