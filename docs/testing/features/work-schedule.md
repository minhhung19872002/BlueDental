# F-90 — Lịch làm việc (bảng đăng ký ca, BA P0911)

Status: `VERIFIED` · Verified commit: working tree on `main` after `05b4456f` (not committed yet)

Thiết kế và quy tắc: `docs/clone/pages/work-schedule.md`. Màn này thay bảng chấm công F-03.

## Thay đổi

- **BE**:
  - Enum `WorkScheduleShift`.
  - Trường ca đăng ký trên `TimeKeepingRecord`.
  - Entity `WorkScheduleChangeLog` và migration `20261110013921_WorkScheduleBoardF90`.
  - `WorkScheduleAppService` và `WorkScheduleController`.
  - `OrgChartScope.WorkScheduleReachOf` và `OrgChartScopeResolver.WorkScheduleReachAsync`.
  - `DentistShiftChecker`: đăng ký S/C thì chỉ mở ca đó.
  - Bước no-show cuối ngày trong `TimekeepingEndOfDayWorker` bị comment lại.
  - Mã lỗi `Timekeeping:0018/0019`.
  - Nhãn quyền đổi thành "Quản lý lịch làm việc".
- **FE**: `features/timekeeping/`, gồm:
  - `api/workSchedule*`
  - `hooks/useScheduleDraft`, `useScheduleFilters`, `useSchedulePaint`
  - `components/work-schedule/*` và `work-schedule.css`
  - `utils/workSchedule*`

  `AppointmentCalendarPage` hiển thị `<WorkScheduleBoard>` ở tab Lịch làm việc.

## Kiểm thử

Chạy trên stack riêng: host build vào scratchpad, cổng :5190, không đụng :5000; `vite preview` :8095, build bằng config dự án. Đăng nhập thật, PostgreSQL thật, không chặn request.

`e2e/work-schedule-board.spec.ts`: **4/4**.

1. Ai thấy ai: trưởng Phòng ban, thành viên, đồng nghiệp, người "Chưa phân nhóm", admin. Kiểm `canEdit` của từng cặp.
2. Lưu từ ngày mai:
   - `{saved, logged}` đúng.
   - Đọc lại bằng request riêng.
   - Đổi 3→2 rồi huỷ 2→0 ở ngày mai sinh đúng 2 dòng log (đã đọc thẳng DB).
   - Hôm nay và hôm qua trả `0018`, admin cũng vậy.
   - Thành viên sửa đồng nghiệp trả `0019`.
3. Cách ly chi nhánh: chi nhánh khác không liệt kê được và không ghi được (`0016`).
4. Giao diện:
   - Cọ "Ca sáng" → ô hiện "S", trạng thái chờ lưu → Lưu lịch → Xác nhận lưu → toast → reload vẫn còn.
   - Bấm ô bị khoá → toast "Không thể đăng ký cho ngày đã qua.".
   - Thành viên bấm ô của trưởng phòng: ô có `aria-disabled` → toast không có quyền.

Spec cũ:

- `timekeeping-api`, `reception-follow-up-shifts`, phần API của `timekeeping-leave` và `work-schedule-own-dayoff`, test "tab nằm trong URL" của `timekeeping`: **13 xanh**.
- 7 test giao diện bảng cũ chuyển sang `test.skip`, có ghi chú F-90 để bật lại cùng chấm công:
  - `timekeeping` ×4
  - `timekeeping-leave` ×2
  - `work-schedule-own-dayoff` ×1

Khác:

- Domain tests (`DentistShiftChecker`, `TimeKeepingRecord`, `WorkScheduleReach`): 97/97.
- `tsc -b` sạch. eslint sạch trên `features/timekeeping`, `AppointmentCalendarPage` và spec mới.
- Ảnh chụp đã đối chiếu với prototype: chế độ team, ô chờ lưu, hộp xác nhận, chế độ từng người.

Lỗi do e2e phát hiện và đã sửa trước khi bàn giao: `workScheduleApi.ts` dùng `/api/v1/...` trong khi axios đã có baseURL `/api`, nên request thành `/api/api/v1` và trả 404.

## Mức retest

Mức 3, vì đụng phạm vi sơ đồ tổ chức, `DentistShiftChecker` (mọi picker đặt lịch) và worker cuối ngày.

Đã chạy lại:

- `reception-follow-up-shifts`
- `timekeeping*`
- `work-schedule-own-dayoff`

Chưa chạy: toàn bộ `appointment*` / `reception*`.

## R-1189 — bỏ lọc bác sĩ nghỉ và bỏ chặn giờ làm (2026-11-10, TEMP-DAYOFF-FILTER-OFF)

- BE: `StaffAppService` bỏ qua `AvailableOn`; `DentistShiftChecker.EnsureWithinShiftAsync` không chặn; `WorkingWindows` không trừ DayOff / ca S-C / phép; `AppointmentSeriesPlanner` bỏ `DentistOff` / `OutsideShift`. FE không đổi.
- `e2e/doctor-day-off-ignored.spec.ts` **2/2** trên stack riêng :5190/:8095, không chặn request: bác sĩ DayOff và bác sĩ chỉ đăng ký S vẫn trong `/staff?AvailableOn`, đặt được 09:00 / 20:00 ngày nghỉ và 15:00 cho ca S, đọc lại đúng giờ; dialog Tạo lịch hẹn chọn được bác sĩ nghỉ.
- 15 test luật cũ `test.skip` có ghi chú TEMP; `appointment-day-timeline` đổi kỳ vọng cột bác sĩ nghỉ. 22 xanh, 2 đỏ có sẵn (drag-scroll R-1173, nút Thanh toán R-1099).
- Domain 1353 xanh, 3 skip.
- Mức retest 3.

## R-1192 — người đang đăng nhập lên đầu bảng (2026-11-10)

- BA: "sort cái lịch của current user lên đầu danh sách để họ book lịch cho dễ". Phạm vi xem BA chốt cùng lúc (chỉ trưởng phòng xem cả cây con) đã khớp `OrgChartScope.WorkScheduleReachOf`, không sửa.
- FE: `viewerFirst` (`features/timekeeping/utils/workScheduleOrder.ts`) đưa nhóm của người xem lên đầu, người xem lên đầu nhóm; chế độ "Từng bác sĩ / nhân viên" vì thế chọn sẵn chính họ. API không đổi.
- `e2e/work-schedule-board.spec.ts` test mới "the viewer's own row comes first": thành viên thường thấy mình trên trưởng phòng (API vẫn để trưởng đầu); một nhân viên quyền admin làm trưởng phòng ban riêng thấy nhóm mình đầu tiên dù API xếp nhóm khác trước. Cả spec **5/5** trên stack riêng :5190/:8095, đăng nhập thật, không chặn request.
- Mức retest 2 (chỉ màn Lịch làm việc).

## R-1210 — Lịch nghỉ: S/C/SC là ngày nghỉ, bật lại chặn (2026-11-11)

- Chủ dự án chốt 4 điểm:
  - Chia ở giữa trưa.
  - Đổi tên toàn bảng.
  - Giữ dữ liệu cũ, đọc lại là ngày nghỉ.
  - Picker chỉ ẩn người nghỉ cả ngày.
- BE:
  - `TimeKeepingRecord.OffShift`.
  - `DentistShiftChecker.OffConflict` / `WorkingWindows`: ngày không nghỉ mở giờ hồ sơ, không chặn ngoài giờ.
  - `StaffAppService.AvailableOn` chỉ ẩn nghỉ cả ngày.
  - Lặp lịch hẹn: nửa ngày → `OutsideShift`, cả ngày → `DentistOff`.
  - Mã mới `Appointment:0019` (nghỉ sáng) / `0020` (nghỉ chiều); bỏ `0008`.
  - vi/en đổi tên sang "Lịch nghỉ".
  - Bỏ hết `TEMP-DAYOFF-FILTER-OFF`.
- e2e:
  - Fixture mới `e2e/fixtures/lichNghi.ts` (`setDayOff` qua `work-schedules/save` thật).
  - Spec mới `e2e/doctor-lich-nghi.spec.ts` 2/2.
  - Xoá `doctor-day-off-ignored.spec.ts`.
  - Viết lại / bật lại `appointment-working-hours`, `reception-follow-up-shifts`, `doctor-day-off-pickers`, `staff-day-off-api`, `appointment-slot-pick-doctor`, `appointment-series-api`, `appointment-day-timeline`.
  - `work-schedule-board`, `timekeeping`, `routes` theo nhãn mới.
- Kết quả trên bản build production (`vite preview` :8093 + host :5000, đăng nhập thật, không chặn request):
  - 9 spec thay đổi: 37 xanh, 2 skip.
  - Chạy lại sau sửa spec: 33 xanh.
  - Còn 2 đỏ không thuộc luật này:
    - `appointment-day-timeline` drag-scroll — đã đỏ từ R-1189.
    - "today: checked-in" — chạy lúc ~22:40, ngoài giờ hiển thị của bảng.
- Domain 1377 xanh.
- Mức retest 3.

## R-1233 — giới hạn ngày nghỉ và chặn nghỉ đè lịch hẹn (2026-11-14, develop)

- **Yêu cầu BA**: "khi bs có lịch nghỉ ngày đó thì khóa hẹn nha a, ngược lại khi có lịch hẹn ngày đó rồi thì không thể đky nghỉ. Giới hạn đky nghỉ tối đa 4 ngày (trưởng nhóm có thể đky cho các thành viên, thành viên chỉ đky đc lịch của họ, admin toàn quyền k khóa tối đa 4 ngày). Admin tự set ngày nghỉ tối đa luôn thì tốt."
  - Đã có sẵn từ trước: khoá đặt lịch khi nghỉ (R-1210) và quyền trưởng nhóm / thành viên.
- **Chủ dự án chốt**:
  - Giới hạn tính theo tháng dương lịch.
  - Nghỉ sáng hoặc chiều tính 0,5 ngày.
  - Chặn nghỉ theo buổi. Lịch tạm có tính; Hủy hẹn và Không đến không tính. Admin cũng bị chặn.
  - Mức tối đa đặt theo chi nhánh, mặc định 4, admin đặt trên bảng.
- **BE**:
  - `ClinicBranch.MaxDayOffDays` + `SetMaxDayOffDays` (1..31, `Organizations:0010`). Migration `20261114030738_DayOffLimitR1233`, mặc định 4.
  - `DentistShiftChecker.OffConflict(off, morning, afternoon, start, end)`: cùng cách chia buổi với lúc đặt lịch.
  - `WorkScheduleAppService.SaveAsync` kiểm cả lô trước khi lưu:
    - `EnsureNoAppointmentsUnderAsync` (`Timekeeping:0020`) chạy với mọi người.
    - `EnsureWithinDayOffLimitAsync` (`Timekeeping:0021`) chạy với người không phải admin.
  - `SetDayOffLimitAsync` (`PUT work-schedules/day-off-limit`): chỉ admin.
  - Board trả thêm `maxDayOffDays` và `canSetDayOffLimit`.
- **FE** (`features/timekeeping`):
  - `DayOffLimitControl` trên thanh công cụ: admin có ô số + nút Lưu, người khác thấy dòng "Tối đa N ngày nghỉ/tháng".
  - "x/N ngày nghỉ" dưới tên mỗi người, đỏ khi vượt; ô tổng ở chế độ từng người cũng vậy.
  - `useSchedulePaint` chặn nét vẽ vượt mức và báo "Vượt số ngày nghỉ tối đa trong tháng…". "Áp dụng cho các ngày trống" chỉ điền đến giới hạn.
  - Admin không bị chặn ở FE.
- **Kiểm thử**: bản build production (`vite preview` :8092) + host thật :5000, đăng nhập thật, PostgreSQL thật, không chặn request.
  - Spec mới `e2e/day-off-limit.spec.ts` **4/4**:
    1. Tháng chạm đúng 4 ngày (3 SC + S + C). Nửa ngày nữa bị `0021`, dù bác sĩ hay trưởng nhóm đăng ký. Đổi chỗ trong tháng vẫn 4 thì lưu được. Tháng sau tính lại từ đầu. Admin vượt được; sau đó bác sĩ chỉ được giảm. Đọc lại bằng request riêng.
    2. Bác sĩ PUT `day-off-limit` nhận 403; 0 và 32 nhận 400. Admin đặt 5 → board đọc 5 → bác sĩ thêm được 1 ngày, thêm nửa ngày nữa bị chặn → trả về 4.
    3. Lịch hẹn 09:00: nghỉ cả ngày và nghỉ sáng bị `0020` (admin cũng vậy), nghỉ chiều lưu được, đổi chiều → cả ngày bị chặn. Lịch tạm 14:00 chặn nghỉ chiều. Huỷ lịch hẹn xong thì nghỉ cả ngày lưu được.
    4. Giao diện: bác sĩ thấy "Tối đa 4 ngày nghỉ/tháng" và "4/4 ngày nghỉ"; vẽ thêm thì bị báo lỗi, ô không đổi, nút Lưu lịch nghỉ vẫn tắt. Admin vẽ vượt được ("4,5/4" đỏ), đặt 5 bằng ô số rồi Lưu ra toast "Đã đặt tối đa 5 ngày nghỉ mỗi tháng.", board đọc 5.
  - Nhóm spec liên quan (`appointment-working-hours`, `appointment-series-api`, `doctor-day-off-pickers`, `doctor-lich-nghi`, `staff-day-off-api`, `reception-follow-up-shifts`, `appointment-day-timeline`, `appointment-slot-pick-doctor`, `work-schedule-board`, `work-schedule-own-dayoff`): 48 xanh, 1 skip, 1 đỏ có sẵn.
    - `appointment-slot-pick-doctor` đỏ vì luật mới: spec đặt lịch cho bác sĩ rồi đăng ký nghỉ cả ngày đè lên. Đã sửa: huỷ lịch hẹn đó trước khi đăng ký nghỉ (Hủy hẹn vẫn giữ hàng bác sĩ trong "Lịch đã hẹn"). Chạy lại 2/2.
    - Còn đỏ: `appointment-day-timeline` "a mouse drag scrolls the board sideways" — đã ghi đỏ sẵn từ R-1173, do thiếu cột bác sĩ để bảng tràn ngang.
  - Domain `BranchDayOffLimitTests` + `DentistShiftCheckerTests` 42/42. tsc + eslint sạch.
- **Mức retest**: 3 (luật lưu Lịch nghỉ ảnh hưởng đặt lịch và các spec dùng `setDayOff`).
