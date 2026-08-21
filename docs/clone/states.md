# BlueDental Reference — Application & Page States

> Reference System: https://app.nfcdental.com  
> Inspection Date: 2026-08-21  
> Phase: Phase 1 — Reception / Tiếp nhận Application States

---

## 1. Global Application States

### 1.1 Unauthenticated Visitor State (Observed)
- **Trigger**: Accessing `https://app.nfcdental.com` without a valid session token.
- **Behavior**: System executes `POST /api/auth/refresh`, receives `401 Unauthorized`, and automatically redirects browser location to `/signin`.
- **UI Rendered**: Centered floating authentication card (`rounded-[40px] border border-white/80 bg-white/70 backdrop-blur-xl shadow-[0_32px_80px_rgba(15,23,42,0.12)]`).
- **Form Controls**: Email input, Password input with show/hide password toggle button, "Ghi nhớ đăng nhập" checkbox (`role="checkbox"`), "Quên mật khẩu?" link (`href="/forgot-password"`), and "Đăng Nhập" submit button (`bg-[#2671D8]`).

### 1.2 Authenticated Dashboard State (Discovered)
- **Trigger**: Valid session token present.
- **Behavior**: System renders `AppLayout` chrome with active sidebar navigation item, sticky top header bar, and active route content.

---

## 2. Reception Page (`/reception`) UI & Data States

### 2.1 Initial Loading State
- **Trigger**: Route navigation to `/reception`.
- **UI Behavior**: Displays Ant Design Spin loading indicator or skeleton loaders for table rows and counter cards.

### 2.2 Reception Queue Status Pipeline States
The Reception page filters patient queue records across 4 primary status states:

1. **Khách đến** (`overview.reception.arrived` / `overview.label.come`):
   - Patients who have physically arrived at the clinic reception and are in the waiting queue.
   - Status tag color: `cyan` / `blue`.
2. **Đang khám** (`overview.reception.reception` / `overview.label.admittingDoctor`):
   - Patients currently in consultation or actively undergoing treatment with an assigned doctor.
   - Status tag color: `orange` / `processing`.
3. **Hoàn thành** (`overview.reception.done` / `overview.label.done`):
   - Patients whose examination/treatment session for today is complete.
   - Status tag color: `green` / `success`.
4. **Tất cả** (`overview.label.all`):
   - Complete view of all patient reception records for the selected date filter regardless of status.

### 2.3 Reception Counter States
- **Khách mới** (`overview.label.newCustomer` / `overview.label.newPatient`): Count of first-time registered patients today.
- **Khách cũ** (`overview.label.oldCustomer` / `overview.label.oldPatient`): Count of returning patients today.
- **Đã hẹn** (`overview.label.created`): Count of patients with scheduled appointments today.
- **Huỷ hẹn** (`overview.label.cancel`): Count of cancelled appointments.

### 2.4 Empty Queue State (Observed Spec)
- **Trigger**: When no patient reception records match the current status filter, keyword search, or doctor filter.
- **UI Behavior**: Renders `EmptyState` component.
- **Text Labels**:
  - Primary: `Danh sách trống` (`overview.label.noItem`)
  - Secondary: `Không có lịch hẹn hôm nay` (`customer.label.reception.notValid`) / `Không có ghi chú` (`overview.label.noNote`)
- **Styling**: Centered empty illustration graphic, muted text (`text-slate-500`), clean layout.

### 2.5 Active Drawer / Modal State
- **Trigger**: Clicking `Tạo tiếp nhận` (`overview.action.newProfile`) button in toolbar.
- **UI Behavior**: Opens slide-over drawer / modal form for patient reception entry (**UNSAFE TO SUBMIT ON PRODUCTION — MARKED UNKNOWN_REFERENCE_BEHAVIOR**).
