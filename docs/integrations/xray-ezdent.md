# Liên kết máy X-quang — Vatech EzDent-i (F-95)

Chủ dự án chốt 2026-11-11. Không dùng DICOM: phim đi dưới dạng JPEG / PNG mà
EzDent-i lưu hoặc xuất ra thư mục.

## Hai việc

1. **Đẩy ảnh tự động.** Agent trên PC X-quang theo dõi thư mục ảnh của
   EzDent-i và gửi từng ảnh mới lên BlueDental.
   - **Tên tệp có Mã KH** (Biểu đồ số) của một hồ sơ **cùng chi nhánh với
     máy**: ảnh vào **Hình ảnh → Trước điều trị** của hồ sơ đó, kèm chip
     "X-quang".
   - **Mọi ảnh khác** chờ ở **Ảnh chưa gán hồ sơ** (`/xray-inbox`) để nhân
     viên gán hoặc bỏ qua. Tên + năm sinh chỉ dùng để **gợi ý**, không bao
     giờ tự gán.
2. **Nút "Mở EzDent-i"** trên tab Hình ảnh. Nút chỉ hiện khi chi nhánh có ít
   nhất một máy đang hoạt động.
   - Web mở `bluedental-xray://open?code=<Mã KH>`. Link chỉ mang mã, không
     mang PHI.
   - Agent hỏi BlueDental thông tin hồ sơ đó qua HTTPS kèm device token, ghi
     `linkage.xml`, rồi chạy loader của EzDent-i.

```
[Web] ─ bluedental-xray://open?code=DH260052 ─► [Agent, tray app, HKCU]
                                                  ├─ GET  station/patients/by-code → linkage.xml → VTE2Loader32.exe
                                                  └─ POST station/images  (watcher thư mục ảnh)
                                                            │ HTTPS ra ngoài, header X-Xray-Device-Token
                                                            ▼
[BE] khớp mã trong chi nhánh của máy ─┬─ khớp → PatientImage(Before, XrayDeviceId) + inbox AutoAssigned
                                      └─ không → XrayInboxItem Pending → nhân viên gán / bỏ qua
```

Phòng khám không phải mở cổng và không cần IP tĩnh.

## Xác thực máy

Làm theo mẫu SigningDevice (iPad ký phiếu thu).

- **Cấp token:** Cài đặt → **Máy X-quang** → Thêm máy. Token dài 43 ký tự
  base64url và **chỉ hiện một lần**.
- **Lưu trữ:** DB chỉ giữ SHA-256 của token.
- **Thu hồi:** sau khi thu hồi, mọi lệnh gọi của máy bị trả `Imaging:0002`.
- **Chi nhánh:** luôn lấy theo `XrayDevice.ClinicBranchId`, không bao giờ
  đọc từ header.
- **Endpoint station:** `[AllowAnonymous]` + `[DisableAuditing]`. Xác thực
  bằng header `X-Xray-Device-Token`.

## API

```
# Agent (station, không cookie)
GET  /api/v1/public/xray-station                     → { deviceName, branchName }
POST /api/v1/public/xray-station/images              multipart: file, code?, name?, birthYear?, capturedAt?
                                                     → { inboxItemId, status (1 Pending / 2 AutoAssigned), duplicate }
GET  /api/v1/public/xray-station/patients/by-code?code=   → các trường linkage (Họ, Tên, Mã, ngày sinh, giới tính)

# Cài đặt (Organizations.View / Edit + BranchAccessChecker)
GET  /api/v1/app/xray-devices?clinicBranchId
POST /api/v1/app/xray-devices                        → kèm token (một lần)
POST /api/v1/app/xray-devices/{id}/revoke
GET  /api/v1/app/xray-devices/has-active?clinicBranchId   (TreatmentImage.Read) — ẩn/hiện nút Mở EzDent-i

# Ảnh chưa gán hồ sơ (theo chi nhánh)
GET  /api/v1/app/xray-inbox?clinicBranchId&skipCount&maxResultCount   (TreatmentImage.Read)
GET  /api/v1/app/xray-inbox/count?clinicBranchId                         (badge menu, 60 s)
GET  /api/v1/app/xray-inbox/{id}/content
GET  /api/v1/app/xray-inbox/{id}/suggestions        tối đa 5 hồ sơ: trùng tên (không dấu) + năm sinh
POST /api/v1/app/xray-inbox/{id}/assign { patientId }   (TreatmentImage.Create)
POST /api/v1/app/xray-inbox/{id}/discard               (TreatmentImage.Delete) → 204
```

**Quy tắc phía server:**

- **Kiểm tra tệp:**
  - Magic bytes phải là JPEG hoặc PNG.
  - Tối đa 20 MB (`PatientImage.MaxSizeBytes`).
  - Quét ClamAV theo kiểu fail-closed: không quét được thì trả
    `Imaging:0006`, agent sẽ gửi lại sau.
- **Chống trùng:** khoá unique `(XrayDeviceId, Sha256)`. Gửi lại cùng một tệp
  thì nhận `duplicate: true` và vẫn cùng `inboxItemId`.
- **Khớp mã:**
  - So với `PatientCode` theo mọi cách viết mà `PatientCodeNumbering`
    chấp nhận; không thấy thì thử `LegacyId`.
  - Luôn kèm điều kiện `Patient.BranchId == device.ClinicBranchId`. Mã thuộc
    chi nhánh khác thì ảnh vào inbox.
- **Hàng inbox:** mọi tệp nhận về đều có một dòng `XrayInboxItem`, kể cả ảnh
  đã tự gán. Bảng này là nhật ký gọi API của tích hợp.
- **Gán / bỏ qua:** chỉ làm được khi ảnh đang Pending (`Imaging:0008`). Hồ sơ
  phải thuộc chi nhánh của máy (`Imaging:0009`).
- **Ghi ảnh:** upload tay, ảnh tự gán và ảnh gán từ inbox đều đi qua
  `PatientImageWriter`, nên cùng blob name, cùng Ordering và cùng cách lưu.
  Ảnh tự gán có `StaffId = null`.

**Mã lỗi:**

| Mã | Ý nghĩa |
|---|---|
| `Imaging:0001` | thiếu tên máy |
| `Imaging:0002` | máy chưa ghép hoặc đã thu hồi |
| `Imaging:0003` | không phải JPEG / PNG |
| `Imaging:0004` | quá dung lượng |
| `Imaging:0005` | có mã độc |
| `Imaging:0006` | chưa quét được mã độc |
| `Imaging:0007` | không tìm thấy ảnh inbox |
| `Imaging:0008` | ảnh đã xử lý |
| `Imaging:0009` | hồ sơ không thuộc chi nhánh |

**DB:**

- Migration `XrayAgentF95` (`20261111025037`), **cần chạy DbMigrator**.
- Hai bảng mới: `bd_xray_devices` và `bd_xray_inbox_items`.
- `bd_patient_images`: `StaffId` cho phép null, thêm `XrayDeviceId` kèm
  index.

**nginx:** thêm `location /api/v1/public/xray-station/` với
`client_max_body_size 21m`, vì giới hạn chung của `/api/` là 20m.

## Agent Windows

Mã nguồn ở `BlueDental.XrayAgent/`. Cách build, cài đặt tại phòng khám, mẫu
`linkage.xml` và chỗ lưu dữ liệu đều có trong `BlueDental.XrayAgent/README.md`.

**Tóm tắt:**

- **Nền tảng:** .NET 9 WinForms tray app, publish single-file self-contained.
- **Cài đặt:** `--install` / `--uninstall` chỉ ghi vào HKCU, gồm protocol
  `bluedental-xray` và mục Run. Không cần quyền admin.
- **Token:** lưu bằng DPAPI CurrentUser.
- **Watcher:**
  - Dùng FileSystemWatcher và quét lại mỗi 60 giây.
  - Một tệp chỉ được gửi khi kích thước đứng yên 2 giây và mở độc quyền được.
  - Chỉ nhận `.jpg/.jpeg/.png`.
- **Gửi lỗi:** thử lại sau 5 s, 15 s, 1 phút, 5 phút, rồi cứ 15 phút một lần.
- **Tệp bị từ chối** (không phải ảnh, quá cỡ): không gửi lại.
- **Token bị thu hồi:** agent dừng gửi cho tới khi có token mới.
- **Mở lần hai:** bản thứ hai chuyển link sang bản đang chạy qua named pipe
  rồi thoát.
- **Log không chứa PHI:** chỉ có Mã KH và 12 ký tự hex đầu của SHA-256. Không
  có tên, ngày sinh hay đường dẫn tệp. `state.json` lưu khoá theo hash.

## UNVERIFIED — chưa thử với EzDent-i thật

Đã tách thành cấu hình để chỉnh tại phòng khám, không cần build lại.

UNKNOWN_REFERENCE_BEHAVIOR
Page: EzDent-i 3.5.3 Console (phần mềm của Vatech, không phải app.nfcdental.com)
Control: tên tệp khi EzDent-i lưu / xuất ảnh
Reason: chưa có máy hoặc bộ cài để xem. Không biết tên tệp có chứa Biểu đồ số hay không, hay ảnh được xếp theo thư mục của từng bệnh nhân
Action taken: NONE. Regex trong agent có thể cấu hình, mặc định `^(?<code>DH\d{6,}|\d{3,7})`; có tuỳ chọn lấy mã từ tên thư mục cha.

UNKNOWN_REFERENCE_BEHAVIOR
Page: EzDent-i, cầu nối mở bệnh nhân
Control: định dạng `linkage.xml`, tên loader (`VTE2Loader32.exe` hay `VTEzBridge.exe`), tham số dòng lệnh
Reason: chưa có tài liệu chính thức của Vatech. Mẫu hiện tại dựng theo các trường mà Open Dental công bố cho cầu nối Vatech (ChartNumber, LastName, FirstName, Birthday yyyyMMdd, Gender)
Action taken: NONE. Mẫu tệp, loader và tham số đều chỉnh được trong agent.

UNKNOWN_REFERENCE_BEHAVIOR
Page: EzDent-i, ô Biểu đồ số của hồ sơ cũ
Control: Biểu đồ số đang dùng có trùng `PatientCode` (DHyy…) hay `LegacyId` của hệ thống cũ không
Reason: đang chờ phòng khám gửi một ví dụ
Action taken: NONE. Server khớp cả `PatientCode` lẫn `LegacyId`.

**Việc còn lại:** thử với bộ cài EzDent-i (qua đại lý Vatech) hoặc tại phòng
khám để chốt regex tên tệp, thư mục ảnh và cách EzDent-i nhận ChartNumber.
