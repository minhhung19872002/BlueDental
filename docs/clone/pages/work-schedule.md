# Lịch làm việc — bảng đăng ký ca (F-90, BA P0911)

Route: `/calendar?tab=timekeeping`, tab "Lịch làm việc" của màn Lịch hẹn.

Nguồn: BA, không quan sát từ bản gốc.

- Sơ đồ luồng `P0911.drawio`.
- Prototype HTML "Lịch làm việc (prototype)".
- Đoạn chat BA chủ dự án gửi ngày 2026-11-10.

Màn này **thay hẳn** bảng chấm công cũ (F-03). Phần chấm công (vào ca, ra ca, ON/OFF, KPI, Đăng ký nghỉ, ô X) được comment lại, không xoá.

## Bố cục (theo prototype)

1. Hàng công cụ:
   - Nút chuyển "Theo team" / "Từng bác sĩ / nhân viên".
   - Chọn tháng: ‹ Tháng M / YYYY ›, nút "Hôm nay".
   - Ô tìm nhân viên hoặc vai trò (bỏ dấu).
   - Chọn "Tất cả team" hoặc một team.
2. Thanh "Chọn loại ca":
   - Ba cọ vẽ S Ca sáng, C Ca chiều, SC Cả ngày. Mặc định là Cả ngày.
   - Ô chú thích "Đã chọn – chờ lưu".
   - Bên phải: huy hiệu "n ca chờ lưu", nút "Đặt lại", nút "Lưu lịch".
3. Lưới tháng (chế độ Theo team):
   - Cột trái là "Nhân viên theo team". Mỗi team có một hàng tiêu đề gập/mở, ghi "n người · x công".
   - Mỗi người có avatar chữ tắt, tên, và dòng "vai trò · x công" (không có vai trò thì chỉ "x công").
   - Mỗi ngày trong tháng là một cột.
   - Cột T7/CN tô hồng, hôm nay tô tím.
   - Ngày đã qua và hôm nay mờ đi, bị khoá.
4. Chế độ "Từng bác sĩ / nhân viên": danh sách người bên trái, bên phải là lịch tháng của người đang chọn. Bấm tên ở chế độ team cũng mở chế độ này.
5. Hộp xác nhận "Lưu n thay đổi lịch làm việc?":
   - Ba chip: đăng ký mới, đổi ca, huỷ ca.
   - Thay đổi gom theo người, mỗi dòng ghi ngày, nhãn Mới/Đổi/Huỷ và ca.
   - Hai nút "Xem lại" và "Xác nhận lưu".
   - Vẽ theo khung của prototype, không dùng khung `AppDialog` của Danh mục: ô icon tím bên trái tiêu đề, không có nút X, không có đường kẻ dưới header hay trên footer. Danh sách nằm trong khung viền bo 12px, hàng tên người nền xám nhạt. Chủ dự án yêu cầu 2026-11-10. Biến màu `--ws-*` khai báo cho cả `.ws-confirm-modal`, vì modal được portal ra ngoài `.ws-board`.

Công: S = 0,5, C = 0,5, SC = 1.

## Quy tắc (chủ dự án chốt 2026-11-10)

| # | Quy tắc |
|---|---|
| 1 | Làm theo UI và logic mới hoàn toàn. Chấm công bị comment lại. |
| 2 | Ngày "Chưa đăng ký" giữ như cũ: vẫn đặt lịch hẹn được theo giờ làm trong hồ sơ nhân viên. Đăng ký S thì chỉ ca sáng nhận lịch, C thì chỉ ca chiều (`DentistShiftChecker`). |
| 3 | Hôm nay và các ngày đã qua bị khoá, kể cả với admin (`Timekeeping:0018`, từ chối cả lô). Từ ngày mai trở đi sửa được. |
| 3b | Chỉ ghi log khi **sửa hoặc huỷ** một ca **đã lưu** của **ngày mai**. Đăng ký mới không ghi log. Log áp dụng cho mọi người, chỉ lưu DB (`bd_work_schedule_change_logs`), không có màn xem. |
| 4 | Bỏ qua trường hợp team lồng team. |
| 5 | Phạm vi nhìn: thành viên Phòng ban thấy cả phòng ban. Người chưa vào đơn vị nào nằm trong nhóm "Chưa phân nhóm", chỉ admin, trưởng gốc (Giám đốc) và chính người đó thấy. Admin thấy và sửa tất cả. |
| 6 | Quyền "Điểm danh NV khác" đổi tên thành "Quản lý lịch làm việc". |

Phạm vi theo sơ đồ tổ chức (`OrgChartScope.WorkScheduleReachOf`):

- Admin hoặc trưởng đơn vị gốc: thấy và quản lý mọi người.
- Trưởng Phòng ban hoặc Team: thấy và quản lý mọi thành viên và trưởng cấp dưới trong cây con của mình.
- Thành viên Phòng ban: thấy cả phòng ban, trưởng phòng cũng thấy, nhưng chỉ sửa được lịch của mình.
- Thành viên Team, thành viên trực thuộc gốc, hoặc người chưa vào đơn vị nào: chỉ thấy chính mình.

Sửa lịch của người khác cần thêm quyền "Quản lý lịch làm việc". Phạm vi chỉ quyết định với tới những ai.

## API

```
GET  /api/v1/app/work-schedules?year&month
  → { year, month, today, groups[{ unitId, name, kind, headStaffId,
       members[{ staffId, fullName, roleLabel, isDentist, isHead, avatarUrl,
                 canEdit, days[{ workDate, shift }] }] }] }
POST /api/v1/app/work-schedules/save   { items[{ staffId, workDate, shift }] }
  → { saved, logged }
```

`shift` có các giá trị: 0 Chưa đăng ký, 1 S, 2 C, 3 SC.

Lỗi (đều trả HTTP 403):

- `Timekeeping:0018`: ngày đã khoá.
- `Timekeeping:0019`: không có quyền sửa người này.
- `Timekeeping:0016`: nhân viên không thuộc chi nhánh.

## Ảnh hưởng tới chọn bác sĩ và đặt lịch (đã kiểm tra 2026-11-10)

- Dropdown bác sĩ trong các form đặt lịch (`AvailableOn`, `StaffAppService.GetDayOffStaffIdsAsync`) chỉ loại người có bản ghi **DayOff** ngày đó. Code này không đổi. Board mới không bao giờ ghi DayOff, nên bác sĩ đăng ký S, C, SC hay chưa đăng ký đều vẫn hiện trong dropdown.
- Giờ được đặt (`DentistShiftChecker.WorkingWindows`, dùng cho lúc lưu lịch hẹn và cho `dentist-work-days` của "Chọn lịch hẹn tiếp theo"):
  - S chỉ nhận ca sáng.
  - C chỉ nhận ca chiều.
  - SC, chưa đăng ký hoặc đã huỷ ca thì nhận cả hai ca theo giờ trong hồ sơ.
- Đã đo trên stack thật: một bác sĩ, ngày +2, lần lượt lưu 0/1/2/3/0. Bác sĩ luôn có trong dropdown. Giờ đặt được lần lượt là `08:00-12:00 + 13:30-17:30`, `08:00-12:00`, `13:30-17:30`, cả hai ca, cả hai ca.
- Đăng ký ca trên board cho một ngày có DayOff cũ sẽ xoá DayOff đó (`ScheduleShift` đặt Registration = Working), và bác sĩ hiện lại trong dropdown.
- Dropdown không lọc theo nửa ngày. Chọn bác sĩ chỉ đăng ký S rồi đặt giờ chiều thì BE từ chối khi lưu (`Appointment:0008`, có kèm giờ làm).

## Đã lệch hoặc còn mở

- Bảng lương (F-57) đếm ngày công theo lần vào ca. Từ nay không ai vào ca nữa, nên số ngày công sẽ về 0 cho đến khi BA chốt cách tính mới. Vì vậy tab Bảng lương đang ẩn (R-1188); route `/staff/payroll` vẫn còn.
- Bản ghi nghỉ (DayOff) cũ vẫn chặn đặt lịch hẹn, nhưng trên bảng mới hiện là "Chưa đăng ký". Chủ dự án chấp nhận giữ nguyên (2026-11-10).
- Bước đánh dấu "nghỉ ngang" cuối ngày (`TimekeepingEndOfDayWorker`) bị comment lại, vì không còn ai chấm công. Chủ dự án chấp nhận (2026-11-10).
