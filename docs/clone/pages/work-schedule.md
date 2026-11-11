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
| 7 | (BA 2026-11-10, R-1192) Người đang đăng nhập lên đầu danh sách "để họ book lịch cho dễ": nhóm của họ lên đầu, họ đứng đầu nhóm (trên cả trưởng phòng); ở chế độ "Từng bác sĩ / nhân viên" họ đứng đầu danh sách trái và được chọn sẵn. Chỉ FE (`utils/workScheduleOrder.ts`), API giữ thứ tự cũ. |
| 8 | (BA 2026-11-10) Dưới Phòng ban có thể là Phòng ban con hoặc Team bác sĩ. Chỉ **trưởng phòng** xem được lịch của mọi người bên dưới; nhân viên phòng ban cấp trên **không** xem được đơn vị con. Khớp phạm vi hiện tại bên dưới, không phải sửa. |

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

> **R-1210 (chủ dự án 2026-11-11): bảng là "Lịch nghỉ".** S = nghỉ sáng, C = nghỉ chiều, SC = nghỉ cả ngày; ngày không đánh dấu là đi làm, đặt được mọi giờ. Bỏ `TEMP-DAYOFF-FILTER-OFF` (R-1189). Dữ liệu cũ giữ nguyên, đọc lại là ngày nghỉ (không migration).
>
> - Dropdown bác sĩ (`AvailableOn`) chỉ ẩn người nghỉ cả ngày (SC, hoặc DayOff cũ). Nghỉ sáng / nghỉ chiều vẫn hiện, bị chặn khi lưu.
> - Lưu lịch hẹn (`DentistShiftChecker.OffConflict`), chia ở giữa trưa:
>   - Nghỉ cả ngày: chặn mọi giờ (`Appointment:0009`).
>   - Nghỉ sáng: chặn lịch bắt đầu trước giờ vào ca chiều (`Appointment:0019`, kèm giờ "từ").
>   - Nghỉ chiều: chặn lịch kết thúc sau giờ hết ca sáng, kể cả buổi tối (`Appointment:0020`, kèm giờ "trước").
>   - Ngày không nghỉ: không chặn theo giờ hồ sơ (bỏ `Appointment:0008`), chỉ còn kiểm trùng lịch.
> - Lặp lịch hẹn: nghỉ cả ngày → `DentistOff`, nghỉ nửa ngày → `OutsideShift` ("Bác sĩ đã đăng ký nghỉ buổi này").
> - "Chọn lịch hẹn tiếp theo" (`dentist-work-days`) mở giờ hồ sơ trừ buổi nghỉ.
> - Đổi tên toàn bảng: "Nghỉ sáng / Nghỉ chiều / Nghỉ cả ngày", "Chưa đăng ký nghỉ", "Lưu lịch nghỉ", "… ngày nghỉ", tab "Lịch nghỉ".
>
> Phần dưới mô tả hành vi trước R-1189, giữ làm lịch sử.

> **Tắt từ R-1189 đến R-1210** (BA 2026-11-10: "Bỏ logic đó lun e… Trc hết gỡ logic ra đã"). Chủ dự án chốt bỏ hết, ở mọi chỗ: dropdown bác sĩ hiện mọi người, lưu lịch hẹn không còn kiểm ngày nghỉ, ca S/C hay giờ làm, chỉ còn kiểm trùng lịch. Code cũ comment lại với nhãn `TEMP-DAYOFF-FILTER-OFF`. BA đang viết lại quy tắc mới ("ngày nào không đăng ký là nghỉ"), quy tắc này ngược với quyết định 2 ở trên và **chưa làm**. Phần dưới mô tả hành vi trước R-1189, giữ để khôi phục.


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
- Bản ghi nghỉ (DayOff) cũ vẫn chặn đặt lịch hẹn, nhưng trên bảng mới hiện là "Chưa đăng ký". Chủ dự án chấp nhận giữ nguyên (2026-11-10). Từ R-1189 không còn chặn nữa.
- Đã chốt R-1210 (2026-11-11): bảng là Lịch nghỉ, ngày không đánh dấu là đi làm. Quy tắc "ngày nào không đăng ký là nghỉ" bị bỏ.
- Bước đánh dấu "nghỉ ngang" cuối ngày (`TimekeepingEndOfDayWorker`) bị comment lại, vì không còn ai chấm công. Chủ dự án chấp nhận (2026-11-10).
