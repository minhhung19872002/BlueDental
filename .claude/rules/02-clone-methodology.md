# Standard Methodology for 1:1 Clone (UI & Business Logic)

Quy trình chuẩn hóa cho AI Agent khi phát triển và clone 1:1 ứng dụng tham chiếu (https://app.nfcdental.com) sang dự án local `BlueDental`.

---

## 1. UI Parity Standard (Giao diện chuẩn Pixel-Perfect 100%)

### 1.1 Tech Stack Quy Định cho FE
- **CSS Framework**: Sử dụng **Tailwind CSS** (Trang gốc `app.nfcdental.com` sử dụng Tailwind CSS với các utility class như `flex`, `h-16`, `rounded-xl`, `min-h-[60px]`, `gap-1`, `hover:bg-white/10`...).
- **Icon System**: **Copy trực tiếp thẻ `<svg>`** từ Chrome DevTools `Elements` tab của trang gốc thay vì dùng icon từ thư viện khác để tránh lệch đường nét/kích thước.

### 1.2 Quy trình Bóc Tách UI (UI Extraction Process)
1. **Computed Styles Verification**:
   - Sử dụng DevTools `F12` -> Tab `Computed` để lấy thông số tuyệt đối:
     - Font: `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`
     - Box Model: `padding`, `margin`, `gap`, `border-radius`, `box-shadow`
     - Layout: `height`, `min-width`, `max-width`, `flex-direction`, `grid-template`
2. **Color Tokens Mapping**:
   - Lấy mã màu chuẩn HEX/RGBA từ DevTools và cập nhật vào `tailwind.config.js` hoặc CSS variables:
     - Primary Blue, Sidebar Background, Border Color (`#e5e7eb`...), Status Badges (Đã hẹn, Đã đến, Trễ hẹn, Hủy hẹn, Lịch tạm, Chuyển đổi).
3. **Visual Parity Testing**:
   - Chạy script `screenshot-compare.cjs` trong `BlueDental.FE` hoặc sử dụng Playwright visual snapshot để so sánh ảnh chụp màn hình ứng dụng gốc vs ứng dụng local.
   - Sửa tất cả sai lệch CSS cho đến khi hình ảnh lớp phủ đè trùng khít 100%.

---

## 2. API & Business Logic Parity Standard (Logic Backend 1:1)

### 2.1 Quy trình Reverse Engineer API (Network Capture)
1. **Bắt gói tin Network**:
   - Sử dụng Chrome DevTools -> Tab `Network` (Filter: `Fetch/XHR`).
   - Thực hiện từng thao tác trên giao diện Prod và ghi nhận vào `docs/clone/api.md`:
     - Endpoint URL, HTTP Method (GET, POST, PUT, DELETE)
     - Query Parameters (ví dụ `branchId`, `date`, `doctorId`, `status`)
     - Request Payload (JSON Body) & Response Data Structure (JSON)
2. **Thiết kế Schema & Enums**:
   - Dựa trên JSON Response, xây dựng ABP Domain Entities & Enums tương ứng tại `BlueDental.BE/src/BlueDental.Domain/`.
   - Đảm bảo mapping chính xác mã Enum trạng thái (Ví dụ: `AppointmentStatus`: 1=Đã hẹn, 2=Đã đến, 3=Hủy hẹn, 4=Trễ hẹn, 5=Lịch tạm, 6=Chuyển đổi).
3. **Data Scoping & Tenant Rules**:
   - Mỗi entity liên quan đến dữ liệu phòng khám PHẢI có thuộc tính `ClinicBranchId`.
   - Lọc dữ liệu theo `ClinicBranchId` tại AppService layer của ABP Backend.

---

## 3. Workflow theo từng tính năng (Feature-by-Feature Checklist)

Với mỗi trang/tính năng (Ví dụ: `Reception / Tiếp nhận`, `Patient List / Bệnh nhân`, `Appointments / Lịch hẹn`):

1. 🔍 **Observe & Document**: Soi UI + Bắt API $\rightarrow$ Ghi thông tin vào `docs/clone/pages/[page-name].md` & `docs/clone/api.md`.
2. 🛠️ **Backend Implementation**:
   - Viết DTOs trong `BlueDental.Application.Contracts`.
   - Viết AppService trong `BlueDental.Application`.
   - Viết Unit/Integration Tests.
3. 🎨 **Frontend Implementation**:
   - Dựng Reusable Component Tailwind CSS trong `BlueDental.FE/src/components/`.
   - Viết TanStack Query hooks kết nối API.
   - Dựng Page Component trong `BlueDental.FE/src/features/[feature]/pages/`.
4. ✅ **Verification**:
   - Chạy local `docker-compose up` hoặc `npm run dev`.
   - Đối chiếu visual parity & chạy Playwright tests.
