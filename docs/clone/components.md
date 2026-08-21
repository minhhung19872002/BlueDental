# BlueDental Reference — Component Boundaries & Catalog

> Reference System: https://app.nfcdental.com  
> Inspection Date: 2026-08-21  
> Phase: Phase 1 — Reception / Tiếp nhận Page Component Breakdown

---

## 1. Global Chrome & Layout Components

### 1.1 `AppLayout` (Global Application Shell)
- **Role**: Root container for authenticated views.
- **Children**: `SidebarNav`, `AppHeader`, `MainContentContainer`.
- **Styling**: `min-h-screen flex bg-[#f0f5ff]`.

### 1.2 `SidebarNav` (Collapsible Navigation Sidebar)
- **Role**: Left-hand navigation menu.
- **Width**: `260px` expanded, `64px` collapsed (`w-16`).
- **Styling**: `bg-white border-r border-[#DCE3EE] flex flex-col justify-between`.
- **Sub-components**:
  - `SidebarHeader`: Application branding & logo image (`/logo_app.jpg`).
  - `SidebarMenu`: List of navigation items with SVG icons (`Tiếp nhận`, `Lịch hẹn`, `Bệnh nhân`, `CSKH`, `Vận hành`, `Labo`, `Vật tư`, `Báo cáo`, `Nhân viên`, `Danh mục`, `Công cụ`, `Phân quyền`).
  - `SidebarFooter`: Support hotline (`nfcdental.com`), copyright info (`Copyright© @NFC DENTAL 2024`).

### 1.3 `AppHeader` (Top Global Header)
- **Role**: Top header bar for branch context, user profile, and system utilities.
- **Height**: `64px` (`h-16`).
- **Styling**: `h-16 bg-white border-b border-[#DCE3EE] px-6 flex items-center justify-between`.
- **Sub-components**:
  - `BranchSelector`: Dropdown to switch clinic branches (`placeHolder.label.branch`).
  - `GlobalSearchInput`: Search keyword input.
  - `NotificationBell`: Notification trigger with alt+T aria-live section.
  - `UserProfileMenu`: User avatar, name, role badge (Doctor/Receptionist/Admin), PIN verification modal trigger for log access.

---

## 2. Shared UI Atomic / Primitive Components

| Component Name | File Path Target | Base Library / Styling | Description & Usage |
|----------------|------------------|------------------------|---------------------|
| `Button` | `components/ui/button.tsx` | Tailwind + Radix | Standard buttons (`bg-[#2671D8] text-white hover:bg-[#1E5BB0] h-10 px-4 rounded-lg font-medium text-sm`) |
| `Input` | `components/ui/input.tsx` | Tailwind + Radix | Form inputs (`h-10 px-3 border border-[#DCE3EE] rounded-lg focus-visible:ring-3 focus-visible:ring-[#2671D8]/20`) |
| `Select` | `components/ui/select.tsx` | Ant Design / Radix | Dropdown selectors (`Chọn nhân sự`, `Chọn chi nhánh`) |
| `Tabs` | `components/ui/tabs.tsx` | Radix Tabs | Tab bar component for status filtering (`Khách đến`, `Đang khám`, `Hoàn thành`, `Tất cả`) |
| `Badge` / `Tag` | `components/ui/badge.tsx` | Ant Design / Tailwind | Status badges (`Đã hẹn`, `Khách đến`, `Đang khám`, `Hoàn thành`, `Đã hủy`) |
| `Checkbox` | `components/ui/checkbox.tsx` | Radix Checkbox | Data table selection checkbox (`size-5 rounded border-slate-400 bg-white data-[state=checked]:bg-[#2671D8]`) |
| `DataTable` | `components/ui/data-table.tsx` | Ant Design Table / Custom | Reusable data table with headers, sorting, row selection, pagination |
| `EmptyState` | `components/ui/empty-state.tsx` | Custom | Centered placeholder layout when list is empty (`overview.label.noItem`) |

---

## 3. Reception Page Specific Components (`features/reception/components/`)

```
features/reception/
├── components/
│   ├── ReceptionHeader.tsx          # Page title "TỔNG QUAN - Tiếp nhận khách hàng" + summary metrics
│   ├── ReceptionCounterCards.tsx     # Stat cards: "Khách mới", "Khách cũ phát sinh", "Đã hẹn", "Khách đến"
│   ├── ReceptionToolbar.tsx          # Search bar, doctor select filter, priority sort, "Tạo tiếp nhận" button
│   ├── ReceptionStatusTabs.tsx       # Filter tabs: "Khách đến", "Đang khám", "Hoàn thành", "Tất cả"
│   ├── ReceptionTable.tsx            # Queue table: patient name, reception doctor, advising staff, status, total due
│   ├── ReceptionRowActions.tsx       # Context menu / action buttons per row ("Tiếp nhận", "Sửa ghi chú", "Xoá ghi chú")
│   └── ReceptionNewModal.tsx         # "Tạo tiếp nhận" drawer/modal (marked UNKNOWN_REFERENCE_BEHAVIOR for submission)
```

### 3.1 `ReceptionHeader`
- **Props**: `totalCount: number`, `newPatientsCount: number`, `oldPatientsCount: number`.
- **Elements**: Title `TỔNG QUAN`, Sub-heading `Tiếp nhận khách hàng`.

### 3.2 `ReceptionToolbar`
- **Props**: `onSearch: (keyword: string) => void`, `onDoctorFilter: (doctorId: string) => void`, `onCreateClick: () => void`.
- **Elements**:
  - `Input`: Placeholder `"Nhập từ khoá tìm kiếm"`.
  - `Select`: Placeholder `"Chọn nhân sự"`.
  - `Button`: Icon `Plus`, label `"Tạo tiếp nhận"`.

### 3.3 `ReceptionStatusTabs`
- **Props**: `activeTab: ReceptionStatus`, `counts: Record<ReceptionStatus, number>`, `onChange: (status: ReceptionStatus) => void`.
- **Options**:
  - `Khách đến` (`overview.reception.arrived` / `overview.label.come`)
  - `Đang khám` (`overview.reception.reception` / `overview.label.admittingDoctor`)
  - `Hoàn thành` (`overview.reception.done` / `overview.label.done`)
  - `Tất cả` (`overview.label.all`)

### 3.4 `ReceptionTable`
- **Columns**:
  1. `Số phiếu` (`treatment.label.code`)
  2. `Tên khách hàng / Bệnh nhân` (`treatment.label.patient`)
  3. `Bác sĩ tiếp nhận` (`treatment.label.staff` / `treatment.label.receptionDoctor`)
  4. `Nhân sự tư vấn` (`treatment.label.adviseDoctor`)
  5. `Nguồn tiếp nhận` (`medicalRecordTemplate.label.refType`)
  6. `Trạng thái - tiến độ` (`treatment.label.treatmentStatus`)
  7. `Chi tiết dịch vụ` (`treatment.label.service`)
  8. `Doanh thu dự kiến / Tổng tiền` (`treatment.label.expect` / `treatment.label.totalDue`)
  9. `Thao tác` (Actions column: `Tiếp nhận`, Menu `...`)
