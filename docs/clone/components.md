# Shared Components — Reference Application

Source: https://app.nfcdental.com
Observed: 2026-08-21

## Application Shell

### Sidebar (complementary landmark)

- Position: fixed left, full viewport height
- Background: white
- Active item: blue background highlight (#e6f4ff-ish), blue icon, blue text, rounded corners
- Each item is a link (`<a>`) inside a `<listitem>`
- NFC Dental logo at top-left corner (small blue/gold icon)

**Collapsed state (default at narrow viewports or after toggle):**
- Width: ~70-80px
- Items: icon centered above label text, stacked vertically
- Labels: small text (~11px), may wrap to 2 lines
- No section headings visible

**Expanded state (after clicking sidebar toggle button):**
- Width: ~180px
- Items: icon left + label text right, horizontal layout
- Section heading: "MENU" (blue uppercase text, ~11px) above main nav items
- Section heading: "KHÁC" (blue uppercase text) above the bottom-pinned "Hướng dẫn & hỗ trợ" item
- Clinic info at top: "NFC Dental" bold + "Phần Mềm Quản Trị Vận Hành" subtitle below the NFC logo
- Top section: 11 main navigation items
- Bottom section: 1 item ("Hướng dẫn & hỗ trợ") under "KHÁC" heading

### Header (banner landmark)

- Position: fixed top, right of sidebar
- Height: ~55px
- Background: white
- Left section:
  - Sidebar toggle button (panel/layout icon) — controls sidebar collapse/expand
  - Clinic logo image — circular crop of the clinic's brand logo (~45px). The reference clinic (Đức Hạnh) uses a gold tooth/implant icon on navy blue. This is a dynamic image loaded from the backend, NOT a static asset. The component must accept an `imageUrl` prop.
  - Clinic name: bold text (e.g. "NHA KHOA ĐỨC HẠNH PREMIUM")
  - Tagline: smaller lighter text below name (e.g. "Kiến Tạo Nụ Cười - Giá Trị Bền Vững")
- Center/right section:
  - Global search button: "Tìm kiếm khách hàng, lịch hẹn, nhân viên…" with Ctrl+K shortcut badge — opens Global Search Modal (see below)
  - Branch selector dropdown: green dot indicator + clinic name + chevron — opens Branch Selector Dropdown (see below)
  - Language button: globe icon — opens Language Selector Popover (see below)
  - Notification button: bell icon "Thông báo" (with red badge count)
  - User menu button: circular avatar image + "Admin" text + dropdown chevron

### Main Content Area (main landmark)

- Position: right of sidebar, below header
- Background: light gray (#f5f5f5 or similar)
- Padding: consistent internal padding

### Notification Region

- Accessible name: "Notifications alt+T"
- Keyboard shortcut: Alt+T

## Global Search Modal (Ctrl+K)

Observed: 2026-08-21

Triggered by: clicking the global search bar in the header, or pressing Ctrl+K.

**Layout:**
- Modal overlay (centered, ~500px wide)
- Top: search input field, placeholder "Tìm kiếm khách hàng, lịch hẹn, nhân viên...", "Esc" button on right
- Below input: "Gợi ý tìm kiếm" heading (blue text, ~14px)
- 4 search category items, each with:
  - Icon (left, ~24px, gray/blue outline)
  - Category name (bold, ~14px)
  - Description subtitle (lighter text, ~12px)
- Footer text: "Nhập ít nhất 2 ký tự để tìm kiếm."

**Search categories:**

| # | Icon | Category (VI) | Description (VI) | Category (EN) |
|---|------|-------------|-------------------|---------------|
| 1 | person | Khách hàng | Tìm theo tên, mã KH, số điện thoại | Customers |
| 2 | calendar | Lịch hẹn | Tìm theo tên hoặc SĐT khách hàng | Appointments |
| 3 | heart | CSKH | Tìm theo khách hàng, nội dung | Customer Care |
| 4 | person-badge | Nhân viên | Tìm theo tên, email, số điện thoại | Staff |

**Behavior:**
- Minimum 2 characters required before search executes
- Esc key or Esc button closes the modal
- UNKNOWN_REFERENCE_BEHAVIOR: search result format, result click navigation

## Branch Selector Dropdown

Observed: 2026-08-21

Triggered by: clicking the branch name in the header.

**Layout:**
- Dropdown popover positioned below the branch name
- Header: branch icon + "Chi nhánh" label
- Options list:
  - "Tất cả chi nhánh" (All branches) — gray/blue dot indicator
  - Individual branch names — green dot for currently selected
- Currently selected branch shows green dot (●) indicator

**Observed options:**
- "Tất cả chi nhánh" (All branches)
- "NHA KHOA ĐỨC HẠNH PREMIUM" (green dot = currently selected)

**Behavior:**
- Selecting a branch changes the `branchId` query parameter in the URL
- Green dot indicates active/selected branch
- "Tất cả chi nhánh" likely removes branch filtering

## Language Selector Popover

Observed: 2026-08-21

Triggered by: clicking the globe icon in the header.

**Layout:**
- Small popover dropdown positioned below the globe icon
- Header: "Ngôn ngữ" label
- Options with checkmark for current selection:
  - "Tiếng Việt" ✓ (currently selected)
  - "Tiếng Anh"

**Behavior:**
- Checkmark (✓) indicates current language
- Switching language changes UI text without page reload (i18n)
- 2 languages supported: Vietnamese (default), English

## Toolbar Pattern

Used on both `/reception` and `/patient` pages.

### Time Period Tabs
- 3 tabs: "Ngày" (Day), "Tuần" (Week), "Tháng" (Month)
- Tab style: pill/rounded, active tab has blue background + white text
- Position: top-left of toolbar

### Date Navigator (Reception page)
- Left arrow: "Ngày trước" (Previous day)
- Date display button: "21/08/2026" format (DD/MM/YYYY)
- Right arrow: "Ngày kế tiếp" (Next day)

### Date Picker (Patient List page)
- Calendar icon + "Chọn thời gian" button

### Search Input
- Type: search textbox
- Placeholder: "Tìm bệnh nhân..." (Reception) / "Tìm kiếm" (Patient List)
- Floating label pattern

### Filter Button
- Icon + "Bộ lọc" label
- Appears as collapsible additional filter toggle

### Action Buttons (right-aligned)
- "Xuất file" (Export) — secondary style, icon + text
- "Tạo tiếp nhận" (Create reception) / "Tạo hồ sơ" (Create record) — primary blue, icon + text

## Status Filter Tabs

### Reception Page
- "Tất cả (N)" — All, with count
- "Chờ khám (N)" — Waiting, with count
- "Đang khám (N)" — In exam, with count
- "Hoàn thành (N)" — Completed, with count
- Active tab: blue background, white text, rounded pill

### Patient List Page
- "Tất cả" — All
- "Điều trị hoàn tất" — Treatment completed
- "Đang điều trị" — In treatment
- "Chưa phát sinh" — No activity
- Active tab: blue background, white text, rounded pill

## Filter Dropdowns (combobox)

### Doctor Filter
- Label: "Bác sĩ"
- Type: combobox with search icon
- Present on both Reception and Patient List pages

### Service Category Filter (Patient List only)
- Label: "Phân loại dịch vụ"
- Type: combobox with search icon

### Tag Filter (Patient List only)
- Label: "Phân loại theo Tag"
- Type: combobox with search icon

## Status Counter Cards (Reception page only)

6 cards in a horizontal row, right-aligned on the filter bar:

| Counter | Label (VI) | Label (EN) | Border Color |
|---|---|---|---|
| 1 | Đã hẹn | Scheduled | Green |
| 2 | Đã đến | Arrived | Blue |
| 3 | Huỷ hẹn | Cancelled | Yellow/Amber |
| 4 | Trễ hẹn | Late | Red/Coral |
| 5 | Lịch tạm | Temporary | Light Green |
| 6 | Chuyển đổi | Converted | Light Blue |

Each card: number displayed large, label below, colored top border, white background, rounded corners.

## Data Table (Patient List)

### Columns

| # | Column (VI) | Column (EN) | Notes |
|---|---|---|---|
| 1 | Ngày tạo hồ sơ | Record Date | DD/MM/YYYY format |
| 2 | Họ và tên | Full Name | Link to patient detail, format: [CODE] - NAME |
| 3 | Ngày sinh | Date of Birth | DD/MM/YYYY, can be "—" |
| 4 | Số điện thoại | Phone | 10-digit format |
| 5 | Trạng thái | Status | Badge/tag component |
| 6 | Dịch vụ | Service | Text, can be "—" |
| 7 | Bác sĩ | Doctor | Text, can be "—" |
| 8 | Số tiền | Amount | VND formatted (e.g. 24.000.000) |
| 9 | Thực thu | Collected | VND, green color for amounts > 0 |
| 10 | Công nợ | Debt | VND, colored (green for outstanding amounts) |
| 11 | Lịch hẹn gần nhất | Nearest Appointment | DD/MM/YYYY HH:mm |
| 12 | Lần khám cuối | Last Visit | DD/MM/YYYY HH:mm |
| 13 | Thao tác | Actions | View (eye) + Edit (pencil) buttons |

### Status Badges

| Status (VI) | Status (EN) | Style |
|---|---|---|
| Chưa phát sinh | No activity | Gray/default tag |
| Đang điều trị | In treatment | Blue tag |
| Hoàn tất | Completed | Green tag |

### Patient Code Format
Pattern: `[DH26XXX]` — prefix "DH" + year(2) + sequence number

### Pagination
- Page size selector: 5, 10, 20 (default), 25, 50, 100
- Display text: "Hiển thị X–Y trên Z bệnh nhân"
- Navigation: "Trước" (Previous), page numbers, "Sau" (Next)

## Empty State (Reception page)

- Icon: person/user outline icon (centered)
- Heading: "Không có lượt tiếp nhận phù hợp"
- Subtext: "Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm để xem thêm dữ liệu."
- Centered vertically in content area
- Light gray background area
