# F-47 — Bác sĩ nghỉ không hiện trong ô chọn bác sĩ

Yêu cầu BA 2026-10-02 (4 ảnh): nhân viên được bật **OFF** trên bảng Chấm công
(Lịch làm việc ON/OFF) không được hiện trong ô chọn bác sĩ / phụ tá của **ngày đó**.
Tính năng riêng của BlueDental — không đo trên bản gốc.

## Quyết định của chủ dự án (2026-10-02)

- Chỉ **OFF rõ ràng** (`WorkRegistration.DayOff = 2`) mới ẩn. Nhân viên chưa đăng ký
  ngày đó vẫn hiện.
- Chỉ **ẩn khỏi danh sách**, server không chặn lưu. Đổi ngày làm bác sĩ đang chọn
  thành OFF → xoá ô bác sĩ và báo lỗi tại ô: "Bác sĩ nghỉ vào ngày này, vui lòng chọn
  bác sĩ khác" (`Appointment:Form:DoctorOffOnDate`).
- Thêm phạm vi: đổi bác sĩ trên thẻ tiếp nhận, đổi bác sĩ lịch hẹn ở hồ sơ.

## Cách làm

- BE: `GET /api/v1/app/staff?AvailableOn=YYYY-MM-DD` bỏ những người có bản ghi
  Chấm công `DayOff` ngày đó **tại chi nhánh đang xem** (`BranchId` → header
  `X-Clinic-Branch-Id` → chi nhánh của tài khoản). Không truyền `AvailableOn` thì
  không lọc — lịch, bộ lọc, báo cáo giữ nguyên.
- FE: danh sách lọc theo ngày dùng query key riêng (`staleTime 0`), không đụng cache
  danh sách đầy đủ.

| Màn | Ô | Ngày dùng để lọc |
|---|---|---|
| Tạo / sửa lịch hẹn | Chọn bác sĩ | ngày hẹn đang chọn |
| Tạo / sửa lịch tạm | Chọn bác sĩ | ngày hẹn đang chọn |
| Tạo tiếp nhận | Bác sĩ điều trị | ngày hẹn trong form |
| Thẻ tiếp nhận (đổi bác sĩ) | Bác sĩ | ngày đến của lượt (một query cho mỗi ngày khác nhau trên màn) |
| Hẹn tái khám từ thẻ tiếp nhận | Bác sĩ | ngày tái khám đã chọn (chưa chọn ngày → mọi bác sĩ) |
| Chẩn đoán | Bác sĩ chẩn đoán 1 / 2 | hôm nay |
| Công đoạn KHĐT | Bác sĩ, Phụ tá, Bác sĩ hỗ trợ | hôm nay |
| Lịch hẹn ở hồ sơ (đổi bác sĩ) | Bác sĩ | ngày của lịch hẹn |

Sửa bản ghi đã lưu: bác sĩ đã lưu vẫn hiện tên (lấy từ DTO) dù nay đã OFF — mở form
sửa không bao giờ làm trống lựa chọn cũ. Lịch hẹn chuyển sang ngày khác thì bác sĩ
phải rảnh ngày mới.

## Bằng chứng (real stack, build production `vite preview` :8080, host :5000, DB thật, không chặn request)

- `e2e/staff-day-off-api.spec.ts` **3/3** — OFF ngày D bị bỏ chỉ ngày D, chỉ tại chi
  nhánh đăng ký; xoá X thì hiện lại; người chưa đăng ký vẫn hiện.
- `e2e/doctor-day-off-pickers.spec.ts` **3/3** — Tạo lịch hẹn (bác sĩ OFF không có
  trong danh sách ngày D; chọn ở D+1 rồi đổi sang D → ô bị xoá kèm lỗi; chọn bác sĩ
  khác thì hết lỗi), Tạo tiếp nhận (tương tự), Tạo chẩn đoán (OFF hôm nay → không có).
- Dữ liệu: nhân viên tạo riêng cho từng lần chạy (role `admin`), ngày nghỉ do
  **chính bác sĩ đó** đăng nhập và ghi qua `POST /time-keepings/bulk-register` thật
  (`e2e/fixtures/ownDayOff.ts`) — từ a9a04c89 không ai, kể cả admin, được đánh X
  hộ người khác. Xoá nhân viên sau test.
- Chạy lại 2026-10-02 trên HEAD a9a04c89: **6/6**.

## Chưa phủ / còn treo

- Lịch tạm, thẻ tiếp nhận, hẹn tái khám, công đoạn KHĐT, lịch hẹn ở hồ sơ: dùng chung
  hook/endpoint đã test nhưng chưa có spec UI riêng.
- Xem `docs/clone/unknowns.md` → "Bác sĩ nghỉ — ô chọn bác sĩ".
