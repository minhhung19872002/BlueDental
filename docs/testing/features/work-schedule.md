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
