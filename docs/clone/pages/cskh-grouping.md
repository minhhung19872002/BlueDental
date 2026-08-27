# CSKH / Customer Care Page — /cskh-grouping

Source: https://staging.nfcdental.com/cskh-grouping?branchId=<branchId> (staging là reference chuẩn từ 2026-08-26)
Observed: 2026-08-26 (dữ liệu test: tháng 04/2026 cho tab care; tab group không phụ thuộc ngày)
Screenshots + captures: reference-private/survey/staging/cskh-*.png, cskh-*.xlsx, cskh-*-response.json

## Route & URL params

`/cskh-grouping?branchId=<branchId>&tab=<care|group>&...`

| Param | Values | Notes |
|---|---|---|
| `tab` | `care` (mặc định) / `group` | Top tab. Giá trị khác (vd `grouping`) → fallback về `care` |
| `page` | `after-treatment` (mặc định) / `birthday` / `remind-appointment` / `periodic` / `special` | Care-type tab, chỉ khi `tab=care` |
| `care_dateMode` | `day` / `week` / `month` | Đổi mode reset `care_date` về hiện tại (day→hôm nay, week→thứ 2 tuần này, month→ngày 1 tháng này) |
| `care_date` | `yyyy-MM-dd` | day: ngày; week: thứ Hai của tuần; month: ngày 1 của tháng |
| `taxonomyId` | ObjectId | Chỉ tab group — filter Nhóm dịch vụ (được sync lên URL) |

Các filter khác (status, staffId, careStaffId, q, birthdayDate) KHÔNG sync lên URL.

## Top tabs

| Tab | URL | Nội dung |
|---|---|---|
| Chăm sóc khách hàng | `tab=care` | 5 care-type tab + counters + date modes |
| Phân nhóm CSKH | `tab=group` | Bảng bệnh nhân (12 cột) + filter nhóm dịch vụ/tag/sinh nhật |

---

# TAB 1 — Chăm sóc khách hàng (`tab=care`)

## Layout

```
[Ngày|Tuần|Tháng]  < 26/08/2026 >          ← date mode tabs + prev/next
[n Tổng khách][n Thành công][n Thất bại][n Chưa CS][n Đã gửi Zalo]   ← 5 counter filter
[Sau điều trị][Chúc mừng sinh nhật][Nhắc lịch hẹn][CSKH định kì][CSKH đặc biệt]
[Xuất Excel] [Tìm kiếm] [Bác sĩ điều trị ▼] [Nhân viên CSKH ▼] [Tạo mới]  ← per-tab, xem ma trận
TABLE (cột per-tab)
[5/10/20/25/50/100 / trang]  Hiển thị X–Y trên Z khách  [Trước][Sau]
```

## Date mode

| Mode | Label giữa | prev/next | care_date |
|---|---|---|---|
| Ngày | `26/08/2026` | Ngày trước / Ngày kế tiếp | ngày đó |
| Tuần | `24/08 - 30/08/2026` | tuần | thứ Hai |
| Tháng | `04/2026` | tháng | ngày 1 |

Date range gửi API: UTC ISO có offset +7 (tháng 4 = `2026-03-31T17:00:00.000Z` → `2026-04-30T16:59:59.999Z`).

## Ma trận care-type tab → API

`GET /api/v1/customer-care` + `GET /api/v1/customer-care-stats` (cùng params trừ page/take):

| URL `page=` | API `type=` | sortBy | sortDir | date params |
|---|---|---|---|---|
| after-treatment | afterTreatment | dateTime | desc | startTime/toTime |
| birthday | happyBirthday | dateTime | asc | startTime/toTime |
| remind-appointment | reminder | dateTime | asc | startTime/toTime |
| periodic | recurring | scheduleStartTime | desc | scheduleStartTime/scheduleToTime |
| special | special | scheduleStartTime | desc | scheduleStartTime/scheduleToTime |

Params chung: `branchId=&type=&isDeleted=false&overview=false&hydrate=compact&sortBy=&sortDirection=&...&page=1&take=20`.

## Counter filters (5 nút)

Click → refetch **list** với `&status=` (stats KHÔNG refetch, URL không đổi):

| Nút | Param |
|---|---|
| Tổng khách | (không status — mặc định, pressed) |
| Thành công | `status=success` |
| Thất bại | `status=fail` |
| Chưa CS | `status=new` |
| Đã gửi Zalo | UNKNOWN_REFERENCE_BEHAVIOR — click chỉ đổi pressed, không thấy refetch/param (0 record lúc quan sát) |

## Toolbar filters

| Control | Param | Refetch |
|---|---|---|
| Tìm kiếm | `q=<urlencoded>` (debounce) | list |
| Bác sĩ điều trị | `staffId=<id>` | list + stats |
| Nhân viên CSKH | `careStaffId=<id>` | list + stats |

Dropdown staff: `GET /staff/list?page=1&perPage=20&status=active&isResigned=false&branchId=&isDoctor=true`; options = tên (không có "Tất cả"), chọn xong hiện nút "Xóa lựa chọn"; có searchbox trong listbox.

## Ma trận toolbar per-tab

| Tab | Xuất Excel | Tìm kiếm | Bác sĩ | NV CSKH | Tạo mới |
|---|---|---|---|---|---|
| Sau điều trị | ✓ | ✓ | ✓ | — | — |
| Sinh nhật | ✓ | ✓ | — | — | — |
| Nhắc lịch hẹn | ✓ | ✓ | ✓ | ✓ | — |
| Định kì | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đặc biệt | ✓ | ✓ | ✓ | ✓ | ✓ |

## Ma trận cột bảng per-tab

Common: cột KH = link `[MÃ] - TÊN` → `/patient/{id}?branchId=` + dòng phụ "Giới tính - dd/MM/yyyy"; Ghi chú = textbox inline "Nhập ghi chú"; footer "Hiển thị X–Y trên Z khách".

| Tab | Cột |
|---|---|
| Sau điều trị (8) | Ngày chăm sóc, Họ và tên, Số điện thoại, Bác sĩ điều trị, Lịch hẹn sắp tới, Trạng thái, Ghi chú, Thao tác |
| Sinh nhật (5) | Họ và tên, Số điện thoại, Trạng thái, Ghi chú, Thao tác |
| Nhắc lịch hẹn (10) | Lịch hẹn, Họ và tên, Số điện thoại, Bác sĩ điều trị, Nhân viên chăm sóc, Nội dung hẹn, Trạng thái lịch hẹn, Trạng thái CSKH, Ghi chú, Thao tác |
| Định kì (9) | Lịch hẹn chăm sóc, Họ và tên, Số điện thoại, Bác sĩ điều trị, Nhân viên chăm sóc, Lịch hẹn sắp tới, Trạng thái, Ghi chú, Thao tác |
| Đặc biệt (9) | (giống Định kì) |

Giá trị quan sát: Trạng thái CSKH "Chưa chăm sóc"/"Thành công"/"Thất bại"; Trạng thái lịch hẹn vd "Trễ hẹn", "Đã khám"; Lịch hẹn sắp tới "Chưa có lịch" khi trống.

Badge Trạng thái CSKH là span TĨNH (không click được): `<span class="inline-flex rounded-full px-3 py-1 text-[12px] font-medium bg-[#EEF2F7] text-[#5A6B82]">Chưa chăm sóc</span>` — đổi trạng thái CHỈ qua dialog file-heart.

## Nút thao tác per-row

Class chung: `flex size-7 items-center justify-center rounded-full text-[#HEX] transition hover:bg-[#HEX]/10`, icon lucide `size-4`.

| Icon (lucide) | Màu | Hành vi |
|---|---|---|
| phone | #2BB673 | `POST /call-sessions/make-a-call` (staging trả 400) |
| message-square-text | #F5A400 | Dialog "Lưu tin nhắn" |
| send | #0068FF | Tab Nhắc lịch hẹn + Chúc mừng sinh nhật (user xác nhận trên staging 2026-08-27, screenshot dialog giống hệt reminder). Dialog "Gửi ZBS qua Zalo" (xem bên dưới) — mở dialog KHÔNG gửi gì |
| file-heart | #2671D8 | reminder/birthday → dialog kết quả chăm sóc (title = tên loại CSKH, vd "Nhắc lịch hẹn"); tab group → dialog "Tạo công việc mới" (type=base) |

Per tab: after-treatment 2 nút (phone/message — **KHÔNG có file-heart**, user xác nhận trên staging 2026-08-27, thay thế ghi nhận cũ 2026-08-26 "file-heart trên row success"), birthday 4 (thêm send + file-heart — send do user xác nhận 2026-08-27, thay thế ghi nhận cũ "send chỉ reminder"), reminder 4 (thêm send + file-heart), periodic/special 2 (phone/message).

## Dialog "Lưu tin nhắn" (message-square-text)

- Data: `GET /sender-sms-templates?perPage=50&page=1&search=`, `GET /clinic-configure?perPage=50&page=1&search=&module=sms&isEnabled=true`
- Layout (verify lại từ screenshot user 2026-08-27):
  - Thanh info nền xanh nhạt: "Họ và tên: **[MÃ] - TÊN**" (phần mã-tên màu xanh, đậm)
  - Hàng 2 select cạnh nhau, label nổi trên viền + cùng text làm placeholder bên trong, KHÔNG icon kính lúp ở trigger:
    - **Cấu hình** — chi nhánh test rỗng → dropdown searchbox + "Không tìm thấy dữ liệu"
    - **Mẫu tin nhắn** — dropdown searchbox + option duy nhất "Tin nhắn tự do"
  - Textarea placeholder "Ghi chú CSKH" (luôn hiển thị, ~5 dòng, resize được)
  - Footer: 1 nút **"Gửi"** (icon save, primary, phải)
- Chọn 1 option ở "Mẫu tin nhắn" → xuất hiện thêm textarea **"Nội dung tin nhắn gửi đi"**
  phía trên "Ghi chú CSKH" (screenshot user 2026-08-27): mẫu thật prefill content của
  mẫu, "Tin nhắn tự do" để trống. "Cấu hình" là bắt buộc khi Gửi.
- Endpoint gửi thật: UNKNOWN_REFERENCE_BEHAVIOR (không quan sát được) — local giữ UI-only
- Screenshot: cskh-dialog-luu-tin-nhan.png, cskh-dialog-luu-tin-nhan-tu-do.png
- **Local đã tích hợp data (2026-08-27)**: BE `MessagingController` mirror 2 route
  `GET /api/v1/app/sender-sms-templates` (nguồn: catalog `Tools.MessageTemplate`,
  lọc `Channel=Sms && IsActive`, theo chi nhánh) và `GET /api/v1/app/clinic-configure`
  (entity mới `Notifications.ClinicConfigure`, bảng `bd_clinic_configures`, seed demo
  2 dòng module=sms). Option "Tin nhắn tự do" là default client-side (không phải record).
  **TODO khi có cấu hình gửi thật: quay lại implement request submit** — hiện Gửi chỉ
  validate Cấu hình bắt buộc rồi toast "Chức năng gửi tin nhắn chưa được hỗ trợ".

## Dialog "Gửi ZBS qua Zalo" (send — tab Nhắc lịch hẹn + Chúc mừng sinh nhật)

- "Khách hàng: <tên>"; combobox **"Mẫu ZBS\*"**; text hướng dẫn "Nội dung tin nhắn được điền tự động từ dữ liệu khách hàng — chỉ cần chọn mẫu."; nút "Gửi"
- Templates: `GET /zalo-oa-templates?branchId=&perPage=100` — chi nhánh test trả **400** (chưa cấu hình Zalo OA) → combobox rỗng
- "Gửi" khi chưa chọn mẫu = validation client, KHÔNG bắn request. Endpoint gửi thật: UNKNOWN (không thể quan sát trên chi nhánh này)

## Dialog kết quả chăm sóc (file-heart — các tab care trừ after-treatment)

- Title = tên loại CSKH (vd "Nhắc lịch hẹn"); "Họ và tên: **[MÃ] - TÊN**" là thanh nền xanh nhạt giống dialog Lưu tin nhắn (mã-tên màu xanh đậm — screenshot user 2026-08-27)
- 2 nút `role="checkbox"`: **"Thành công"** / **"Thất bại"** (chọn 1) — ô vuông trống + label bên phải, xếp **dọc** (không phải nút pill); textarea label nổi trên viền "Ghi chú lần chăm sóc" ~5 dòng, resize được (prefill ghi chú của row); nút "Lưu" (icon save, primary, phải)
- Lưu → `PUT /customer-care/{id}` body FULL object (capture, network-blocked):
  `{"patientId","staffId","dateTime","subject","type","note","scheduleStartTime","scheduleToTime","status":"success|fail","stageIds":[],"careStaffId":null}` — PUT có `stageIds`, KHÔNG có `branchId`
- Ghi chú inline trên bảng (blur) cũng bắn đúng PUT này, giữ nguyên `status` hiện tại

## Dialog "Thông tin tổng quan" (file-heart)

- Header: `[MÃ - TÊN]`, "Giới tính: ... / Ngày sinh: dd/MM/yyyy (n tuổi)", "Trạng thái: ...", nút "Gọi" + "Chi tiết"
- Bảng "Lịch sử điều trị" 11 cột: (expand), Số phiếu (link → `/patient/{id}/treatment-plan/{planId}`), Nhân sự tư vấn, Bác sĩ tiếp nhận, Trạng thái - Tiến độ, Ngày tạo, Tổng phiếu, Giảm giá, Thành tiền, Đã trả, Còn lại; pagination 5/10/20/25/50/100
- Data: `GET /patient-treatments?patientId=&page=1&take=20&sortBy=createdAt&sortDirection=desc`, `GET /customer-care?patientId=&type=base,recurring,special&page=1&take=100`, `GET /patient-stages?patientId=&stageIds=&page=1&take=1`

## Dialog "Tạo công việc mới" (Tạo mới — periodic & special, giống hệt nhau)

- Ngày chăm sóc (mặc định hôm nay) + Giờ chăm sóc (HH:mm, mặc định now)
- Quick buttons: "+3 tháng" / "+6 tháng" / "+9 tháng"
- Combobox "Chọn khách hàng*" (searchbox; option "Tên (Mã)"; data `GET /patients?page=1&perPage=20&branchId=`)
- Combobox "Bác sĩ tiếp nhận"
- Textbox "Ghi chú lần chăm sóc"
- "+3 tháng"/"+6/+9 tháng": set Ngày chăm sóc = hôm nay + N tháng (verify: 26/08 → 26/11)
- Nút "Lưu" → `POST /customer-care` (capture, network-blocked):
  `{"patientId","staffId":null,"careStaffId":null,"dateTime","scheduleStartTime","scheduleToTime"` (cả 3 = ngày+giờ đã chọn UTC), `"subject":"Customer Care - special"` (auto theo type), `"type":"special|recurring","note","status":"new","branchId"}` — POST có `branchId`, KHÔNG có `stageIds`

## Dialog "Tạo công việc mới" (file-heart — tab group)

Khác hẳn dialog Tạo mới ở trên. Fields:

- "Ngày" (date, mặc định hôm nay)
- "Tiêu đề\*" (text, bắt buộc)
- "Ghi chú lần chăm sóc" (textarea)
- **"Nhãn màu"**: 4 nút radio tròn — Tốt / Khá / Bình thường / Khiếu nại (chọn = chấm tròn đầy màu bên trong)
- Nút "Lưu" → `POST /customer-care` (capture, network-blocked):
  `{"patientId","staffId":null,"dateTime":"<ngày chọn, giờ=now>","subject":"<Tiêu đề>","type":"base","note","scheduleStartTime":"=dateTime","scheduleToTime":"=dateTime+1h","status":"success","colorCode":"<màu>","branchId","careStaffId":null}`

Mapping Nhãn màu → `colorCode` (đã capture green/orange/red; blue suy từ pattern + màu hiển thị):

| Nhãn | colorCode | Màu hiển thị |
|---|---|---|
| Tốt | `green` | #2BB673 |
| Khá | `blue` (inferred) | #2671D8 |
| Bình thường | `orange` | #F5A400 |
| Khiếu nại | `red` | #E5484D |

## Xuất Excel

`GET /api/v1/customer-care/export?branchId=&type=&isDeleted=false&overview=false&sortBy=&sortDirection=&<dateParams>` (= params list trừ page/take/hydrate) → tải file xlsx.

Tên file per-tab (đã tải và xác nhận từ staging 2026-08-27): `cskh-sau-dieu-tri.xlsx`, `cskh-sinh-nhat.xlsx`, `cskh-nhac-lich-hen.xlsx`, `cskh-dinh-ky.xlsx`, `cskh-dac-biet.xlsx`. File tải về nằm ở `reference-private/survey/staging/`.

Cấu trúc file (1 sheet tên **"Chăm sóc khách hàng"**, KHÔNG style — font mặc định Calibri 11, không bold header, không border/fill; mọi giá trị là string, ngày `dd/MM/yyyy` hoặc `dd/MM/yyyy HH:mm`):

- Tab sau điều trị (13 cột, width 20/14/24/12/16/16/20/28/30/16/20/16/36): Ngày chăm sóc, Mã KH, Họ và tên, Giới tính, Ngày sinh, Số điện thoại, Bác sĩ điều trị, **Dịch vụ**, **Phản hồi khách hàng**, **Trạng thái đánh giá**, Lịch hẹn sắp tới, Trạng thái, Ghi chú
  - Dịch vụ = tên dịch vụ của các công đoạn điều trị gắn với bản ghi chăm sóc; nhiều dịch vụ nối bằng xuống dòng trong 1 cell.
  - Phản hồi khách hàng = text kết quả chăm sóc (resolution); rỗng khi chưa chăm sóc.
  - Trạng thái đánh giá = nhãn đánh giá `Tốt / Khá / Bình thường / Khiếu nại`; cell rỗng (absent) khi chưa đánh giá.
- Tab sinh nhật (7 cột, width 14/24/12/16/16/16/36): Mã KH, Họ và tên, Giới tính, Ngày sinh, Số điện thoại, Trạng thái, Ghi chú
- Tab nhắc lịch hẹn (12 cột): Lịch hẹn, Mã KH, Họ và tên, Giới tính, Ngày sinh, Số điện thoại, Bác sĩ điều trị, Nhân viên chăm sóc, Nội dung hẹn, Trạng thái lịch hẹn, Trạng thái CSKH, Ghi chú
- Tab định kì / đặc biệt (11 cột, width 20/14/24/12/16/16/20/20/20/16/36): Lịch hẹn chăm sóc, Mã KH, Họ và tên, Giới tính, Ngày sinh, Số điện thoại, Bác sĩ điều trị, Nhân viên chăm sóc, Lịch hẹn sắp tới, Trạng thái, Ghi chú

→ Cột Excel = cột bảng UI + chèn thêm "Mã KH", "Giới tính", "Ngày sinh" sau/quanh cột tên.

Ghi chú divergence local: local đặt tên file `cskh-<tab>-{yyyyMMdd-HHmm}.xlsx` (thêm timestamp — chủ đích, e2e đã theo).

---

# TAB 2 — Phân nhóm CSKH (`tab=group`)

## Layout

```
[Nhóm dịch vụ ▼] [Thẻ tag ▼] [Ngày sinh nhật 📅]        [Tìm kiếm] [Bác sĩ điều trị ▼]
TABLE 12 cột
Hiển thị 1–20 trên 48 bệnh nhân   [Trước][1][2][3][Sau]   ← phân trang SỐ, không có per-page select
```

Không có: date mode, counters, Xuất Excel, Tạo mới.

Filter fields dùng **floating label** như các dialog (label nghỉ trong field như
placeholder, nổi lên viền khi focus/có giá trị — user chụp ref 2026-08-27 thấy
"Thẻ tag" nổi trên viền khi mở); trigger select KHÔNG có kính lúp (giống dialog).
Local áp cho cả toolbar tab care lẫn tab group (MessageField).

## API

List: `GET /api/v1/patients?page=1&perPage=20&branchId=<id>&excludeTreatmentNone=true` + filter:

| Control | Param | Ghi chú |
|---|---|---|
| Nhóm dịch vụ | `taxonomyId=<id>` | cũng sync lên URL; options từ `GET /taxonomy/?group=care_service&branchId=&perPage=100` (searchbox + "Xóa lựa chọn") |
| Thẻ tag | UNKNOWN_REFERENCE_BEHAVIOR (param) | options từ `GET /medical-record/tag/list?branchId=&page=1&perPage=20&orderBy=order`; **mỗi option render thành chip màu của tag** (icon tag nhỏ + tên, chữ trắng trên nền màu tag — user chụp màn hình ref 2026-08-27, chi nhánh có tag); param khi chọn vẫn chưa quan sát được; hiển thị chip khi ĐÃ chọn (trong trigger) là suy luận, chưa quan sát trực tiếp |
| Ngày sinh nhật | `birthdayDate=yyyy-MM-dd` | calendar popover 1 ngày (Th 2→CN); textbox hiển thị dd/MM/yyyy; xóa text = bỏ filter |
| Tìm kiếm | `q=` | debounce |
| Bác sĩ điều trị | `staffId=<id>` | dropdown staff giống tab care |

## Bảng (12 cột)

| # | Cột | Field nguồn (response item) |
|---|---|---|
| 1 | Ngày tạo hồ sơ | `createdAt` (dd/MM/yyyy) |
| 2 | Họ và tên | link `[code] - name` → `/patient/{id}?branchId=` + "Ngày sinh: dd/MM/yyyy" (`dateOfBirth`, "—" nếu null) |
| 3 | Số điện thoại | `phone` |
| 4 | Trạng thái | `treatmentStatus`: `created`=Chưa phát sinh, `in-progress`=Đang điều trị, `done`=Hoàn tất |
| 5 | Dịch vụ | `serviceNames[]` |
| 6 | Bác sĩ | `staffNames[]` |
| 7 | Số tiền | `totalAmount` (format 1.000.000) |
| 8 | Thực thu | `totalRevenue` |
| 9 | Công nợ | `totalDebt` |
| 10 | Lịch hẹn gần nhất | `schedule.nextAppointmentDate` (dd/MM/yyyy HH:mm, "—" nếu null) |
| 11 | Lần khám cuối | `lastTreatmentDate ?? createdAt` (dd/MM/yyyy HH:mm) |
| 12 | Thao tác | 3 nút: phone #2BB673, message-square-text #F5A400, file-heart #2671D8 (giống tab care) |

## Response item shape (patients — sanitized)

```json
{
  "id": "<objectId>", "name": "<string>", "code": "<string>", "phone": "<string>",
  "hasZalo": null, "dateOfBirth": "<iso|null>", "branchId": "<objectId>", "branchName": "<string>",
  "treatmentStatus": "created|in-progress|done", "staffIds": [],
  "totalDebt": 0, "totalRevenue": 0, "totalAmount": 0,
  "serviceNames": ["<string>"], "staffNames": ["<string>"],
  "schedule": { "nextAppointmentDate": "<iso|null>", "currentAppointmentDate": "<iso|null>", "currentTreatmentDate": "<iso|null>" },
  "lastAppointmentDate": "<iso|null>", "lastTreatmentDate": "<iso|null>", "createdAt": "<iso>"
}
```

Response envelope: `{ statusCode, message, metadata: { ...requestInfo, totalPage, count, page, perPage, nextPage, hasNext, hasPrevious, type }, data: [...] }`.

---

## Mutation trials (2026-08-26, network-blocked — user approved)

Mọi mutation dưới đây được thử với patch chặn fetch/XHR client-side (POST/PUT/PATCH/DELETE tới api.staging KHÔNG bao giờ tới server; reload xác nhận không có gì persist):

| Trial | Request capture |
|---|---|
| Ghi chú inline (blur) | `PUT /customer-care/{id}` full object, giữ status |
| Dialog kết quả chăm sóc → Lưu | `PUT /customer-care/{id}` với `status:"success"|"fail"` |
| Tạo mới (periodic/special) → Lưu | `POST /customer-care` type=special, status=new |
| File-heart tab group → Lưu | `POST /customer-care` type=base, status=success, colorCode |
| Gửi ZBS (chưa chọn mẫu) → Gửi | Validation client, không có request |
| Lưu tin nhắn → Gửi | Validation chặn (thiếu Cấu hình — chi nhánh không có data) |

## UNKNOWN_REFERENCE_BEHAVIOR (còn lại)

| # | Control | Reason | Action taken |
|---|---|---|---|
| 1 | Endpoint gửi ZBS thật (sau khi chọn mẫu) | Chi nhánh test không có Zalo OA config → `GET /zalo-oa-templates` 400, không có mẫu để chọn | Dialog đã quan sát; endpoint gửi UNKNOWN |
| 2 | Counter "Đã gửi Zalo" | Click không refetch/đổi param; 0 record lúc quan sát | NONE |
| 3 | Thẻ tag filter param | Chi nhánh test không có tag nào để chọn | NONE |
| 4 | Submit "Lưu tin nhắn" (request cuối) | Combobox "Cấu hình" rỗng trên chi nhánh test → validation chặn submit | Dialog + data endpoints đã quan sát; request submit UNKNOWN |
| 5 | `colorCode` của nhãn "Khá" | Chỉ capture được green/orange/red (mỗi lượt thử phải reload); "blue" là suy luận từ pattern + màu #2671D8 | Inferred `blue` |

---

## Visual parity (2026-08-27, 1600×900, production build)

So sánh LOCAL (`vite preview` :8080) với STAGING từng tab, ảnh trong
`reference-private/survey/staging/parity-2026-08-27/` (`staging-cskh-*.png` vs `local-cskh-*.png`).

Đã khớp sau các fix:

- Counter chips nằm cùng hàng, bên phải segmented control Ngày/Tuần/Tháng.
- Segmented control (`.cskh-seg`) cho date mode + 5 care-type tab, item active nền `#2671d8`.
- Toolbar (Xuất Excel · Tìm kiếm · Bác sĩ · NV CSKH · Tạo mới) phải-hàng-tab; Xuất Excel chữ/viền xanh.
- Header bảng sentence-case 13.5px (override rule uppercase toàn app, scoped `.cskh-table`).
- Tab hẹp (Sau điều trị 8 cột, Sinh nhật 5 cột) bỏ `scroll` → không có thanh cuộn ngang;
  tab rộng (Nhắc lịch 10, Định kì/Đặc biệt 9, Phân nhóm 12 cột) giữ `scroll x:max-content`
  + cột **Thao tác `fixed: right`** (staging ghim cột này).
- Pagination: `20 / trang` + "Hiển thị X–Y trên Z khách" sát nhau bên trái
  (phải zero cả `margin-inline-end` của `.ant-pagination-options` — AntD mặc định auto cả 2 phía),
  nút `‹ Trước / 1 / Sau ›` bên phải. Bảng rỗng vẫn hiện bar
  ("Hiển thị 0 trên 0 khách", ẩn số trang) → CareBoard render `<Pagination>` standalone
  (`.cskh-pagination`) vì AntD Table ẩn pagination khi total=0.
- Badge Trạng thái tab Phân nhóm: Đang điều trị tint xanh `#2671d8`, Hoàn tất tint `#2bb673`,
  Chưa phát sinh xám (hex tint là suy luận từ palette đã capture — staging không đo computed style).

Khác biệt chủ đích (house chrome, không phải lỗi parity):

- Sidebar tối navy + PageHeader "Chăm sóc khách hàng" + cặp pill-tab
  Chăm sóc khách hàng / Phân nhóm CSKH theo chrome BlueDental, không copy chrome NFC
  (sidebar xanh sáng, tab underline). Sidebar local rộng hơn nên vùng bảng hẹp hơn staging ~120px.

E2E: 8/8 `e2e/cskh.spec.ts` xanh trên production build (2026-08-27).
