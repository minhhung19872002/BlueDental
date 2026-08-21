# BlueDental Reference — Route Map Discovery

> Reference System: https://app.nfcdental.com  
> Inspection Date: 2026-08-21  
> Phase: Phase 1 — Reception / Tiếp nhận Page Discovery

---

## 1. Authentication & System Routes

| Route Path | Page Title / Description | Auth Guard | Discovered Features & Notes |
|------------|--------------------------|------------|-----------------------------|
| `/` | Root Navigation | Public | Redirects unauthenticated visitors to `/signin` |
| `/signin` | Đăng nhập | Public | User login form, email + password, "Quên mật khẩu?" link |
| `/forgot-password` | Quên mật khẩu | Public | Password recovery flow |

---

## 2. Main Application Routes (Discovered from Client Chunks & RSC Tree)

| Route Path | Navigation Label (VI) | English Label | Key Features / Purpose |
|------------|-----------------------|---------------|------------------------|
| `/reception` | **Tiếp nhận** | Customer Reception | Patient arrival queue, status pipeline (Khách đến, Đang khám, Hoàn thành), create reception, doctor assignment |
| `/patient` | **Quản lý bệnh nhân** | Patient Management | Patient profiles, medical history, dental chart, treatment plans, prescriptions, labo history |
| `/calendar` | **Lịch hẹn** | Appointment Calendar | Week/Day grid calendar, appointment scheduling, room/chair allocation |
| `/operations` | **Quản trị vận hành** | Operations Management | Multi-block management (Khối điều trị, Khối lễ tân, Khối CSKH, Khối Marketing, Khối tài chính, Khối bảo vệ) |
| `/cskh-grouping` | **Chăm sóc khách hàng** | Customer Care | Customer care groups (Periodic, Special, Post-treatment, Birthday reminders) |
| `/labo` | **Labo** | Laboratory Orders | Labo order tracking, warranty, shipping dates, supplier tracking |
| `/materials` | **Vật tư** | Inventory & Materials | Dental consumable materials, stock tracking |
| `/report` | **Báo cáo** | Reports & Analytics | Sales revenue, customer count, income/expense reports |
| `/staff` | **Nhân viên** | Staff Management | Staff directory, doctor/assistant/receptionist role assignments |
| `/taxonomy` | **Danh mục** | System Catalogs | Dental procedures, diagnosis codes, medicine templates, prescription templates, customer sources |
| `/tools` | **Công cụ** | System Tools | Utility functions and auxiliary tools |
| `/roles` | **Phân quyền** | Role & Permissions | Permission matrix, access control per role |

---

## 3. Route Group Hierarchy (Next.js App Router Structure)

```
app/
├── (auth)/
│   ├── signin/
│   │   └── page.tsx           # /signin
│   └── forgot-password/
│       └── page.tsx           # /forgot-password
├── (dashboard)/
│   ├── reception/
│   │   └── page.tsx           # /reception (Tiếp nhận)
│   ├── patient/
│   │   └── page.tsx           # /patient (Danh sách & Hồ sơ bệnh nhân)
│   ├── calendar/
│   │   └── page.tsx           # /calendar (Lịch hẹn)
│   ├── operations/
│   │   └── page.tsx           # /operations (Quản trị vận hành)
│   ├── cskh-grouping/
│   │   └── page.tsx           # /cskh-grouping (CSKH)
│   ├── labo/
│   │   └── page.tsx           # /labo (Labo)
│   ├── materials/
│   │   └── page.tsx           # /materials (Vật tư)
│   ├── report/
│   │   └── page.tsx           # /report (Báo cáo)
│   ├── staff/
│   │   └── page.tsx           # /staff (Nhân sự)
│   ├── taxonomy/
│   │   └── page.tsx           # /taxonomy (Danh mục)
│   ├── tools/
│   │   └── page.tsx           # /tools (Công cụ)
│   └── roles/
│       └── page.tsx           # /roles (Phân quyền)
```
