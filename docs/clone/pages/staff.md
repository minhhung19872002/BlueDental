# Staff Page — /staff

Source: https://app.nfcdental.com/staff?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/staff-main.png

## Route

`/staff?branchId=<branchId>`

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                     │
│           │ TOOLBAR                                                       │
│           │ [🔍 Tìm theo tên, email, SĐT...]           [Tạo]            │
│           │──────────────────────────────────────────────────────────── │
│           │ STATUS TABS                                                   │
│           │ [Tất cả] [Đang làm việc] [Đã nghỉ]                          │
│           │──────────────────────────────────────────────────────────── │
│           │ TABLE (6 columns)                                             │
│           │ Tên | SĐT | Email | Phân quyền | Địa chỉ | Thao tác        │
│           │ ─────────────────────────────────────────────────────────── │
│           │ 11 staff rows (see data below)                               │
│           │──────────────────────────────────────────────────────────── │
│           │ PAGINATION: 20/trang  Hiển thị 1–11 trên 11 nhân viên      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Toolbar

| Control | Type | Notes |
|---------|------|-------|
| Search | Searchbox | Placeholder: "Tìm theo tên, email, số điện thoại..." |
| Tạo | Button | Create staff — UNKNOWN_REFERENCE_BEHAVIOR (form not opened) |

### 2. Status Tabs (3 tabs)

| Tab | Vietnamese | English |
|-----|-----------|---------|
| Tất cả | All | Default — shows all staff |
| Đang làm việc | Working | Active staff |
| Đã nghỉ | Resigned | Inactive/resigned staff |

### 3. Table Columns (6 columns)

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 1 | Tên | Name | Display name |
| 2 | Số điện thoại | Phone | Can be empty ("—") |
| 3 | Email | Email | Email address |
| 4 | Phân quyền | Role/Permission | Role name |
| 5 | Địa chỉ | Address | Usually "—" |
| 6 | Thao tác | Actions | "Chỉnh sửa" + "Xoá" buttons |

### 4. Observed Staff Data (11 staff, sanitized structure)

| Name | Phone | Role |
|------|-------|------|
| KT Dung | 0773678836 | Kế Toán |
| Bs Tới 2 | — | Bác Sĩ Điều Trị |
| Lễ Tân DH | — | Lễ Tân |
| BS Tới | — | Bác Sĩ Điều Trị |
| BS Tới 1 | — | Bác Sĩ Điều Trị |
| BS Tới 3 | — | Bác Sĩ Điều Trị |
| BS Tới 10 | — | Bác Sĩ Điều Trị |
| BS Hương | — | Bác Sĩ Điều Trị |
| BS Hương 4 | — | Bác Sĩ Điều Trị |
| BS Tiên | — | Bác Sĩ Điều Trị |
| BS Khanh | — | Bác Sĩ Điều Trị |

### 5. Confirmed Staff Roles (from data)

| Role (VI) | English |
|-----------|---------|
| Bác Sĩ Điều Trị | Treating Doctor |
| Lễ Tân | Receptionist |
| Kế Toán | Accountant |

Note: More roles may exist (counselor "Nhân sự tư vấn" seen on reception page, not yet confirmed in staff list).

### 6. Action Buttons per Row

| Button | Style | Behavior |
|--------|-------|----------|
| Chỉnh sửa | Outline | Edit staff — UNKNOWN_REFERENCE_BEHAVIOR (mutating) |
| Xoá | Outline/Danger | Delete staff — UNKNOWN_REFERENCE_BEHAVIOR (mutating) |

### 7. Pagination

Options: 5, 10, 20 (default), 25, 50, 100
Text: "Hiển thị 1–11 trên 11 nhân viên"
All 11 staff fit on one page (no pagination needed).

## API Reference

From agent-observed network:
```
GET /api/v1/staff/list
    ?page=1&perPage=20&status=active&isResigned=false
    &branchId=<id>&isDoctor=true
```
Fields: id, fullName, email, phoneNumber, role, status, isDoctor, isDentalAssistant,
        isPhysician, morningStartTime/End, afternoonStartTime/End, branchIds[]

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | "Tạo" form fields | Form not opened |
| 2 | "Chỉnh sửa" form | Mutating — not clicked |
| 3 | "Xoá" confirmation | Mutating — not clicked |
| 4 | Staff detail page | Not navigated to (may not exist, just edit modal) |
| 5 | "Đang làm việc" and "Đã nghỉ" tab results | Not clicked |
| 6 | Working hours display | Not in list view |
| 7 | Doctor-specific fields (chair assignment, specialties) | Not observed |
| 8 | "Nhân sự tư vấn" role | Not confirmed in staff list |
