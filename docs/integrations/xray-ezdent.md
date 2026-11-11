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

**Đã chốt (2026-11-11): mã lấy từ tệp thông tin ảnh, không lấy từ tên tệp.**

- Tên tệp xuất có dạng `PX<yyyyMMdd>_<HHmmss>_<n>_<n>` và không chứa Biểu đồ số.
- Khi xuất có tick **"Thêm Tệp Thông tin Hình ảnh"**, EzDent-i ghi thêm một tệp văn bản **cùng tên gốc, cùng thư mục** với ảnh. Mỗi dòng có dạng `Khoá : giá trị`. Cấu trúc như sau (giá trị chỉ là ví dụ tổng hợp):

  ```
  Chart No : <số>
  Name : <HỌ TÊN>^
  Birthday : yyyy-MM-dd
  Image Type : Panorama
  kVp : <số>
  mA : <số>
  DAP : <số> dGycm²
  Acquisition Date : yyyy-MM-ddTHH:mm:ss+07:00
  ```

- **Agent đọc tệp này** (`EzdentInfoFile`, cài đặt `ReadEzdentInfoFile`, mặc định bật):
  - Chart No là mã gửi lên server.
  - Name bỏ ký tự `^` và chỉ dùng để gợi ý trong inbox.
  - Birthday chỉ lấy năm.
  - Acquisition Date là giờ chụp.
  - Các trường kVp / mA / DAP bị bỏ qua.
- **Thứ tự ưu tiên:** tệp thông tin thắng tên tệp. Trường nào tệp thông tin không có thì mới lấy từ regex tên tệp.
- **Chờ tệp thông tin:** nếu ảnh mới mà chưa thấy tệp thông tin, agent đợi tối đa 20 giây kể từ lúc ảnh được ghi. Hết thời gian thì gửi ảnh không kèm mã, và ảnh vào inbox.
- **Cách tìm tệp:**
  - Agent tìm tệp cùng tên gốc, bỏ qua các tệp ảnh / `.dcm` và ưu tiên `.txt`. Đuôi thật của tệp thông tin vẫn chưa thấy vì Explorer đang ẩn đuôi.
  - Mã hoá: UTF-8 / UTF-16 theo BOM, nếu không phải UTF-8 hợp lệ thì đọc theo Latin-1.
  - Bỏ qua tệp lớn hơn 64 KB.
- **Log:** không ghi tên tệp hay nội dung tệp thông tin, chỉ ghi `code=… sha=… info=yes|no`.

UNKNOWN_REFERENCE_BEHAVIOR
Page: EzDent-i 3.5.3 Console (phần mềm của Vatech, không phải app.nfcdental.com)
Control: tệp thông tin ảnh khi xuất ("Thêm Tệp Thông tin Hình ảnh")
Reason: chưa thấy đuôi tệp và bảng mã. Chưa biết EzDent-i ghi tệp thông tin trước hay sau ảnh
Action taken: NONE. Agent nhận mọi đuôi không phải ảnh, đọc được UTF-8 / UTF-16 / Latin-1, và chờ tệp thông tin tối đa 20 giây.

UNKNOWN_REFERENCE_BEHAVIOR
Page: EzDent-i, cầu nối mở bệnh nhân
Control: định dạng `linkage.xml`, tên loader (`VTE2Loader32.exe` hay `VTEzBridge32.exe`), tham số dòng lệnh
Reason: chưa có tài liệu chính thức của Vatech. Mẫu hiện tại dựng theo các trường mà Open Dental công bố cho cầu nối Vatech (ChartNumber, LastName, FirstName, Birthday yyyyMMdd, Gender)
Action taken: NONE. Mẫu tệp, loader và tham số đều chỉnh được trong agent.

UNKNOWN_REFERENCE_BEHAVIOR
Page: EzDent-i, ô Biểu đồ số của hồ sơ cũ
Control: Biểu đồ số đang dùng có trùng `PatientCode` (DHyy…) hay `LegacyId` của hệ thống cũ không
Reason: đang chờ phòng khám gửi một ví dụ
Action taken: NONE. Server khớp cả `PatientCode` lẫn `LegacyId`.

**Đã thấy trên máy phòng khám (ảnh chụp màn hình 2026-11-11, không lưu vào repo vì có tên bệnh nhân):**

- **Phiên bản:** EzDent-i 3.5.3, chế độ cài đặt **Console** (máy trạm nối vào server EzDent-i), floating license. Module gồm Patient / Acquisition / Viewer / Consult / Report / Twain / DicomPrint / Consult Premium.
- **Biểu đồ số của hồ sơ cũ là số thuần**, dài 3–7 chữ số. Chưa thấy mã dạng `DH…`.
  - Regex mặc định của agent (`\d{3,7}`) đã bắt được dạng này.
  - Server chỉ tự gán khi số đó bằng đúng Mã KH hoặc ID hệ thống (`LegacyId`) của một hồ sơ cùng chi nhánh. Không khớp thì ảnh vào inbox.
  - Vẫn chưa biết số này có trùng ID hệ thống của dữ liệu đã chuyển sang BlueDental không.
- **Ảnh có thể nằm trên server.** Bản Console nên kho ảnh nhiều khả năng ở máy server EzDent-i, không ở máy trạm. Thư mục agent theo dõi có thể là ổ mạng.

**Đợt ảnh thứ hai (2026-11-11, cũng không lưu vào repo):**

- **Shortcut EzDent-i:** Target là `C:\Program Files (x86)\VATECH\EzDent-i\Bin\VTE2Loader32.exe`, không có tham số. Start in là thư mục `Bin`. Khớp với cấu hình mặc định của agent.
- **Thư mục Bin** có `VTE2Loader32`, `VTE232`, `VTE2_ReqAdmin32`, `VTEzBridge32` (không phải `VTEzBridge.exe`, đã sửa danh sách trong agent), `VTEzNavi.dll`, `VTFileManagerAgent32` và `libpq.dll`.
- **Ảnh gốc là DICOM.** Hộp thoại Xuất (Trình hiển thị) ghi Loại tệp `dcm`. Định dạng xuất gồm Gốc / BMP / JPG / JPEG / PNG / TIF, nên nhân viên **phải chọn JPG hoặc PNG**.
- **Ảnh xuất ra ổ cục bộ** (Đĩa Cục bộ → Select Folder). Agent có thể theo dõi một thư mục trên máy trạm, không cần ổ mạng.
- **Tên tệp không chứa Biểu đồ số.** Ví dụ: `PX20261111_110106_6418_48300886`, nghĩa là PX + ngày + giờ + hai số chưa rõ nghĩa. Biểu đồ số của hồ sơ đó là một số 6 chữ số khác.
  - Regex mặc định neo `^` nên không bắt nhầm, và ảnh sẽ vào inbox.
  - **Không được dùng regex lấy số ở cuối tên tệp.**
- **Còn mở:**
  - ~~Tuỳ chọn "Thêm Tệp Thông tin Hình ảnh" sinh ra tệp gì~~: đã rõ. Tệp này có mang Chart No, agent đọc nó (xem đầu mục này).
  - Khi xuất, EzDent-i có tạo thư mục con không. Trên Desktop có thư mục tên dạng `yyyyMMdd_HHmmss` và thư mục tên bệnh nhân.
  - EzDent-i có chế độ xuất tự động hay không.

**Sách hướng dẫn trong EzDent-i (Help → `EzDent-i_User Manual_Eng`):**

- **Chapter 2 → 4 Environment** có các tab General / Database / Patient / Linkage/E-mail / Practice Information.
  - **4.3 Patient → CHART NUMBERING:** một ô tick "Automatic" quyết định Biểu đồ số do EzDent-i tự sinh hay được gõ tay. Phòng khám đang gõ tay theo Mã KH.
  - **4.4 Linkage/E-mail không phải cầu nối với phần mềm quản lý phòng khám (PMS).** Mục này chỉ có đường dẫn trình xem 3D (Ez3D-i), phần mềm phân tích Ceph (EzOrtho / OrthoVision / V-Ceph), phần mềm thứ ba và thông tin gửi email. Cầu nối PMS (`VTE2Loader32` / `linkage.xml`) không có trong sách người dùng.
- **Search "Export" ra 21 mục.** Các mục đáng xem còn lại:
  - "8. Exporting Image wit…"
  - "4. Exporting to Acquisit…"
  - "5. Exporting Patient Inf…"
  - "3.4 Importing/Exporting"
  - Mục 6.2 Export của Report không liên quan. Mục này chỉ cho biết khi bật Privacy Policy, lúc xuất có thể chọn ẩn danh thông tin bệnh nhân.
  - Đã xem và **không liên quan:**
    - 3.4: xuất / nhập Implant DB.
    - Chapter 3 mục 4: thống kê liều chiếu (kVp, mA, DAP).
    - Chapter 3 mục 5: xuất thông tin bệnh nhân ra `.csv` / `.zip`, phải nhập ID + mật khẩu.
  - **Chapter 5 mục 8 (Export Image with Overlay):**
    - Chuột phải vào ảnh ra menu Image Edit / Copy to Clipboard / Export / Export Image with Overlay / **File Information** / Toggle Presentation Mode / Delete Overlay.
    - Các bước tiếp theo trỏ sang **Chapter 1 → 5 Main Menu → 5.2 Export**.
- **Xuất thử thật (PNG, có tick "Thêm Tệp Thông tin Hình ảnh") vào một thư mục trống:**
  - **Kết quả:** đúng 2 tệp **cùng tên gốc** `PX<yyyyMMdd>_<HHmmss>_<n>_<n>`, nằm thẳng trong thư mục đó, không có thư mục con.
    - Tệp ảnh PNG.
    - Một tệp thông tin. Đuôi tệp chưa thấy vì Explorer đang ẩn đuôi.
  - **Thư mục Desktop đang đồng bộ OneDrive.** Không được cho agent theo dõi thư mục trong OneDrive vì hai lý do:
    - Phim kèm thông tin bệnh nhân sẽ lên cloud của Microsoft.
    - Tệp có thể chỉ là bản giữ chỗ trên cloud.
  - Nên dùng một thư mục riêng ngoài OneDrive, ví dụ `C:\XrayExport`.
- **Sách người dùng không nói tới chế độ xuất ảnh tự động.** Nếu không có chế độ này, ảnh chỉ ra thư mục khi nhân viên bấm Xuất.
- **4.2 Database → EZPICKER:** "EzPicker is a program that can link a third party PMS with EzDent-i". Chi tiết nằm trong **Service Manual** (tài liệu của đại lý), không có trong sách người dùng.
- **Quick Settings:**
  - Cổng EzServer mặc định là 43112 (v3.1 trở lên) hoặc 55005 (bản nâng cấp).
  - Teeth Code chọn Universal hoặc FDI.
  - **Save Option** cho IO Sensor / IO Camera / Scan là `Manual` hoặc `Auto DB Save`. Đây là cách lưu vào DB của EzDent-i, chưa phải xuất ra thư mục.

**Việc còn lại:** thử với bộ cài EzDent-i (qua đại lý Vatech) hoặc tại phòng
khám để chốt regex tên tệp, thư mục ảnh và cách EzDent-i nhận ChartNumber.
