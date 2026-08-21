# Reception / Tiếp nhận Page Discovery Report

> Reference System: https://app.nfcdental.com  
> Inspection Date: 2026-08-21  
> Route Path: `/reception`  
> Inspection Phase: Phase 1 — Discovery Only (No local implementation yet)

---

## 1. Executive Summary

This report documents the structural, visual, functional, and architectural discovery of the **Reception / Tiếp nhận** page of the reference production application `https://app.nfcdental.com`.

All observations were gathered strictly in accordance with `.claude/rules/00-reference-readonly.md` and `.claude/rules/01-production-data.md`. No form inputs were filled, no mutating actions were triggered, and no production data was altered.

---

## 2. Obvious Routes & Navigation Context

- **Target Route**: `/reception`
- **Page Title**: `NFC Dental - Phần mềm quản lý nha khoa`
- **Navigation Path**: Sidebar -> `Tiếp nhận` (`sidebar.overview.list` / `sidebar.reception.list`)
- **Authentication Guard**: Unauthenticated access to `/` or `/reception` triggers `POST /api/auth/refresh`, returning `401 Unauthorized`, which redirects visitors to `/signin`.

---

## 3. Page Layout Architecture

```
+-----------------------------------------------------------------------------------+
|  AppHeader (h: 64px, bg: white, border-b: #DCE3EE)                                |
|  - Logo: NFC Dental                                                               |
|  - Branch Selector: "Chọn chi nhánh"                                              |
|  - Global Search & Notifications (alt+T)                                          |
|  - User Profile Menu & Role Badge                                                 |
+-------------------+---------------------------------------------------------------+
| SidebarNav        | Main Content Area (bg: #f0f5ff, min-h: calc(100vh - 64px))    |
| (w: 260px / 64px) |                                                               |
|                   | ReceptionHeader                                               |
| - Tiếp nhận (*)   | - Title: "TỔNG QUAN - Tiếp nhận khách hàng"                   |
| - Lịch hẹn        | - Metrics: Khách mới, Khách cũ phát sinh                      |
| - Bệnh nhân       |                                                               |
| - CSKH            | ReceptionToolbar                                              |
| - Vận hành        | - Search: "Nhập từ khoá tìm kiếm"                             |
| - Labo            | - Doctor Filter: "Chọn nhân sự"                               |
| - Action Button: "+ Tạo tiếp nhận" (bg: #2671D8)                              |
| - Vật tư          |                                                               |
| - Báo cáo         | ReceptionStatusTabs                                           |
| - Nhân viên       | - Tabs: [Khách đến] [Đang khám] [Hoàn thành] [Tất cả]          |
| - Danh mục        |                                                               |
| - Công cụ         | ReceptionTable / EmptyState                                   |
| - Phân quyền      | - Columns: Số phiếu | Bệnh nhân | Bác sĩ | Tiến độ | Tổng tiền |
|                   | - Empty State: "Danh sách trống"                              |
+-------------------+---------------------------------------------------------------+
```

---

## 4. Detailed Component & UI Control Analysis

### 4.1 Header (AppHeader)
- **Dimensions**: Height `64px` (`h-16`), Full viewport width minus sidebar.
- **Background & Border**: `bg-white`, `border-b border-[#DCE3EE]`.
- **Visible Controls**:
  - `BranchSelector`: Clinic branch select dropdown (`placeHolder.label.branch`).
  - `GlobalSearch`: Quick search bar.
  - `NotificationBell`: Trigger for system notifications (alt+T shortcut).
  - `UserProfileMenu`: User avatar, username, role label (e.g. `Lễ tân`, `Bác sĩ`), and PIN entry trigger (`operation.log.pin`).

### 4.2 Sidebar (SidebarNav)
- **Dimensions**: Expanded width `260px`, collapsed width `64px` (`w-16`).
- **Background & Border**: `bg-white`, `border-r border-[#DCE3EE]`.
- **Navigation Items**:
  - **Tiếp nhận** (`/reception`) — Active selection (`sidebar.overview.list`).
  - **Lịch hẹn** (`/calendar`) — `sidebar.calendar`.
  - **Bệnh nhân** (`/patient`) — `sidebar.patient`.
  - **Chăm sóc KH** (`/cskh-grouping`) — `sidebar.customerCare`.
  - **Vận hành** (`/operations`) — `sidebar.operation.list`.
  - **Labo** (`/labo`) — `sidebar.taxonomy.labo`.
  - **Vật tư** (`/materials`) — `sidebar.material.list`.
  - **Đơn thuốc mẫu** (`/medicine-template`) — `sidebar.medicineTemplate.list`.
  - **Báo cáo** (`/report`) — `sidebar.analytics`.
  - **Nhân viên** (`/staff`) — `sidebar.staff.list`.
  - **Danh mục** (`/taxonomy`) — `sidebar.taxonomy`.
  - **Phân quyền** (`/roles`) — `sidebar.roles`.
- **Footer Section**: Support hotline link (`nfcdental.com`) and copyright label (`Copyright© @NFC DENTAL 2024`).

### 4.3 Page Header & Counters (ReceptionHeader)
- **Title Text**: `TỔNG QUAN` (`overview.label.title`) / `Tiếp nhận khách hàng` (`overview.label.reception`).
- **Counter Metrics**:
  - `Khách mới` (`overview.label.newCustomer` / `overview.label.newPatient`): Count of new first-time registered patients today.
  - `Khách cũ phát sinh` (`overview.label.oldCustomer` / `overview.label.oldPatient`): Count of returning patients today.
  - `Đã hẹn` (`overview.label.created`): Scheduled appointments count today.
  - `Huỷ hẹn` (`overview.label.cancel`): Cancelled appointments count today.

### 4.4 Toolbar Controls (ReceptionToolbar)
- **Primary Action Button**:
  - Text: `+ Tạo tiếp nhận` (`overview.action.newProfile`)
  - Styling: `bg-[#2671D8] text-white hover:bg-[#1E5BB0] h-10 px-4 rounded-lg font-medium text-sm border-transparent`
  - Dimensions: Height `40px`, Min width `140px`.
  - Interaction Safety: Form submission marked `UNKNOWN_REFERENCE_BEHAVIOR #2`.
- **Search Keyword Input**:
  - Placeholder: `"Nhập từ khoá tìm kiếm"` (`placeHolder.label.keyword`)
  - Styling: `h-10 px-3 pl-11 border border-[#DCE3EE] rounded-lg text-sm bg-white`
  - Icon: Search magnifying glass prefix icon.
- **Staff / Doctor Filter Selector**:
  - Placeholder: `"Chọn nhân sự"` (`placeHolder.label.staff`)
  - Styling: Dropdown select control, height `40px`.

### 4.5 Pipeline Status Tabs (ReceptionStatusTabs)
The patient queue is categorized into 4 pipeline tabs:
1. **Khách đến** (`overview.reception.arrived` / `overview.label.come`): Patients present in clinic waiting room.
2. **Đang khám** (`overview.reception.reception` / `overview.label.admittingDoctor`): Patients currently in examination room with doctor.
3. **Hoàn thành** (`overview.reception.done` / `overview.label.done`): Patients who finished treatment/examination today.
4. **Tất cả** (`overview.label.all`): Unfiltered list of all reception records today.

### 4.6 Data Table & Columns (ReceptionTable)
- **Table Headers**:
  - `Số phiếu` (`treatment.label.code`) — Voucher / Reception Code.
  - `Bệnh nhân / Khách hàng` (`treatment.label.patient`) — Patient full name & contact.
  - `Bác sĩ tiếp nhận` (`treatment.label.staff` / `treatment.label.receptionDoctor`) — Assigned doctor.
  - `Nhân sự tư vấn` (`treatment.label.adviseDoctor`) — Advising staff.
  - `Nguồn tiếp nhận` (`medicalRecordTemplate.label.refType`) — Channel (Y tế / Tự đến).
  - `Trạng thái - tiến độ` (`treatment.label.treatmentStatus`) — Progress status badge.
  - `Chi tiết dịch vụ` (`treatment.label.service`) — Total services / procedures.
  - `Tổng tiền / Doanh thu dự kiến` (`treatment.label.expect` / `treatment.label.totalDue`) — Financial total in VND.
  - `Thao tác` — Action buttons (`Tiếp nhận`, `...` dropdown menu).
- **Row Actions**:
  - Button `Tiếp nhận` (`appointmentSchedule.action.reception`): Marked `UNKNOWN_REFERENCE_BEHAVIOR #3`.
  - `Sửa ghi chú` / `Xoá ghi chú`: Marked `UNKNOWN_REFERENCE_BEHAVIOR #4`.

### 4.7 Empty State (EmptyState)
- **Label**: `Danh sách trống` (`overview.label.noItem`) / `Không có lịch hẹn hôm nay` (`customer.label.reception.notValid`).
- **Styling**: Centered layout, grey placeholder icon, slate body text (`text-slate-500`).

---

## 5. Observed Network Requests

| Method | Request URL | Status | Description |
|--------|-------------|--------|-------------|
| `GET` | `https://app.nfcdental.com/` | `200` | Next.js HTML page root |
| `POST` | `https://app.nfcdental.com/api/auth/refresh` | `401` | Session token validation check |
| `GET` | `https://api.nfcdental.com/api/v1/maintenance/status` | `200` | Public system maintenance status API |
| `GET` | `https://app.nfcdental.com/_next/static/chunks/...` | `200` | Frontend JS and CSS bundle chunks |

---

## 6. Exact Dimensions & Design Tokens

- **Font Family**: `"Google Sans", sans-serif`
- **Primary Color**: `#2671D8` (`rgb(38, 113, 216)`)
- **Primary Hover Color**: `#1E5BB0` (`rgb(30, 91, 176)`)
- **Background Color**: `#fcfdff` to `#f0f5ff` gradient background
- **Border Color**: `#DCE3EE` (`rgb(220, 227, 238)`)
- **Card Background**: `bg-white/70 backdrop-blur-xl border border-white/80`
- **Card Radius**: `rounded-[24px]` / `rounded-[40px]`
- **Card Shadow**: `shadow-[0_32px_80px_rgba(15,23,42,0.12)]`
- **Control Height**: `40px` (`h-10`)
- **Control Border Radius**: `8px` (`rounded-lg`)
- **Checkbox Dimensions**: `20px x 20px`, border-radius `4px`, border `#94A3B8`

---

## 7. Component Boundaries & Extraction Plan

For clean-room implementation in `BlueDental.FE`, the Reception feature shall be structured into modular components following the container/presenter pattern specified in `CLAUDE.md`:

```
BlueDental.FE/src/features/reception/
├── api/
│   ├── useReceptionList.ts           # TanStack Query hook for reception queue
│   ├── useReceptionMutations.ts      # Create / status transition mutations
│   └── receptionAdapter.ts           # DTO to ViewModel transform
├── components/
│   ├── ReceptionHeader.tsx           # Title + metric counters presenter
│   ├── ReceptionToolbar.tsx          # Search + filter + create button presenter
│   ├── ReceptionStatusTabs.tsx       # Queue pipeline status tabs presenter
│   ├── ReceptionTable.tsx            # Queue data table presenter
│   └── ReceptionNewModal.tsx         # Patient reception creation drawer
└── pages/
    └── ReceptionPage.tsx             # Container page component
```

---

## 8. Unknown Reference Behaviors Log Summary

All mutating interactions on production reference were strictly avoided and logged:
- `UNKNOWN_REFERENCE_BEHAVIOR #1`: Authentication submission on `/signin`.
- `UNKNOWN_REFERENCE_BEHAVIOR #2`: Form submission inside `Tạo tiếp nhận` drawer.
- `UNKNOWN_REFERENCE_BEHAVIOR #3`: `Tiếp nhận` queue row status transition action.
- `UNKNOWN_REFERENCE_BEHAVIOR #4`: Note edit/delete actions.
- `UNKNOWN_REFERENCE_BEHAVIOR #5`: Branch context switcher select.
