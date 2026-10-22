# F-78 — Tổng quan › Thống kê CSKH (BA P2110, đợt 3)

Nguồn:

- `P2110.drawio` của BA: img_31 (bộ lọc, thẻ số, cột theo ngày, Theo kênh,
  Hiệu suất theo mẫu), img_32 (Lịch sử gửi, Người nhận), img_33 (vị trí menu);
- ghi chú BA: bộ lọc và tìm / sắp xếp dùng thanh chọn thời gian, mặc định tháng hiện tại;
- chủ dự án: "Thống kê mới nằm ở sub menu Thống kê CSKH, còn thống kê hiện tại nằm ở sub menu Tổng quan".

Đợt 1 là F-76 (`cskh-message-template.md`, có 12 quyết định của chủ dự án), đợt 2 là
F-77 (`cskh-message-send.md`). BlueDental riêng, bản gốc không có màn này.
Regression id R-1011 (R-1010 là commit dời nút "Gửi tin nhắn chăm sóc").

Status: xem `01-feature-verification-registry.md` dòng F-78.

## Quyết định áp dụng ở đợt này

| # | Quyết định | Cách làm |
|---|---|---|
| 1 | Chỉ Zalo gửi thật | SMS / Email vẫn có cột trong Theo kênh và nút lọc, nhưng số là 0 và "Thành công —" |
| 8 | Không có Đã xem / mở và Khách phản hồi | 3 thẻ số thay cho 5; bảng mẫu không có cột Xem / mở, Phản hồi; Người nhận không có "Đã xem" / "Đã mở" |
| 9 | Thiết kế v2 | Khung `.page-card`, `KpiCard`, `.dash-card-head` như trang Tổng quan, không theo màu ảnh BA |
| 11 | PeriodRangePicker chỉ ở Thống kê CSKH | Component dùng chung `src/components/PeriodRangePicker/`, hiện chỉ trang này dùng |

## Đã dựng

### Menu

Nhóm "Tổng quan" trên header thành nhóm 2 mục, ribbon luôn hiện như các nhóm khác:

1. **Tổng quan** (`/dashboard`): trang cũ, không đổi.
2. **Thống kê CSKH** (`/dashboard/cskh`): trang mới.

Đường dẫn của trang mới nằm dưới `/dashboard`, nên `/dashboard` khớp chính xác
(`EXACT_PATHS`): ở `/dashboard/cskh` chỉ "Thống kê CSKH" sáng, nhóm "Tổng quan" sáng.
Drawer dưới 1100 px có 18 mục.

### Bộ lọc (một hàng, điều khiển mọi khối bên dưới và file Excel)

- **Thời gian**: `PeriodRangePicker`, mặc định từ đầu tháng tới hôm nay, "So sánh kỳ trước" bật.
  - Đơn vị: Ngày, Tháng, Quý, Nửa năm, Năm.
  - Chọn nhanh: Hôm nay, 7 ngày qua, 30 ngày qua, Tháng này, Tháng trước.
  - Chỉ áp dụng khi bấm "Áp dụng"; bấm Huỷ hoặc bấm ra ngoài thì bỏ phần đang chọn dở.
  - Kỳ trước = cùng số ngày, kết thúc ngay trước ngày bắt đầu.
- **Kênh**: Tất cả / SMS / Zalo / Email. Đổi kênh thì bỏ mẫu đang chọn nếu mẫu đó thuộc kênh khác.
- **Mẫu**: Tất cả mẫu hoặc một mẫu của chi nhánh. Mẫu đã xoá chỉ còn trong danh sách nếu từng được dùng để gửi, có nhãn "(đã xoá)".

### Các khối

1. **3 thẻ số** (`KpiCard` dùng chung):
   - Tin đã gửi: dòng phụ "+N% so với kỳ trước", hoặc "Kỳ trước chưa có tin";
   - Gửi thành công: tỉ lệ %, dòng phụ "N tin";
   - Thất bại: số tin, dòng phụ "N% số tin đã gửi".
2. **Tin đã gửi theo ngày**: cột theo ngày; kỳ dài hơn 62 ngày thì cộng theo tháng ("Tin đã gửi theo tháng").
   - Cột hôm nay (hoặc tháng này) đậm màu, các cột khác nhạt.
   - Chỉ cột cao nhất và cột hôm nay có số trên đầu.
   - Trục X thưa dần theo bề ngang, đếm ngược từ cột cuối nên ngày cuối luôn có nhãn.
   - Rê chuột: ngày, số tin, thành công, thất bại.
3. **Theo kênh**: SMS / Zalo / Email, số tin, thanh tỉ lệ, "Thành công N%" (chưa có tin thì "—").
4. **Hiệu suất theo mẫu**: Mẫu · Kênh · Lần dùng ("N chiến dịch") · Đã gửi · Thành công (thanh + %) · Lần cuối. Có phân trang.
5. **Lịch sử gửi**: Thời gian · Mẫu (+ kênh) · Tệp khách hàng · Người gửi · Người nhận · Kết quả · Trạng thái.
   - Tệp khách hàng: tên tab CSKH + ngày, hoặc "Khách lẻ".
   - Kết quả: thanh + "N thành công · N lỗi", "N / M đã gửi" khi đang gửi, "Chưa gửi" khi chưa chạy.
   - Trạng thái: Chờ gửi, Đã hẹn giờ, Đang gửi, Hoàn tất, Đã huỷ.
   - Thời gian = giờ hẹn nếu có, không thì lúc tạo; mới nhất ở trên.
6. **Người nhận**: Khách hàng · Liên hệ · Mẫu đã nhận · Kênh · Thời gian · Trạng thái.
   - Tìm theo tên (không dấu) hoặc SĐT; gõ `0…` thì tìm cả `84…`.
   - Lọc: Mọi trạng thái / Đã nhận / Thất bại / Đang gửi.
   - Sắp xếp: theo tên hoặc theo thời gian (mặc định mới nhất).
   - Thất bại có dòng lý do bằng tiếng Việt ("Thiếu dữ liệu: …", "Lỗi khi gửi", …); lỗi do Zalo trả về thì hiện nguyên văn.
   - Tin của lượt hẹn giờ chưa chạy ghi "Đã hẹn giờ".
7. **Xuất báo cáo Excel**: 4 sheet Theo ngày, Theo mẫu, Lịch sử gửi, Người nhận. File theo đúng bộ lọc và ô tìm / trạng thái của Người nhận.

### Số nào tính vào đâu

- Thẻ số, cột theo ngày, Theo kênh, Hiệu suất theo mẫu: chỉ tính tin **đã thử gửi** (không tính tin còn chờ) có thời điểm trong kỳ.
- Thời điểm một tin = lúc gửi, không có thì lúc lượt bắt đầu, rồi giờ hẹn, rồi lúc tạo.
- Người nhận: tin có thời điểm hoặc lúc tạo nằm trong kỳ, nên lượt hẹn giờ vẫn hiện từ lúc tạo.
- Lịch sử gửi: lượt có lúc tạo hoặc giờ hẹn nằm trong kỳ.
- "Lần dùng" của mẫu = số lượt gửi khác nhau + số tin gửi lẻ.

### BE

- `MessageStatsAppService` (`[Authorize(CskhStats.Read)]`, Excel cần `CskhStats.Export`):
  - chi nhánh lấy từ `X-Clinic-Branch-Id` qua `ICurrentClinicBranchResolver` + `BranchAccessChecker`;
  - không truyền ngày = đầu tháng tới hôm nay;
  - `Tools:0026` ngày bắt đầu sau ngày kết thúc, `Tools:0027` kỳ dài quá 1830 ngày (`MessageStatsLimits.MaxPeriodDays`);
  - trang tối đa 100 dòng;
  - SĐT trả về dạng `0…` (`ZaloPhoneNumber.ToLocal`), bị che khi người xem có "Ẩn số điện thoại". Khi bị che, tìm theo SĐT chỉ khớp khi gõ đủ số.
- `MessageStatsExcel`: dựng 4 sheet qua `ExcelSheet.BuildBook` (mới, dùng chung). Tối đa 50.000 người nhận một file; SĐT che theo `PatientPhoneMasker`.
- `MessageBatchCounter` (tách khỏi `MessageSendAppService`): đếm Đã gửi / Thất bại / Chờ của từng lượt, dùng chung cho Gửi tin nhắn và Thống kê.
- `MessageFailureReasons`: lý do thất bại lưu bằng mã tiếng Anh cố định (`MessageSendJob` ghi), `Describe` đổi sang chữ `CSKH:Stats:Error:*` lúc hiển thị.

### API — `api/v1/app/message-stats`

| Method | Path | Quyền |
|---|---|---|
| GET | `/overview` (thẻ số, theo ngày, theo kênh, theo mẫu, kỳ trước nếu có) | cskhStats.read |
| GET | `/templates` (mẫu cho ô lọc) | read |
| GET | `/batches` (Lịch sử gửi, phân trang) | read |
| GET | `/recipients` (Người nhận: tìm, trạng thái, sắp xếp, phân trang) | read |
| GET | `/excel` | export |

### Quyền

- Subject `cskhStats` (Xem / Xuất Excel), nhóm "Thống kê CSKH" dưới CSKH trong cây Phân quyền, sau "Gửi tin nhắn".
  Seeder cấp role tĩnh; role tuỳ chỉnh phải cấp tay.
- Route `/dashboard/cskh` cần `read`. Không có Xem: không có mục trong ribbon / drawer, vào link thì gặp "Không có quyền truy cập", API 403.
- Chỉ có Xem: không có nút "Xuất báo cáo Excel", `/excel` trả 403.

### FE

- Trang `pages/CskhStatsPage.tsx`, component trong `components/stats/` (13 file), CSS `cskh-stats.css`.
- Hooks: `useStatsFilters` (Thời gian / Kênh / Mẫu), `useStatsRecipientQuery` (tìm, trạng thái, sắp xếp của Người nhận; Excel đọc cùng giá trị).
- API: `api/statsApi.ts`, adapter `api/statsAdapters.ts` (cột ngày ↔ tháng, tỉ lệ).
- Dùng chung mới:
  - `src/components/KpiCard.tsx` (dời từ `features/dashboard`; trang Tổng quan đổi import, giao diện không đổi);
  - `src/components/PeriodRangePicker/` (`monthToDate`, `previousPeriod`, `formatPeriodRange`).
- `nav.ts`: mục `cskhStats`; nhóm Tổng quan có 2 mục. `routePermissions.ts`: `cskhStats: readOf(["cskhStats"])`.

## Kiểm thử

| Mức | Kết quả |
|---|---|
| Domain.Tests | **1028/1028** (gồm `BlueDentalAbilitiesTests` có `cskhStats`) |
| Application.Tests | **786/786** (gồm `MessageStatsAppServiceContractTests` 7, `MessageStatsWordingTests` 4) |
| HttpApi.Host.Tests | **24/24** |
| E2E `cskh-stats` | **4/4** (vẫn xanh sau R-1019; lý do mới `NoPhone` được kiểm ở `cskh-message-send` R-1019, cả trên màn và trong Excel) |
| Hồi quy mức 3 | **60/64** + smoke Excel **19/20**; các ca đỏ đều có từ trước hoặc chập chờn (chạy lại xanh), chi tiết ở R-1011 trong `03-regression-log.md` |

Đường chạy E2E: build production `vite preview` 127.0.0.1:8130 → host develop 127.0.0.1:5100 →
PostgreSQL `BlueDental_develop`, job gửi thật, không chặn request nào.
Zalo là stub local `e2e/fixtures/zalo-stub.mjs` (:5199); spec chỉ chạy khi có `E2E_ZALO_STUB=1`.

Các ca E2E:

1. **Một lần gửi Zalo, 1 thành công, 1 bị từ chối** (stub từ chối số `0399…` bằng lỗi -108):
   thẻ số, Theo kênh, Hiệu suất theo mẫu, Lịch sử gửi ("1 thành công · 1 lỗi"), Người nhận
   (Đã nhận / Thất bại + lý do); sắp xếp theo tên, tìm, lọc trạng thái; Excel 4 sheet đúng bộ lọc;
   chọn SMS thì mọi khối về 0.
2. **Hẹn giờ rồi huỷ**: Lịch sử gửi ghi Đã hẹn giờ rồi Đã huỷ, Kết quả "Chưa gửi", không tính vào Tin đã gửi.
3. **Quyền**: không có `cskhStats` thì không có mục, link bị chặn, API 403; chỉ Xem thì không có Xuất Excel, `/excel` 403.
4. **Chi nhánh**: lần gửi của BD-001 không lẫn vào số liệu, ô mẫu hay Người nhận của chi nhánh khác.

Lệnh chạy:

```
E2E_BASE_URL=http://127.0.0.1:8130 E2E_ZALO_STUB=1 \
  npx playwright test e2e/cskh-stats.spec.ts --workers=1
```

### Lưu ý khi viết spec

- Stub giữ mọi lần gọi suốt đời tiến trình; spec so phần chênh hoặc lọc theo SĐT (như F-77).
- Số `0399…` luôn bị stub từ chối (-108 "Phone number is invalid"): dùng để có tin Thất bại thật.
- Nhóm Tổng quan có 2 mục: spec muốn mở trang Tổng quan phải bấm mục ribbon "Tổng quan", không chỉ bấm nhóm.
- File Excel đọc bằng `XLSX.read(readFileSync(p), { type: "buffer" })` (bản ESM của `xlsx` không có `readFile`).

## Còn treo

- SMS / Email chưa có nhà cung cấp gửi, nên chưa có số liệu.
- Đã xem / mở và Khách phản hồi: chưa kênh nào báo về (quyết định 8).
- Các điểm khác so với img_31 / img_32: xem `docs/clone/pages/cskh-messaging.md` và `unknowns.md` (F-78).
- Staging cần DbMigrator (quyền mới), rồi xoá cache quyền Redis. Role tuỳ chỉnh phải cấp tay "Thống kê CSKH".

## Retest khi sửa

Xem `02-impact-map.md`: `MessageStats*`, `features/cskh/components/stats/*`, `PeriodRangePicker`, `KpiCard`, nhóm Tổng quan trong `nav.ts`.
