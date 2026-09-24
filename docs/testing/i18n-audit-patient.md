# Rà soát i18n — trang Bệnh nhân (`/patient`) và các trang liên kết

Ngày rà soát: 2026-09-23 · Commit: `1e8e172` · Trạng thái: **ĐÃ SỬA A–F** (xem §0), trừ 9 mẫu bệnh án in — giữ tiếng Việt theo quyết định của chủ dự án

## 0. Kết quả sửa (2026-09-23, trên `890c266a`)

- **A–F đã xử lý hết.** Mọi chuỗi đổi sang key namespace; thêm 140 key vào `vi.json`/`en.json`. Giá trị `vi` giữ **đúng** câu gốc, nên giao diện tiếng Việt không đổi chữ nào, trừ câu lặp "đã chọn đã chọn" đã sửa.
- **Giữ tiếng Việt ở cả hai ngôn ngữ:** 9 mẫu `medical-record/templates/*.ts` và tên của chúng trong `medicalRecordForms.ts`. Tên này còn là tiêu đề được lưu khi tạo tờ mới, nên bỏ `t()` để người dùng English không lưu tiêu đề tiếng Anh.
- `moneyWords.ts` đọc số bằng tiếng Anh khi giao diện là English ("Three hundred thousand dong").
- Nhãn tab báo giá `BG n` → `Patient:Quote:TabLabel` (EN "Quote n").
- Dialog bỏ dòng dịch vụ nháp dùng lại đúng câu gốc ("Xác nhận xóa" / "Sau khi xác nhận, thông tin sẽ bị xóa và không thể khôi phục.") qua key riêng.
- Bằng chứng: analyzer tĩnh không còn key thiếu, placeholder lệch hay key thô. Quét DOM runtime ở English chỉ còn dữ liệu và 9 tên biểu mẫu; ở tiếng Việt có 0 key thô và 0 lỗi JS. `tsc`, `npm run lint`, `npm test` đều xanh.
- Phát hiện thêm ngoài báo cáo ban đầu, xem **§I**: ngày bị in thành chuỗi rác (đã sửa), CI typecheck đỏ (đã sửa), và câu tiếng Việt bị đổi khác câu gốc (đã sửa trong phạm vi trang này; ngoài phạm vi còn 64 vị trí).

## 1. Phạm vi và cách làm

**Phạm vi**: toàn bộ file đi tới được theo import graph từ 3 route:

- `/patient` — `PatientManagementPage` (danh sách, bộ lọc, dialog tạo/sửa bệnh nhân)
- `/patient/:id` — `PatientProfilePage` (10 tab, chế độ "Bệnh án", toàn bộ modal/drawer/tờ in)
- `/patient/:id/treatment-plan/:planId` — `TreatmentPlanDetailPage` (tab Chi tiết/Thanh toán/Hoàn tiền/Dư nợ)

Tổng cộng **386 file**: 173 file patient-management, 88 file treatment-management, 38 file appointments
(dùng chung qua tab Lịch hẹn), cùng shared components/hooks/utils. Không tính `src/app` (shell), test và mock.

**Cách làm**

1. *Phân tích tĩnh (TypeScript AST).* Duyệt mọi string literal, JSX text, template literal và thuộc tính
   hiển thị (`placeholder`, `title`, `aria-label`, `alt`…). Mỗi lời gọi `t()`/`tRich()` được đối chiếu với
   `BlueDental.Domain.Shared/Localization/BlueDental/{vi,en}.json` theo các tiêu chí: key có tồn tại không,
   số placeholder `{n}` có khớp số tham số không, có key động không, có `t()` ở module scope không (loại này
   không cập nhật khi đổi ngôn ngữ), có locale viết cứng không.
2. *Đối chiếu overlay thật.* `GET /api/abp/application-localization` của BE đang chạy trả về 4.504 key
   cho mỗi ngôn ngữ, khớp 100% với file trên đĩa. Vì vậy mọi kết luận dưới đây đúng với runtime.
3. *Quét runtime.* Chạy Playwright trên app local (`:5173`, BE `:5019`), đăng nhập qua màn login thật,
   ở chế độ English, chi nhánh `2222…`. Script duyệt danh sách → 10 tab hồ sơ → Bệnh án → chi tiết kế hoạch
   điều trị, bấm từng nút an toàn (bỏ qua xoá/lưu/huỷ/xác nhận…), mở các select và tab trong dialog, rồi thu
   mọi text tiếng Việt và key thô còn lại trên DOM. Kết quả: 5.990 bản ghi, 252 chuỗi duy nhất, 0 lỗi JS.

**Cơ chế cần nắm để đọc báo cáo**: `t(key)` trả về `overlay[key] ?? key`, và `en.json` **không có
key tiếng Việt có dấu nào** (chỉ có vài key không dấu như `"Nam"`, `"Xem"`). Hệ quả:

- `t("câu tiếng Việt")`: giao diện tiếng Việt hiển thị đúng, nhưng ở English **vẫn là tiếng Việt**.
- `t("Namespace:Key")` thiếu trong cả hai file: **hiện nguyên key thô ở CẢ HAI ngôn ngữ**.

## 2. Tổng kết

| # | Loại lỗi | Số lượng | Ảnh hưởng |
|---|---|---|---|
| A | Key namespace thiếu ở cả `vi.json` lẫn `en.json` | 14 key | Hiện key thô (`Patient:VoucherCount`) ở cả VI và EN — **regression** |
| B | Placeholder `{0}` không được truyền tham số | 2 chỗ | Hiện nguyên `{0}` trên giao diện |
| C | `t("câu tiếng Việt")` không có bản dịch EN | 16 key (+1 key ngược) | English vẫn hiện tiếng Việt |
| D | Nhãn tiếng Việt trong constant map, render qua `t()` động, không có bản dịch EN | 21 file, ~130 chuỗi | English vẫn hiện tiếng Việt |
| E | Text tiếng Việt không đi qua `t()` | 7 nhóm | Thêm key cũng không dịch được |
| F | Không nhất quán / lỗi nội dung | 3 | Xem mục F |

Không phát hiện: `t()` ở module scope, `t()` với template/concat key, alias khác của `t`, locale viết cứng
cho định dạng số/ngày. `ConfigProvider` của AntD và `dayjs.locale` đổi đúng theo ngôn ngữ.

## A. Key namespace thiếu ở cả hai file: hiện key thô (ưu tiên cao nhất)

Toàn bộ 14 key xuất hiện từ commit `2eec1e9e` ("Refactor voucher components for improved
internationalization", 2026-09-23). Commit này đổi câu tiếng Việt sang key namespace nhưng **không thêm
entry nào vào `vi.json`/`en.json`**. Cột "Câu gốc" lấy từ diff của chính commit đó, dùng được làm giá trị
cho `vi.json`.

| Key | Câu gốc (vi) | Hiển thị ở đâu | Nơi dùng |
|---|---|---|---|
| `Patient:VoucherCount` | `Voucher ({0})` | **Nhãn nút** chọn voucher (tab Tư vấn) | [AdviseVoucherPicker.tsx:120](../../BlueDental.FE/src/features/patient-management/components/patient-detail/AdviseVoucherPicker.tsx#L120) |
| `Patient:SelectedCount` | `Đã chọn: {0}` | **Text** trong popover voucher | [AdviseVoucherPicker.tsx:113](../../BlueDental.FE/src/features/patient-management/components/patient-detail/AdviseVoucherPicker.tsx#L113) |
| `Patient:VoucherSaving` | `≈ giảm {0}` | **Text** số tiền được giảm | [AdviseVoucherPicker.tsx:48](../../BlueDental.FE/src/features/patient-management/components/patient-detail/AdviseVoucherPicker.tsx#L48) |
| `Patient:Payment:DefaultDescription` | `Thanh toán điều trị ngày {0}` | **Giá trị** ô "Nội dung" trong dialog tạo thanh toán | [CreatePaymentDialog.tsx:266](../../BlueDental.FE/src/features/patient-management/components/patient-detail/CreatePaymentDialog.tsx#L266) |
| `Patient:Diagnosis:PrintTitle` | `In chẩn đoán {0}` | **Tiêu đề modal** in chẩn đoán | [DiagnosisPrintDialog.tsx:207](../../BlueDental.FE/src/features/patient-management/components/patient-detail/consulting/DiagnosisPrintDialog.tsx#L207) |
| `Patient:Image:DayCount` | `{0} ảnh` | **Text** đếm số ảnh theo ngày (tab Hình ảnh) | [PatientImageDayRow.tsx:24](../../BlueDental.FE/src/features/patient-management/components/patient-detail/image/PatientImageDayRow.tsx#L24) |
| `Patient:SortColumnLabel` | `Sắp xếp {0}` | aria-label nút kéo (đã thấy trên runtime) | [AdviseColumnConfig.tsx:85](../../BlueDental.FE/src/features/patient-management/components/patient-detail/AdviseColumnConfig.tsx#L85), [PatientAdviseCard.tsx:292](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientAdviseCard.tsx#L292) |
| `Patient:RemoveQuoteLabel` | `Bỏ {0}` | aria-label | [AdviseQuoteTabs.tsx:55](../../BlueDental.FE/src/features/patient-management/components/patient-detail/AdviseQuoteTabs.tsx#L55) |
| `Patient:Diagnosis:RemoveJaw` | `Bỏ chọn {0}` | aria-label | [DiagnosisSelectedTeeth.tsx:40](../../BlueDental.FE/src/features/patient-management/components/patient-detail/DiagnosisSelectedTeeth.tsx#L40) |
| `Patient:Diagnosis:RemoveTooth` | `Bỏ chọn răng {0}` | aria-label | [DiagnosisSelectedTeeth.tsx:48](../../BlueDental.FE/src/features/patient-management/components/patient-detail/DiagnosisSelectedTeeth.tsx#L48) |
| `Patient:Image:ViewFileLabel` | `Xem ảnh {0}` | aria-label | [PatientConsultingImagePanel.tsx:188](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientConsultingImagePanel.tsx#L188), [PatientImageCard.tsx:73](../../BlueDental.FE/src/features/patient-management/components/patient-detail/image/PatientImageCard.tsx#L73) |
| `Patient:Image:ShowFileLabel` | `Hiển thị {0}` | aria-label | [PatientImageCard.tsx:66](../../BlueDental.FE/src/features/patient-management/components/patient-detail/image/PatientImageCard.tsx#L66) |
| `Patient:Diagnosis:SelectImageLabel` | `Chọn {0}` | aria-label | [DiagnosisPrintImages.tsx:71](../../BlueDental.FE/src/features/patient-management/components/patient-detail/consulting/DiagnosisPrintImages.tsx#L71), [:76](../../BlueDental.FE/src/features/patient-management/components/patient-detail/consulting/DiagnosisPrintImages.tsx#L76) |
| `Patient:Diagnosis:ShowImageLabel` | `Hiển thị {0}` | aria-label | [DiagnosisPrintImages.tsx:124](../../BlueDental.FE/src/features/patient-management/components/patient-detail/consulting/DiagnosisPrintImages.tsx#L124) |

Vì không có entry nào nên cũng không có placeholder để điền, tham số truyền vào bị bỏ. Ví dụ nút voucher
hiện `Patient:VoucherCount` thay vì `Voucher (2)`.

## B. Placeholder không được truyền tham số: hiện `{0}`

| Chỗ | Vấn đề | Hiển thị |
|---|---|---|
| [PlanServicesTab.tsx:255](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/PlanServicesTab.tsx#L255) | `title={t("Common:ConfirmDelete")}`: key có giá trị `Xác nhận xoá {0}` nhưng không truyền `noun`. Nếu bỏ trống `title`, `ConfirmDeleteDialog` sẽ tự dựng tiêu đề từ `noun` | Tiêu đề dialog bỏ dịch vụ: **"Xác nhận xoá {0}"** / "Confirm delete {0}" |
| [UsagePicker.tsx:75](../../BlueDental.FE/src/components/prescription-lines/UsagePicker.tsx#L75) | `placeholder={t("Common:PleaseEnter")}`: key có giá trị `Vui lòng nhập {0}` | Placeholder ô "Cách dùng khác" (dialog kê đơn): **"Vui lòng nhập {0}"** |

Cùng chỗ đó, `PlanServicesTab.tsx:256` truyền `question={t("Common:CannotUndone")}`, trong khi dialog đã
in sẵn dòng `Common:CannotUndone` ở dưới, nên câu "Thao tác này không thể hoàn tác" hiện **hai lần**.

## C. `t("câu tiếng Việt")` không có bản dịch EN

Giao diện tiếng Việt hiển thị đúng; ở English các câu này vẫn là tiếng Việt.

| Key | Nơi dùng |
|---|---|
| `Số điện thoại này đã thuộc về [{0}] {1}` | [PatientEditorDialog.tsx:294](../../BlueDental.FE/src/features/patient-management/components/PatientEditorDialog.tsx#L294) |
| `IN HOA` | [PatientSourceColumn.tsx:70](../../BlueDental.FE/src/features/patient-management/components/PatientSourceColumn.tsx#L70) |
| `Xem {0}` | [PatientTable.tsx:176](../../BlueDental.FE/src/features/patient-management/components/PatientTable.tsx#L176) |
| `Phiếu báo giá {0} sẽ bị xoá và thao tác này không thể khôi phục.` | [AdviseQuoteTabs.tsx:69](../../BlueDental.FE/src/features/patient-management/components/patient-detail/AdviseQuoteTabs.tsx#L69) |
| `In nhanh` | [MedicalRecordSheetCard.tsx:85](../../BlueDental.FE/src/features/patient-management/components/patient-detail/MedicalRecordSheetCard.tsx#L85) |
| `In nhanh {0}` | [MedicalRecordSheetCard.tsx:86](../../BlueDental.FE/src/features/patient-management/components/patient-detail/MedicalRecordSheetCard.tsx#L86) |
| `Bác sĩ đưa ra các phương pháp can thiệp điều trị. Từ tốt nhất để phù hợp nhất với từng vấn đề đang gặp phải` | [PatientAdviseCard.tsx:357](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientAdviseCard.tsx#L357) |
| `Tạo báo giá từ các phiếu tư vấn đã chọn đã chọn, bạn có thể chỉnh sửa ở phần báo giá` | [PatientAdviseCard.tsx:479](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientAdviseCard.tsx#L479) |
| `Hiển thị {0} trên {1} phiếu thanh toán` | [PatientProfileDialogs.tsx:268](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientProfileDialogs.tsx#L268) |
| `Ngày {0} tháng {1} năm {2}` | [LaboPrintSheet.tsx:15](../../BlueDental.FE/src/features/patient-management/components/patient-detail/labo/LaboPrintSheet.tsx#L15), [TreatmentHistoryPrintDialog.tsx:36](../../BlueDental.FE/src/features/patient-management/components/patient-detail/stage/TreatmentHistoryPrintDialog.tsx#L36) |
| `In` | [PrintSheetPicker.tsx:87](../../BlueDental.FE/src/features/patient-management/components/patient-detail/medical-record/PrintSheetPicker.tsx#L87) |
| `Cùng với việc thăm khám lâm sàng và phim chụp của bệnh nhân {0}, bác sĩ đưa ra chẩn đoán và giải thích chi tiết:` | [DiagnosisGroupBlock.tsx:53](../../BlueDental.FE/src/features/patient-management/components/patient-detail/quote/DiagnosisGroupBlock.tsx#L53) |
| `* Lời dặn của Bác sĩ: Quý khách vui lòng tuân thủ hướng dẫn vệ sinh răng miệng và liên hệ hotline phòng khám khi có bất kỳ thắc mắc nào.` | [DiagnosisGroupBlock.tsx:66](../../BlueDental.FE/src/features/patient-management/components/patient-detail/quote/DiagnosisGroupBlock.tsx#L66) |
| `CMND/CCCD` | [InvoiceCustomerInfo.tsx:49](../../BlueDental.FE/src/features/treatment-management/components/InvoiceCustomerInfo.tsx#L49) |
| `KCT` | [invoiceConstants.ts:16](../../BlueDental.FE/src/features/treatment-management/components/invoiceConstants.ts#L16) |
| `Bạn có chắc chắn hủy dịch vụ {0}? Thao tác này không thể hoàn tác.` | [CancelServiceDialog.tsx:42](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/CancelServiceDialog.tsx#L42) |

Trường hợp ngược: `t("Fit")` ở [PrintRecordToolbar.tsx:49](../../BlueDental.FE/src/features/treatment-management/components/plan/PrintRecordToolbar.tsx#L49)
là key tiếng Anh và không có trong `vi.json`, nên giao diện tiếng Việt hiện "Fit".

## D. Nhãn tiếng Việt trong constant map (render qua `t()` động): không có bản dịch EN

Các map dưới đây được render bằng `t(map[key])`, nên cơ chế đã đúng, chỉ thiếu entry trong `en.json`
(hoặc nên đổi sang key namespace như phần còn lại của feature).

Đã xác nhận trên runtime English: 7 ô tiền và 6 nút lọc ở tab Hồ sơ, 12 cột trong "Cấu hình cột" khi
in chẩn đoán, 9 loại phiếu "Bệnh án", tab và ô thống kê ở chi tiết kế hoạch điều trị, tiêu đề cột bảng dịch
vụ, tên màu lịch hẹn, mẫu hoá đơn, câu "Chưa có dịch vụ nào để tiếp tục công đoạn".

| File | Dòng: chuỗi |
|---|---|
| [appointments/…/AppointmentColorPicker.tsx](../../BlueDental.FE/src/features/appointments/components/AppointmentColorPicker.tsx) | L4: `Tím`<br>L5: `Xanh lá`<br>L7: `Đỏ` |
| [appointments/…/MiniCalMonthView.tsx](../../BlueDental.FE/src/features/appointments/components/MiniCalMonthView.tsx) | L11: `Thứ 2` … `Thứ 7`, `Chủ nhật`<br>L22: `Đã đến`<br>L29: `Đã huỷ`<br>L36: `Đã hẹn` |
| [appointments/…/MiniCalWeekView.tsx](../../BlueDental.FE/src/features/appointments/components/MiniCalWeekView.tsx) | L7: `Thứ 2` … `Thứ 7`, `Chủ nhật` |
| [appointments/…/appointmentStatusOptions.ts](../../BlueDental.FE/src/features/appointments/components/appointmentStatusOptions.ts) | L8–13: `Đã hẹn`, `Đã đến`, `Đã huỷ`, `Trễ hẹn` |
| [appointments/…/history/historyLabels.ts](../../BlueDental.FE/src/features/appointments/components/history/historyLabels.ts) | L68–79: `Thời gian bắt đầu`, `Thời gian kết thúc`, `Thời lượng (phút)`, `Trạng thái`, `Nội dung`, `Ghi chú`, `Màu`, `Bác sĩ`, `Tên bệnh nhân`, `SĐT bệnh nhân`, `Lý do huỷ`, `Ghi chú huỷ` |
| [labo/api/laboApi.ts](../../BlueDental.FE/src/features/labo/api/laboApi.ts) | L36–42: `Mẫu mới`, `Tiếp tục công đoạn`, `Bảo hành`<br>L58–63: `Đơn hàng mới`, `Đã gửi`, `Đang xử lý`, `Đã nhận`, `Hoàn thành`, `Đã huỷ` |
| [patient-detail/PatientProfileTab.tsx](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientProfileTab.tsx) | L64–66: `Nữ`, `Khác`, `Không tiết lộ`<br>L288–302: `Tổng dự kiến thu`, `Đã thu`, `Dự kiến thu còn lại`, `Dư nợ`, `Phải thu`, `Đã hoàn`, `Tạm ứng`<br>L459–464: `Tất cả`, `Điều trị hoàn tất`, `Đang điều trị`, `Các chẩn đoán`, `Tái khám`, `Bảo hành` |
| [patient-detail/PatientRecordTabs.tsx](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientRecordTabs.tsx) | L22–24: `Nữ`, `Khác`, `Không tiết lộ` |
| [patient-detail/ReceptionSteps.tsx](../../BlueDental.FE/src/features/patient-management/components/patient-detail/ReceptionSteps.tsx) | L24: `Đã đến`, `Đang khám`, `Hoàn tất` |
| [patient-detail/TreatmentStageDialog.tsx](../../BlueDental.FE/src/features/patient-management/components/patient-detail/TreatmentStageDialog.tsx) | L37: `Tất cả dịch vụ đã được thêm công đoạn`<br>L38: `Chưa có dịch vụ nào để tiếp tục công đoạn` |
| [patient-detail/adviseColumns.ts](../../BlueDental.FE/src/features/patient-management/components/patient-detail/adviseColumns.ts) | L25–36: `Ngày`, `Dịch vụ`, `Chẩn đoán`, `Nhân sự tư vấn 1`, `Nhân sự tư vấn 2`, `Bác sĩ chẩn đoán 1`, `Chẩn đoán 2`, `Số lượng`, `Đơn giá`, `Giảm giá`, `Thành tiền`, `Ghi chú tư vấn` |
| [patient-detail/medicalRecordForms.ts](../../BlueDental.FE/src/features/patient-management/components/patient-detail/medicalRecordForms.ts) | L57–141: 9 tên phiếu (`Bìa hồ sơ bệnh án`, `Bệnh án ngoại trú Răng Hàm Mặt`, `Bệnh án chỉnh nha`, `Phiếu Tư Vấn Tổng Quát`, `Phiếu tư vấn và xác nhận đồng ý điều trị`, `Giấy đồng ý thực hiện phẫu thuật/thủ thuật`, `Phiếu phẫu thuật/thủ thuật`, `Phiếu theo dõi điều trị`, `Phiếu chăm sóc`) và `dateLabel` (`Ngày thực hiện`, `Ngày tư vấn`) |
| [patient-detail/stage/StageFollowUpDialog.tsx](../../BlueDental.FE/src/features/patient-management/components/patient-detail/stage/StageFollowUpDialog.tsx) | L31–43: `Tạo bảo hành`, `Lưu bảo hành`, `Đã tạo bảo hành`, `Tạo tái khám`, `Lưu`, `Đã tạo tái khám` |
| [treatment-management/…/advise/AdviseServiceTable.tsx](../../BlueDental.FE/src/features/treatment-management/components/advise/AdviseServiceTable.tsx) | L20–25: `Dịch vụ`, `Đơn giá`, `Số lượng`, `Giảm giá`, `Thành tiền`, `Ghi chú` |
| [treatment-management/…/invoiceConstants.ts](../../BlueDental.FE/src/features/treatment-management/components/invoiceConstants.ts) | L5–6: `Mẫu 01GTKT0/001`, `Mẫu 02GTTT0/001`<br>L20: `Răng` (đơn vị mặc định) |
| [plan-detail/PlanDetailHead.tsx](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/PlanDetailHead.tsx) | L23–28: `Doanh thu dự kiến`, `Đã thanh toán`, `Công nợ`, `Đã hoàn`, `Tạm ứng`, `Dư nợ` |
| [plan-detail/PlanServicesTab.tsx](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/PlanServicesTab.tsx) | L82–84: `Nữ`, `Khác`, `Không tiết lộ` |
| [plan-detail/convert/ConvertNewService.tsx](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/convert/ConvertNewService.tsx) | L18: `Chuyển đổi sẽ cần tạo hoàn tiền dịch vụ cho dịch vụ cũ`<br>L19: `Khi chuyển đổi, tiền dịch vụ cũ được tính vào dư nợ` |
| [plan-detail/planDetailTypes.ts](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/planDetailTypes.ts) | L30–33: `Chi tiết`, `Thanh toán`, `Hoàn tiền`, `Dư nợ` |
| [plan-detail/serviceColumns.tsx](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/serviceColumns.tsx) | L122–138: `Chẩn đoán`, `Bác sĩ điều trị`, `Răng`, `Ghi chú`, `Bác sĩ chẩn đoán 1`, `Chẩn đoán 2`, `Nhân sự tư vấn 1`, `Nhân sự tư vấn 2` |

Bổ sung một trường hợp phân tích theo dấu không bắt được: `genderLabels` có `"Nam"`. Key này **có** trong
`en.json` (`"Male"`), nhưng `"Nữ"`, `"Khác"`, `"Không tiết lộ"` thì không, nên ở English giới tính hiển thị
lẫn lộn "Male" / "Nữ". Map này bị lặp ở 3 file ([PatientProfileTab.tsx:63](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientProfileTab.tsx#L63),
[PatientRecordTabs.tsx:21](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientRecordTabs.tsx#L21),
[PlanServicesTab.tsx:81](../../BlueDental.FE/src/features/treatment-management/components/plan-detail/PlanServicesTab.tsx#L81)),
trong khi `vi.json` đã có sẵn nhóm key `Common:Gender:*` có thể dùng lại.

## E. Text tiếng Việt không đi qua `t()`: thêm key cũng không dịch được

| Chỗ | Chuỗi | Ghi chú |
|---|---|---|
| [AdviseServiceRow.tsx:12](../../BlueDental.FE/src/features/treatment-management/components/advise/AdviseServiceRow.tsx#L12), [PlanPricingFields.tsx:12](../../BlueDental.FE/src/features/treatment-management/components/plan/PlanPricingFields.tsx#L12) | `VNĐ` | nút chuyển đơn vị giảm giá, render `{unit.label}` trực tiếp |
| [rowHandles.ts:135](../../BlueDental.FE/src/features/patient-management/components/patient-detail/medical-record/rowHandles.ts#L135), [:152](../../BlueDental.FE/src/features/patient-management/components/patient-detail/medical-record/rowHandles.ts#L152) | `Xóa dòng`, `Thêm dòng` | `title` + `aria-label` của nút −/+ trên tờ bệnh án |
| [MedicalRecordDocument.tsx:206](../../BlueDental.FE/src/features/patient-management/components/patient-detail/medical-record/MedicalRecordDocument.tsx#L206) | `title="Bệnh án"` | tiêu đề iframe (a11y) |
| [QuoteSheet.tsx:28](../../BlueDental.FE/src/features/patient-management/components/patient-detail/quote/QuoteSheet.tsx#L28) | `Thu Ngân / Bác Sĩ` | ô ký tên trên phiếu báo giá |
| [quoteModel.ts:137](../../BlueDental.FE/src/features/patient-management/components/patient-detail/quote/quoteModel.ts#L137), [DiagnosisPrintDialog.tsx:29](../../BlueDental.FE/src/features/patient-management/components/patient-detail/consulting/DiagnosisPrintDialog.tsx#L29) | đoạn giải thích mặc định (HTML) | cùng một nội dung, bị lặp ở 2 nơi |
| [moneyWords.ts](../../BlueDental.FE/src/utils/moneyWords.ts) | đọc số tiền bằng chữ tiếng Việt | dùng trên `ReceiptSheet` (phiếu thu ở chi tiết kế hoạch điều trị) |
| [templates/*.ts](../../BlueDental.FE/src/features/patient-management/components/patient-detail/medical-record/templates/) (9 mẫu) | toàn bộ nội dung tờ bệnh án in | biểu mẫu y tế theo bản gốc: **cần quyết định** dịch hay giữ nguyên tiếng Việt |

## F. Không nhất quán / lỗi nội dung

1. Lỗi chính tả trong key: `"Tạo báo giá từ các phiếu tư vấn đã chọn đã chọn, …"` ở
   [PatientAdviseCard.tsx:479](../../BlueDental.FE/src/features/patient-management/components/patient-detail/PatientAdviseCard.tsx#L479) (lặp "đã chọn").
2. Giới tính hiển thị lẫn lộn "Male" / "Nữ" ở English (xem mục D).
3. `t("Xem {0}")` (aria-label nút xem trên mỗi dòng danh sách) không có bản dịch EN, trong khi nút bên cạnh
   dùng key đã dịch. Runtime English cho ra "Xem Đỗ Thanh Hà" nằm cạnh "Edit Đỗ Thanh Hà".

## G. Đã kiểm tra, không phải lỗi

- `toLocaleLowerCase("vi")` / `toLocaleUpperCase("vi")` (10 chỗ): dùng để so khớp và viết IN HOA tên tiếng
  Việt, giữ `vi` là đúng.
- `"bác sĩ"` ở `staffQueries.ts:71` và `useStaffOptions.ts:95`: so khớp tên vai trò, không hiển thị.
- `statusPalette.*.label` ở `theme/index.ts`: chỉ phần `color` được dùng, nhãn không hiển thị (dữ liệu chết).
- `[BlueDental] Lỗi API` ở `lib/notify.tsx`: chỉ ghi `console.error`, không hiển thị.
- `HH:mm`, `IP`, `%`, các ký tự `‹ › [ ] -`: định dạng hoặc ký hiệu.
- Trên runtime English, mọi chuỗi tiếng Việt còn lại đều là **dữ liệu** (tên bệnh nhân/bác sĩ, dịch vụ, thuốc,
  nhóm danh mục seed, địa chỉ, thẻ hồ sơ, nội dung tư vấn), đúng như thiết kế.

## H. Giới hạn của lần rà soát

- Crawler chỉ bấm nút ở dòng đầu của mỗi bảng và bỏ qua mọi nút có thể ghi dữ liệu (xoá/lưu/huỷ/xác nhận/
  chuyển đổi/hoàn tiền/upload…). Các dialog nằm sau những nút đó (xác nhận xoá, hoàn tiền, chuyển đổi dịch
  vụ, trình xem ảnh, đơn labo, bảo hành/tái khám…) **chỉ được rà bằng phân tích tĩnh**. Phân tích tĩnh
  phủ toàn bộ literal của chúng, nhưng chưa có bằng chứng runtime.
- Không kích hoạt thông báo lỗi từ backend (BusinessException); phần này đi theo cơ chế riêng của ABP.

## I. Phát hiện thêm trong lúc sửa: hậu quả của `2eec1e9e` + `890c266a`

Hai commit này được kéo về giữa phiên. Commit thứ nhất đổi khoảng 3.000 chuỗi sang key, commit thứ hai điền giá trị cho các key đó.

### I.1 Chuỗi định dạng ngày bị thay bằng tên key (ĐÃ SỬA)

`dayjs().format("DD/MM/YYYY")` bị đổi thành `format("Patient:Misc:DateFormat")` mà không qua `t()`.
`dayjs` hiểu tên key là mẫu định dạng, nên in ra chuỗi rác kiểu `Pamtient:8i0c:15amteFor0amt`.
Có 6 chỗ ở 5 file: `patientImageAdapters.ts` (nhãn ngày của ảnh), `CareDetailDialog.tsx`,
`PatientEditorDialog.tsx` ×2, `PatientSourceColumn.tsx` (ngày tạo hồ sơ), và
**`PatientMedicalRecordTab.tsx:177`**. Chỗ cuối này **ghi chuỗi rác vào tờ bệnh án rồi lưu DB**.
Cả 6 chỗ đã được khôi phục về chuỗi định dạng gốc.

Production **không** bị ảnh hưởng: CD của `fe3044da` và `890c266a` đều đỏ (Lint/Typecheck/BE Test), prod
vẫn ở `1e8e1728`. Nếu tờ bệnh án nào trên DB local có ngày dạng rác thì đó là dữ liệu được tạo trong khoảng
`2eec1e9e` → bản sửa này.

### I.2 `planCardRows.tsx` import `t` thừa (ĐÃ SỬA)

Lỗi này làm `tsc -b` đỏ, đồng thời là lý do CI Frontend Typecheck fail ở `890c266a`.

### I.3 Câu tiếng Việt bị đổi khác câu gốc

Mỗi cặp `t("câu gốc") → t("Key")` trong diff `2eec1e9e` và `890c266a` được so với giá trị `vi.json` hiện tại. Diff được lấy
với `--ignore-cr-at-eol -w`, vì `2eec1e9e` ghi lại nhiều file từ đầu (đổi CRLF/LF); không bỏ qua thì các file đó hiện ra như xoá hết
rồi thêm mới. Có hai kiểu được tính: phép thay tại chỗ (dòng cũ và dòng mới giống hệt nhau khi bỏ chuỗi đi), và các map
được dựng lại (ví dụ `ALL_PATIENT_TABS` → `TAB_I18N`), đối chiếu tay theo thứ tự.

**Trong phạm vi trang này: ĐÃ SỬA, còn 0 chỗ lệch.** Vẫn giữ key namespace; chỉ đưa giá trị về câu gốc:
- **89 key đổi giá trị** vì mọi nơi dùng key đó đều cần đúng một câu. Trong đó có tab "Kế hoạch điều trị" và "Chăm sóc KH" (bị đổi thành "Kế hoạch" / "Chăm sóc khách hàng"),
  và 5 nhãn bộ lọc danh sách ("Phân loại theo Tag" bị đổi thành "Nhãn", "Chưa phát sinh" thành "Chưa điều trị"…). Giá trị `en` đi kèm được viết lại theo cùng nghĩa;
  ví dụ `Patient:Diagnosis:ConsultSection2` trước đó ghi "I. HÌNH ẢNH CHẨN ĐOÁN" / "I. DIAGNOSTIC IMAGES" trên tờ in chẩn đoán.
- **46 vị trí chuyển sang key riêng** (12 key mới) vì key dùng chung cho nhiều nơi, mà mỗi nơi vốn ghi một câu khác. Ví dụ `Common:Cancel` "Hủy"
  → `Common:CancelAlt` "Huỷ" (ConfirmDeleteDialog, PaymentModal…); bộ lọc thẻ ở danh sách bệnh nhân đang báo
  "Không tìm thấy bác sĩ" → `Patient:Filter:TagNotFound`. Pill trạng thái dịch vụ trong bảng kế hoạch ("Đã tạo" / "Hủy dịch vụ" / "Chuyển đổi") tách khỏi map của API, vì map đó vốn ghi
  "Chưa điều trị" / "Đã huỷ" / "Đã thay thế". Nút thêm/bỏ nhân sự ở `ConvertStaffBox` lấy lại tham số bị rơi
  (`t("Thêm {0}", …)` từng bị đổi thành `t("Common:Add")`). Giá trị của key dùng chung giữ nguyên, nên các màn khác không đổi.

**Ngoài phạm vi: CHƯA SỬA** — 64 vị trí ở màn lịch hẹn, báo cáo, CSKH, vận hành, nhân sự, voucher, tìm kiếm toàn cục và
**`/taxonomy`** (`TaxonomyPage.tsx:411`, "Không tìm thấy kết quả phù hợp" → "Không tìm thấy kết quả"; màn này đã chốt ở §17).
Các dòng `DentalChartView`/`AllergyList`/`MedicalHistoryPanel` nằm trong `PatientDetailDrawer`, component không còn được import
ở đâu (code chết). Trong số đó, `Patient:ToothLabel` thiếu hẳn key.

| Key | Câu gốc | Giá trị `vi` hiện tại | Vị trí |
|---|---|---|---|
| `Appointment:Action:CreateTempShort` | Tạo lịch tạm | Lịch tạm | features/appointments/components/CalendarToolbarRow2.tsx:102 |
| `Appointment:History:Export:AppointmentTime` | Kết thúc | Thời gian hẹn | features/appointments/pages/AppointmentCalendarPage.tsx:86 |
| `Appointment:Panel:ByDoctor` | Xem theo bác sĩ | Theo bác sĩ | features/appointments/components/CalendarToolbarRow2.tsx:49 |
| `Appointment:Panel:ByHour` | Xem theo giờ | Theo giờ | features/appointments/components/CalendarToolbarRow2.tsx:48 |
| `Common:Add` | Tạo | Thêm mới | features/materials/components/MaterialGroupDialog.tsx:71 |
| `Common:Cancel` | Huỷ | Hủy | features/report/components/ConfirmApproveDialog.tsx:29 |
| `Common:Cancel` | Huỷ | Hủy | features/staff/components/StaffRosterCard.tsx:127 |
| `Common:Cancel` | Huỷ | Hủy | features/treatment-management/components/PatientAccountPanel.tsx:197 |
| `Common:Cancel` | Huỷ | Hủy | features/treatment-management/components/StageModal.tsx:103 |
| `Common:Cancel` | Huỷ | Hủy | features/voucher/components/VoucherColumns.tsx:254 |
| `Common:ClearFilter` | Xoá bộ lọc | Xóa bộ lọc | features/appointments/components/CalendarControlPanel.tsx:220 |
| `Common:Delete` | Xóa | Xoá | features/identity/pages/IdentityAdministrationPage.tsx:250 |
| `Common:Delete` | Xóa | Xoá | features/identity/pages/IdentityAdministrationPage.tsx:359 |
| `Common:Delete` | Xóa | Xoá | features/report/components/CategoryPanel.tsx:73 |
| `Common:Edit` | Sửa | Chỉnh sửa | features/materials/components/MaterialGroupDialog.tsx:71 |
| `Common:NoResults` | Không tìm thấy dữ liệu | Không tìm thấy kết quả | features/cskh/components/SaveMessageDialog.tsx:105 |
| `Common:NoResults` | Không tìm thấy dữ liệu | Không tìm thấy kết quả | features/cskh/components/SaveMessageDialog.tsx:115 |
| `Common:NoResults` | Không tìm thấy dữ liệu | Không tìm thấy kết quả | features/cskh/components/SendZaloDialog.tsx:79 |
| `Common:NoResults` | Không tìm thấy kết quả phù hợp | Không tìm thấy kết quả | features/operations/pages/OperationsPage.tsx:464 |
| `Common:NoResults` | Không tìm thấy kết quả phù hợp | Không tìm thấy kết quả | features/taxonomy/pages/TaxonomyPage.tsx:411 |
| `Common:NoResultsFor` | Không tìm thấy kết quả cho “{0}” | Không tìm thấy kết quả cho "{0}" | components/GlobalSearch.tsx:112 |
| `Common:Pagination` | Hiển thị {0}–{1} trên {2} | Hiển thị {0}–{1} trên {2} dòng | features/voucher/components/VoucherTable.tsx:53 |
| `Common:Patient` | Khách hàng | Bệnh nhân | components/GlobalSearch.tsx:20 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/appointments/components/CalendarControlPanel.tsx:169 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/appointments/components/CalendarToolbarRow2.tsx:55 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/appointments/pages/AppointmentCalendarPage.tsx:362 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/cskh/components/CareToolbar.tsx:56 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/cskh/components/CareToolbar.tsx:59 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/cskh/components/GroupPatientsPanel.tsx:105 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/cskh/components/GroupPatientsPanel.tsx:108 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/materials/components/ClinicMaterialsTab.tsx:325 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/materials/components/ClinicMaterialsTab.tsx:326 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/operations/pages/OperationsPage.tsx:443 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/operations/pages/OperationsPage.tsx:444 |
| `Common:Search` | Tìm kiếm | Tìm kiếm... | features/staff/pages/StaffPage.tsx:293 |
| `Operations:Consultant1` | Nhân sự tư vấn | Nhân sự tư vấn 1 | features/operations/reports/ServiceCompletionReport.tsx:157 |
| `Organization:UpdateBranch` | Sửa chi nhánh | Cập nhật chi nhánh | features/organizations/pages/OrganizationListPage.tsx:173 |
| `Patient:DentalChart` | Biểu đồ nha khoa 32 răng | Biểu đồ răng | features/patient-management/components/DentalChartView.tsx:224 |
| `Patient:LowerJaw` | Hàm Dưới | Hàm dưới | features/patient-management/components/DentalChartView.tsx:282 |
| `Patient:NoAllergy` | Không có dị ứng đã ghi nhận | Chưa có dị ứng | features/patient-management/components/AllergyList.tsx:14 |
| `Patient:NoMedicalHistory` | Chưa có thông tin tiền sử bệnh. | Chưa có tiền sử bệnh | features/patient-management/components/MedicalHistoryPanel.tsx:15 |
| `Patient:ToothLabel` | Răng {0} — {1} | ∅ (thiếu key) | features/patient-management/components/DentalChartView.tsx:221 |
| `Patient:UpperJaw` | Hàm Trên | Hàm trên | features/patient-management/components/DentalChartView.tsx:269 |
| `Report:Column:CustomerName` | Khách hàng | Tên khách hàng | features/report/components/PrepaidSubTab.tsx:42 |
| `Report:Column:DoctorName` | Bác sĩ điều trị | Bác sĩ tiếp nhận | features/report/components/PrepaidSubTab.tsx:62 |
| `Report:Column:PaymentMethod` | Phương thức thanh toán | Hình thức | features/report/components/PaymentSubTab.tsx:51 |
| `Report:Column:PaymentMethod` | Phương thức thanh toán | Hình thức | features/report/components/PaymentSubTab.tsx:82 |
| `Report:Column:TreatmentService` | Dịch vụ | Dịch vụ điều trị | features/report/components/PrepaidSubTab.tsx:54 |
| `Report:PaymentChannel:Banking` | Chuyển Khoản | Chuyển khoản | features/report/components/PaymentSubTab.tsx:101 |
| `Report:PaymentChannel:Banking` | Chuyển Khoản | Chuyển khoản | features/report/components/RefundSubTab.tsx:71 |
| `Report:PaymentChannel:Card` | Cà Thẻ | Quẹt thẻ | features/report/components/PaymentSubTab.tsx:102 |
| `Report:PaymentChannel:Card` | Cà Thẻ | Quẹt thẻ | features/report/components/RefundSubTab.tsx:72 |
| `Report:PaymentChannel:Cash` | Tiền Mặt | Tiền mặt | features/report/components/PaymentSubTab.tsx:100 |
| `Report:PaymentChannel:Cash` | Tiền Mặt | Tiền mặt | features/report/components/RefundSubTab.tsx:70 |
| `Report:Prepaid:Consumed` | Tiêu dùng tạm ứng | Tiêu tạm ứng theo tiến độ | features/report/components/PrepaidSubTab.tsx:90 |
| `Report:SalesDetail:Phone` | Số điện thoại | ĐT | features/report/components/SalesEntryDetailModal.tsx:85 |
| `Report:ServiceStatus:Cancelled` | (đã huỷ) | đã hủy | features/report/components/PaymentSubTab.tsx:28 |
| `Report:SubTab:ActualRevenue` | Thực thu | Doanh số thực | features/report/components/PaymentSubTab.tsx:120 |
| `Report:SubTab:ActualRevenue` | Thực thu | Doanh số thực | features/report/components/PaymentSubTab.tsx:140 |
| `Treatment:Plan:NoPlan` | Bệnh nhân chưa có kế hoạch điều trị | Chưa có kế hoạch điều trị | features/treatment-management/components/PatientAccountPanel.tsx:226 |
| `Treatment:Stage:MarkedDone` | Đã xong | Đã đánh dấu hoàn thành | features/treatment-management/components/TreatmentStagePanel.tsx:121 |
| `Treatment:Stage:NotePlaceholder` | Ghi chú công đoạn | Nhập ghi chú | features/treatment-management/components/StageModal.tsx:157 |
| `Treatment:Stage:StageHint` | Công đoạn là một bước của dịch vụ trong kế hoạch điều trị. Hãy chốt phiếu tư vấn rồi tạo kế hoạch điều trị trước. | Chọn dịch vụ và điền thông tin công đoạn | features/treatment-management/components/StageModal.tsx:115 |
| `Voucher:MinOrderLabel2` | Nhập giá trị đơn hàng tối thiểu(VNĐ) | Nhập giá trị đơn hàng tối thiểu (VNĐ) | features/voucher/components/VoucherFormFields.tsx:139 |
